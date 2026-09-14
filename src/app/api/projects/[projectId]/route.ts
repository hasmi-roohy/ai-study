import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { assertProjectOwnership } from '@/lib/api/ownership';

export const GET = withApiHandler(async (_req: NextRequest, context: { params: { projectId: string } | Promise<{ projectId: string }> }) => {
    const params = await context.params;
  const user = await requireUser();
  const project = await assertProjectOwnership(params.projectId, user.id);

  await prisma.project.update({ where: { id: params.projectId }, data: { lastAccessedAt: new Date() } });

  const [concepts, recentActivity, latestRecommendation, materials, learningContext] = await Promise.all([
    prisma.concept.findMany({ where: { projectId: params.projectId }, orderBy: { masteryPct: 'asc' } }),
    prisma.activity.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.recommendation.findFirst({
      where: { projectId: params.projectId, dismissed: false },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.material.findMany({ where: { projectId: params.projectId }, orderBy: { createdAt: 'desc' } }),
    prisma.learningContext.findMany({ where: { userId: user.id, OR: [{ projectId: params.projectId }, { projectId: null }] }, orderBy: [{ relevance: 'desc' }, { updatedAt: 'desc' }], take: 4, select: { id: true, type: true, content: true } })
  ]);

  const overallMastery = concepts.length
    ? Math.round(concepts.reduce((sum, c) => sum + c.masteryPct, 0) / concepts.length)
    : 0;

  return NextResponse.json({
    project,
    concepts,
    recentActivity,
    recommendation: latestRecommendation,
    materials,
    learningContext,
    overallMastery
  });
});
