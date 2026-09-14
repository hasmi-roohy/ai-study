import { prisma } from '@/lib/db';

export interface RetrievedChunk {
  chunkId: string;
  materialId: string;
  filename: string;
  page: number | null;
  content: string;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Naive lexical overlap score, used as a fallback / hybrid signal alongside vector search. */
function keywordScore(query: string, content: string): number {
  const queryTerms = new Set(query.toLowerCase().split(/\W+/).filter((t) => t.length > 2));
  const contentTerms = content.toLowerCase().split(/\W+/);
  let hits = 0;
  for (const term of contentTerms) if (queryTerms.has(term)) hits++;
  return hits / Math.max(contentTerms.length, 1);
}

/**
 * CRITICAL SECURITY BOUNDARY (PRD §52): every retrieval call is scoped by projectId.
 * There is no code path here that can return chunks from a different project.
 */
export async function retrieveRelevantChunks(params: {
  projectId: string;
  query: string;
  queryEmbedding?: number[];
  topK?: number;
}): Promise<RetrievedChunk[]> {
  const { projectId, query, queryEmbedding, topK = 5 } = params;

  const chunks = await prisma.chunk.findMany({
    where: { projectId }, // <-- isolation boundary
    include: { material: { select: { filename: true } } },
    take: 500 // cap for prototype-scale in-memory scoring
  });

  const scored = chunks.map((chunk) => {
    const vectorScore =
      queryEmbedding && chunk.embedding?.length ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0;
    const lexicalScore = keywordScore(query, chunk.content);
    // Weighted hybrid: favors vector similarity when embeddings exist, falls back to lexical otherwise.
    const score = queryEmbedding && chunk.embedding?.length ? 0.8 * vectorScore + 0.2 * lexicalScore : lexicalScore;
    return {
      chunkId: chunk.id,
      materialId: chunk.materialId,
      filename: chunk.material.filename,
      page: chunk.page,
      content: chunk.content,
      score
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((c) => c.score > 0);
}
