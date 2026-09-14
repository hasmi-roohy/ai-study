import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';

export const GET = withApiHandler(async () => {
  await requireAdmin();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    totalSpaces,
    totalProjects,
    materialsUploaded,
    tutorRequests,
    quizActivity,
    aiUsageAgg,
    aiErrorCount,
    jobStats
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
    prisma.space.count(),
    prisma.project.count(),
    prisma.material.count(),
    prisma.activity.count({ where: { type: 'TUTOR_QUESTION_ASKED' } }),
    prisma.activity.count({ where: { type: 'QUIZ_COMPLETED' } }),
    prisma.aIUsageLog.aggregate({ _avg: { latencyMs: true }, _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: true }),
    prisma.aIUsageLog.count({ where: { success: false } }),
    prisma.job.groupBy({ by: ['status'], _count: { status: true } })
  ]);

  return NextResponse.json({
    totals: { totalUsers, activeUsers, totalSpaces, totalProjects, materialsUploaded },
    activity: { tutorRequests, quizActivity },
    aiUsage: {
      totalRequests: aiUsageAgg._count,
      avgLatencyMs: Math.round(aiUsageAgg._avg.latencyMs ?? 0),
      totalCostUsd: Number((aiUsageAgg._sum.costUsd ?? 0).toFixed(4)),
      errorRate: aiUsageAgg._count ? Number(((aiErrorCount / aiUsageAgg._count) * 100).toFixed(2)) : 0
    },
    backgroundJobs: jobStats.map((j) => ({ status: j.status, count: j._count.status }))
  });
});
