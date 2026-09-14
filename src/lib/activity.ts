import { prisma } from '@/lib/db';

// PRD §37/§38: a single append-only event log backs user-facing activity feeds,
// analytics, admin visibility, and downstream workflow triggers (see src/workers).
export async function recordActivity(params: {
  userId: string;
  projectId?: string;
  type: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.activity.create({
    data: {
      userId: params.userId,
      projectId: params.projectId,
      type: params.type,
      metadata: params.metadata as any
    }
  });
}
