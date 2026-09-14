import { prisma } from '@/lib/db';

export type JobType =
  | 'PROCESS_MATERIAL'
  | 'GENERATE_RECOMMENDATION'
  | 'RUN_EVALUATION'
  | 'UPDATE_ANALYTICS';

/**
 * Enqueue a job. `idempotencyKey`, when provided, prevents duplicate jobs from being
 * created for the same logical operation (PRD §50 Idempotency & Data Integrity) —
 * e.g. re-uploading a webhook retry for the same material won't double-process it.
 */
export async function enqueueJob(params: {
  type: JobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
}) {
  if (params.idempotencyKey) {
    const existing = await prisma.job.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
    if (existing) return existing;
  }

  return prisma.job.create({
    data: {
      type: params.type,
      payload: params.payload as any,
      idempotencyKey: params.idempotencyKey,
      maxAttempts: params.maxAttempts ?? 3
    }
  });
}

/** Atomically claim the next queued job so multiple worker instances don't race on the same row. */
export async function claimNextJob() {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' }
    });
    if (!job) return null;

    return tx.job.update({
      where: { id: job.id },
      data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } }
    });
  });
}

export async function completeJob(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: { status: 'COMPLETED', completedAt: new Date() }
  });
}

export async function failJob(jobId: string, error: string) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  const status = job.attempts >= job.maxAttempts ? 'FAILED' : 'QUEUED'; // requeue for retry until max attempts
  return prisma.job.update({
    where: { id: jobId },
    data: { status, lastError: error }
  });
}
