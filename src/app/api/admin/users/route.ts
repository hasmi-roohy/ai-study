import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';

export const GET = withApiHandler(async () => {
  await requireAdmin();

  const users = await prisma.user.findMany({
    include: { _count: { select: { spaces: true } } },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch project counts and rough progress separately since Project belongs to Space, not User, in the relation graph.
  const enriched = await Promise.all(
    users.map(async (u) => {
      const projects = await prisma.project.findMany({ where: { userId: u.id }, include: { concepts: true } });
      const concepts = projects.flatMap((p) => p.concepts);
      const overallProgress = concepts.length
        ? Math.round(concepts.reduce((s, c) => s + c.masteryPct, 0) / concepts.length)
        : 0;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        spaces: u._count.spaces,
        projects: projects.length,
        overallProgress
      };
    })
  );

  return NextResponse.json({ users: enriched });
});
