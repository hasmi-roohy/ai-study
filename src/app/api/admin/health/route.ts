import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';

/**
 * Lightweight operational snapshot for Admin (PRD §64 Admin System Health). Not a
 * replacement for real infra monitoring — just enough to tell an operator whether
 * the app's own subsystems (DB, AI provider, background jobs) look healthy.
 */
export const GET = withApiHandler(async () => {
  await requireAdmin();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  let dbHealthy = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbHealthy = false;
  }

  const [jobStats, recentAI, recentFailedJobs, materialsByStatus] = await Promise.all([
    prisma.job.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.aIUsageLog.findMany({ where: { createdAt: { gte: oneHourAgo } }, select: { success: true, latencyMs: true } }),
    prisma.job.findMany({
      where: { status: 'FAILED' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: { id: true, type: true, lastError: true, attempts: true, completedAt: true }
    }),
    prisma.material.groupBy({ by: ['status'], _count: { status: true } })
  ]);

  const aiErrorRateLastHour = recentAI.length
    ? Number(((recentAI.filter((r) => !r.success).length / recentAI.length) * 100).toFixed(1))
    : 0;
  const avgLatencyLastHour = recentAI.length
    ? Math.round(recentAI.reduce((s, r) => s + (r.latencyMs ?? 0), 0) / recentAI.length)
    : 0;

  return NextResponse.json({
    database: { healthy: dbHealthy },
    aiProvider: { requestsLastHour: recentAI.length, errorRatePct: aiErrorRateLastHour, avgLatencyMs: avgLatencyLastHour },
    backgroundJobs: {
      byStatus: jobStats.map((j) => ({ status: j.status, count: j._count.status })),
      recentFailures: recentFailedJobs
    },
    materialProcessing: { byStatus: materialsByStatus.map((m) => ({ status: m.status, count: m._count.status })) }
  });
});
