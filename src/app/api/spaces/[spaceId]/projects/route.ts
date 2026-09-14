import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { recordActivity } from '@/lib/activity';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  goal: z.string().max(1000).optional()
});

async function assertSpaceOwnership(spaceId: string, userId: string) {
  const space = await prisma.space.findFirst({ where: { id: spaceId, userId } });
  if (!space) {
    const err: any = new Error('Space not found');
    err.status = 404;
    throw err;
  }
  return space;
}

export const GET = withApiHandler(async (_req: NextRequest, context: { params: { spaceId: string } | Promise<{ spaceId: string }> }) => {
    const params = await context.params;
  const user = await requireUser();
  const space = await assertSpaceOwnership(params.spaceId, user.id);

  const projects = await prisma.project.findMany({
    where: { spaceId: params.spaceId },
    orderBy: { lastAccessedAt: 'desc' },
    include: { concepts: { select: { id: true, name: true, masteryPct: true, trend: true } } }
  });

  const recentActivity = await prisma.activity.findMany({
    where: { project: { spaceId: params.spaceId } },
    orderBy: { createdAt: 'desc' }, take: 8,
    select: { id: true, type: true, createdAt: true, project: { select: { name: true } } }
  });

  const enrichedProjects = projects.map(({ concepts, ...project }) => ({
    ...project,
    overallMastery: concepts.length ? Math.round(concepts.reduce((sum, concept) => sum + concept.masteryPct, 0) / concepts.length) : 0,
    needsAttention: concepts.filter((concept) => concept.trend === 'NEEDS_ATTENTION' || concept.masteryPct < 50).length,
    attentionConcepts: concepts
      .filter((concept) => concept.trend === 'NEEDS_ATTENTION' || concept.masteryPct < 50)
      .map((concept) => ({ id: concept.id, name: concept.name, masteryPct: concept.masteryPct }))
  }));

  return NextResponse.json({ space, projects: enrichedProjects, recentActivity });
});

export const POST = withApiHandler(async (req: NextRequest, context: { params: { spaceId: string } | Promise<{ spaceId: string }> }) => {
    const params = await context.params;
  const user = await requireUser();
  await assertSpaceOwnership(params.spaceId, user.id);
  const body = CreateProjectSchema.parse(await req.json());

  const project = await prisma.project.create({
    data: {
      spaceId: params.spaceId,
      userId: user.id,
      name: body.name,
      description: body.description,
      goal: body.goal
    }
  });

  await recordActivity({ userId: user.id, projectId: project.id, type: 'PROJECT_CREATED', metadata: { name: project.name } });

  return NextResponse.json({ project }, { status: 201 });
});
