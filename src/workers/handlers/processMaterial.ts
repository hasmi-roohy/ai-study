import pdfParse from 'pdf-parse';
import { prisma } from '@/lib/db';
import { generateStructured, embedTexts } from '@/lib/ai/provider';
import { z } from 'zod';
import { recordActivity } from '@/lib/activity';
import { enqueueJob } from '@/lib/jobs/queue';
import { getMaterial } from '@/lib/storage/materials';

const CHUNK_SIZE_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 150;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE_CHARS, text.length);
    chunks.push(text.slice(start, end));
    start = end - CHUNK_OVERLAP_CHARS;
    if (start < 0 || end === text.length) break;
  }
  return chunks.filter((c) => c.trim().length > 0);
}

// Groq's `json_object` mode only guarantees syntactically valid JSON, not that the model
// follows a specific shape — in practice openai/gpt-oss-120b will often ignore an
// instruction to wrap results in `{ "concepts": [...] }` and just return a bare array of
// strings instead (observed directly against the live API, not a hypothetical). Rather
// than keep tightening the prompt and hoping, accept every shape actually seen and
// normalize in code — that's reliable regardless of model wording quirks.
const ConceptItemSchema = z.union([
  z.string(),
  z.object({ name: z.string(), description: z.string().optional() })
]);
const ConceptExtractionSchema = z.union([
  z.object({ concepts: z.array(ConceptItemSchema).max(12) }),
  z.array(ConceptItemSchema).max(12)
]);

function normalizeConcepts(extracted: z.infer<typeof ConceptExtractionSchema>): { name: string; description: string }[] {
  const rawList = Array.isArray(extracted) ? extracted : extracted.concepts;
  return rawList.map((item) => (typeof item === 'string' ? { name: item, description: '' } : { name: item.name, description: item.description ?? '' }));
}

/**
 * PRD §13/§15: Upload -> Queued -> Processing -> Reading -> Understanding ->
 * Extracting Knowledge -> Creating Searchable Representation -> Ready.
 * This handler runs those stages; failures set MaterialStatus.FAILED with a reason
 * rather than leaving the material stuck.
 */
export async function processMaterial(payload: { materialId: string }) {
  const material = await prisma.material.findUniqueOrThrow({ where: { id: payload.materialId } });

  await prisma.material.update({ where: { id: material.id }, data: { status: 'PROCESSING' } });

  try {
    const fileBuffer = await getMaterial(material.storagePath);
    const parsed = await pdfParse(fileBuffer);
    const fullText = parsed.text;

    if (!fullText || fullText.trim().length < 20) {
      throw new Error('No extractable text found (the PDF may be a pure image scan without OCR support in this prototype)');
    }

    // Reading Content / Creating Searchable Representation
    const rawChunks = chunkText(fullText);

    // Embed each chunk so retrieval can do real semantic search instead of lexical-only.
    // Embeddings are a nice-to-have, not a hard dependency: if Gemini is unavailable
    // (missing key, rate-limited, etc.) we still store the chunks with empty embeddings
    // and retrieval quietly falls back to keyword scoring for this material, rather than
    // failing the whole upload over a non-critical enhancement.
    let chunkEmbeddings: number[][] = [];
    try {
      chunkEmbeddings = await embedTexts(rawChunks, { feature: 'EMBEDDING', promptVersion: 'embed-v1' }, 'RETRIEVAL_DOCUMENT');
    } catch (embedErr: any) {
      console.error(`Embedding failed for material ${material.id}, falling back to lexical-only search:`, embedErr?.message);
    }

    await prisma.chunk.createMany({
      data: rawChunks.map((content, i) => ({
        materialId: material.id,
        projectId: material.projectId,
        content,
        page: null, // pdf-parse doesn't give per-page offsets without extra work; documented as a known limitation
        embedding: chunkEmbeddings[i] ?? []
      }))
    });

    // Understanding Structure / Extracting Knowledge -> derive candidate concepts for this Project
    const conceptSample = fullText.slice(0, 6000); // keep prompt small; representative sample is enough for concept discovery
    const extracted = await generateStructured({
      system:
        'You extract the key learnable concepts from study material. Identify concise, distinct concepts a learner would need to master, each with a one-sentence description.',
      prompt: [
        `Extract up to 8 key concepts from this material:`,
        '',
        conceptSample,
        '',
        'Return JSON: { "concepts": [ { "name": string, "description": string } ] } — an object with a "concepts" array of objects, not a bare array of strings.'
      ].join('\n'),
      schema: ConceptExtractionSchema,
      ctx: { feature: 'CONCEPT_EXTRACTION', promptVersion: 'concept-extract-v2' }
    });

    const normalizedConcepts = normalizeConcepts(extracted);

    for (const c of normalizedConcepts) {
      await prisma.concept.upsert({
        where: { projectId_name: { projectId: material.projectId, name: c.name } },
        update: {},
        create: { projectId: material.projectId, name: c.name, description: c.description }
      });
    }

    await prisma.material.update({
      where: { id: material.id },
      data: { status: 'READY', processedAt: new Date() }
    });

    await recordActivity({
      userId: material.userId,
      projectId: material.projectId,
      type: 'MATERIAL_PROCESSING_COMPLETED',
      metadata: { materialId: material.id, chunkCount: rawChunks.length, conceptsFound: normalizedConcepts.length }
    });

    // Event-driven follow-up (PRD §38): knowledge changed, so recommendations may need refreshing.
    await enqueueJob({
      type: 'GENERATE_RECOMMENDATION',
      payload: { projectId: material.projectId },
      idempotencyKey: `reco:${material.projectId}:material:${material.id}`
    });
  } catch (err: any) {
    await prisma.material.update({
      where: { id: material.id },
      data: { status: 'FAILED', failureReason: err?.message ?? 'Unknown processing error' }
    });
    await recordActivity({
      userId: material.userId,
      projectId: material.projectId,
      type: 'MATERIAL_PROCESSING_FAILED',
      metadata: { materialId: material.id, reason: err?.message }
    });
    throw err; // let the job queue's retry/backoff logic decide whether to retry
  }
}
