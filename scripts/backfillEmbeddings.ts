import { PrismaClient } from '@prisma/client';
import { embedTexts } from '../src/lib/ai/provider';

const prisma = new PrismaClient();

// Batch size for reading/writing chunks; embedTexts() further sub-batches internally
// against Gemini's own request cap, this is just how many rows we pull from Postgres
// and update per round.
const DB_BATCH_SIZE = 100;

/**
 * One-off migration for materials processed before real embeddings existed
 * (src/lib/ai/provider.ts::embedText used to throw). Those chunks were stored with
 * embedding: [] and silently fall back to lexical-only retrieval. This script finds
 * them and backfills real Gemini embeddings so semantic search covers older uploads too.
 *
 * Run with: npm run backfill:embeddings
 */
async function main() {
  const emptyChunks = await prisma.chunk.findMany({
    where: { embedding: { isEmpty: true } },
    select: { id: true, content: true }
  });

  if (emptyChunks.length === 0) {
    console.log('No chunks with empty embeddings found — nothing to backfill.');
    return;
  }

  console.log(`Found ${emptyChunks.length} chunk(s) with empty embeddings. Backfilling...`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < emptyChunks.length; i += DB_BATCH_SIZE) {
    const batch = emptyChunks.slice(i, i + DB_BATCH_SIZE);
    try {
      const embeddings = await embedTexts(
        batch.map((c) => c.content),
        { feature: 'EMBEDDING', promptVersion: 'embed-v1-backfill' },
        'RETRIEVAL_DOCUMENT'
      );

      await Promise.all(
        batch.map((chunk, idx) =>
          prisma.chunk.update({ where: { id: chunk.id }, data: { embedding: embeddings[idx] } })
        )
      );

      updated += batch.length;
      console.log(`  ...${updated}/${emptyChunks.length} done`);
    } catch (err: any) {
      failed += batch.length;
      console.error(`  Batch starting at index ${i} failed, leaving those ${batch.length} chunk(s) empty:`, err?.message);
    }
  }

  console.log(`Backfill complete. Updated: ${updated}. Failed (left empty, safe to re-run): ${failed}.`);
}

main()
  .catch((err) => {
    console.error('Backfill script crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
