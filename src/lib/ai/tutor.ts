import { prisma } from '@/lib/db';
import { composeTutorContext } from '@/lib/context/compose';
import { generateStructured } from '@/lib/ai/provider';
import {
  TUTOR_PROMPT_VERSION,
  TutorResponseSchema,
  buildTutorSystemPrompt,
  buildTutorUserPrompt
} from '@/lib/ai/prompts/tutor';
import { recordActivity } from '@/lib/activity';

export async function askTutor(params: {
  userId: string;
  projectId: string;
  conversationId: string;
  question: string;
}) {
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId: params.userId } // ownership check — PRD §52
  });
  if (!project) throw new Error('Project not found or access denied');

  await prisma.message.create({
    data: { conversationId: params.conversationId, role: 'USER', content: params.question }
  });

  const context = await composeTutorContext({
    projectId: params.projectId,
    userId: params.userId,
    conversationId: params.conversationId,
    question: params.question
  });

  const system = buildTutorSystemPrompt({ projectGoal: project.goal });
  const prompt = buildTutorUserPrompt({
    question: params.question,
    evidence: context.retrievedChunks.map((c) => ({
      chunkId: c.chunkId,
      filename: c.filename,
      page: c.page,
      content: c.content
    })),
    learnerContext: context.learnerContext,
    recentMessages: context.recentMessages
  });

  let result;
  try {
    result = await generateStructured({
      system,
      prompt,
      schema: TutorResponseSchema,
      ctx: { userId: params.userId, feature: 'TUTOR', promptVersion: TUTOR_PROMPT_VERSION }
    });
  } catch (err) {
    // PRD §49: a failed AI request must not silently corrupt learning state.
    // We still persist a visible, honest failure message rather than losing the turn.
    const fallback = await prisma.message.create({
      data: {
        conversationId: params.conversationId,
        role: 'ASSISTANT',
        content: "I wasn't able to generate a response just now — please try again in a moment.",
        grounded: false
      }
    });
    return { message: fallback, error: true };
  }

  const citations = context.retrievedChunks
    .filter((c) => result.citedChunkIds.includes(c.chunkId))
    .map((c) => ({ materialId: c.materialId, filename: c.filename, page: c.page, snippet: c.content.slice(0, 200) }));

  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      role: 'ASSISTANT',
      content: result.answer,
      grounded: result.grounded,
      citations: citations.length ? citations : undefined
    }
  });

  await recordActivity({
    userId: params.userId,
    projectId: params.projectId,
    type: 'TUTOR_QUESTION_ASKED',
    metadata: { grounded: result.grounded, conversationId: params.conversationId }
  });

  return { message, error: false };
}
