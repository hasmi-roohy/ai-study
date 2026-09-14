import { prisma } from '@/lib/db';
import { retrieveRelevantChunks, RetrievedChunk } from '@/lib/retrieval/search';
import { embedText } from '@/lib/ai/provider';

export interface ComposedContext {
  retrievedChunks: RetrievedChunk[];
  learnerContext: string[]; // persistent, relevant learner facts (goals, weaknesses, preferences)
  recentMessages: { role: 'user' | 'assistant'; content: string }[]; // short-term window
}

const RECENT_MESSAGE_WINDOW = 8; // last N messages, not the whole conversation history
const MAX_LEARNER_CONTEXT_ITEMS = 6;

/**
 * Builds the context for a single Tutor turn.
 *
 * Design principle (PRD §17, §40): combine short-term, long-term, and project-knowledge
 * context deliberately and relevantly, rather than concatenating everything the system
 * has ever recorded about the user into one giant prompt.
 */
export async function composeTutorContext(params: {
  projectId: string;
  userId: string;
  conversationId: string;
  question: string;
}): Promise<ComposedContext> {
  // Semantic search needs the question embedded too; if that fails (missing key, rate
  // limit, transient error) we still proceed with lexical-only retrieval rather than
  // failing the whole Tutor turn over a non-critical enhancement.
  let queryEmbedding: number[] | undefined;
  try {
    queryEmbedding = await embedText(params.question, { userId: params.userId, feature: 'EMBEDDING', promptVersion: 'embed-v1' }, 'RETRIEVAL_QUERY');
  } catch (err: any) {
    console.error('Query embedding failed, falling back to lexical-only retrieval:', err?.message);
  }

  const [retrievedChunks, learnerContextRows, recentMessageRows] = await Promise.all([
    retrieveRelevantChunks({ projectId: params.projectId, query: params.question, queryEmbedding, topK: 5 }),

    // Only pull learner context relevant to *this* project, plus global (projectId: null) context,
    // ranked by relevance, capped so it can't grow unbounded across a long learning history.
    prisma.learningContext.findMany({
      where: {
        userId: params.userId,
        OR: [{ projectId: params.projectId }, { projectId: null }]
      },
      orderBy: [{ relevance: 'desc' }, { updatedAt: 'desc' }],
      take: MAX_LEARNER_CONTEXT_ITEMS
    }),

    prisma.message.findMany({
      where: { conversationId: params.conversationId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_MESSAGE_WINDOW
    })
  ]);

  return {
    retrievedChunks,
    learnerContext: learnerContextRows.map((c) => `[${c.type}] ${c.content}`),
    recentMessages: recentMessageRows
      .reverse()
      .map((m) => ({ role: m.role.toLowerCase() as 'user' | 'assistant', content: m.content }))
  };
}
