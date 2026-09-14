import { claimNextJob, completeJob, failJob } from '@/lib/jobs/queue';
import { processMaterial } from '@/workers/handlers/processMaterial';
import { generateRecommendation } from '@/workers/handlers/generateRecommendation';

const handlers: Record<string, (payload: any) => Promise<void>> = {
  PROCESS_MATERIAL: processMaterial,
  GENERATE_RECOMMENDATION: generateRecommendation
};

async function runOneJob(): Promise<'processed' | 'empty'> {
  const job = await claimNextJob();
  if (!job) return 'empty';

  const handler = handlers[job.type];
  if (!handler) {
    await failJob(job.id, `No handler registered for job type ${job.type}`);
    return 'processed';
  }

  try {
    await handler(job.payload as any);
    await completeJob(job.id);
  } catch (err: any) {
    console.error(`Job ${job.id} (${job.type}) failed:`, err?.message);
    await failJob(job.id, err?.message ?? 'Unknown error');
  }
  return 'processed';
}

/**
 * Processes queued jobs until the queue is empty, `maxJobs` is reached, or
 * `timeBudgetMs` elapses — whichever comes first. The time budget matters for
 * serverless invocation (see src/app/api/cron/process-jobs/route.ts), which has a
 * hard execution ceiling; the standalone worker calls this with no time budget.
 */
export async function processJobBatch(params: { maxJobs?: number; timeBudgetMs?: number } = {}) {
  const maxJobs = params.maxJobs ?? Infinity;
  const timeBudgetMs = params.timeBudgetMs ?? Infinity;
  const start = Date.now();

  let processedCount = 0;
  while (processedCount < maxJobs && Date.now() - start < timeBudgetMs) {
    const result = await runOneJob();
    if (result === 'empty') break;
    processedCount++;
  }

  return { processedCount, elapsedMs: Date.now() - start };
}
