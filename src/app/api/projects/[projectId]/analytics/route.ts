import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { assertProjectOwnership } from '@/lib/api/ownership';
import { prisma } from '@/lib/db';

export const GET = withApiHandler(async (_req: NextRequest, context: { params: { projectId: string } | Promise<{ projectId: string }> }) => {
    const params = await context.params;
  const user = await requireUser();
  await assertProjectOwnership(params.projectId, user.id);

  const [concepts, assessments, activityCounts, tutorQuestions] = await Promise.all([
    prisma.concept.findMany({ where: { projectId: params.projectId } }),
    prisma.assessment.findMany({ where: { projectId: params.projectId }, orderBy: { createdAt: 'asc' } }),
    prisma.activity.groupBy({ by: ['type'], where: { projectId: params.projectId }, _count: { type: true } }),
    prisma.activity.count({ where: { projectId: params.projectId, type: 'TUTOR_QUESTION_ASKED' } })
  ]);

  const conceptsMastered = concepts.filter((c) => c.masteryPct >= 80).length;
  const conceptsNeedingAttention = concepts.filter((c) => c.trend === 'NEEDS_ATTENTION').length;
  const avgAccuracy = assessments.length
    ? Math.round(
        assessments.reduce((sum, a: any) => sum + (a.summary?.accuracy ?? 0), 0) / assessments.length
      )
    : null;

  return NextResponse.json({
    performance: { avgAccuracy, conceptsMastered, conceptsNeedingAttention, totalConcepts: concepts.length },
    growth: {
      masteryTrend: concepts.map((c) => ({ concept: c.name, previous: c.previousMasteryPct, current: c.masteryPct, trend: c.trend }))
    },
    activity: { byType: activityCounts.map((a) => ({ type: a.type, count: a._count.type })) },
    aiActivity: { tutorQuestions }
  });
});
