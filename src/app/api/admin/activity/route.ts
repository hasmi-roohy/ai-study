import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';

/**
 * Platform-wide activity feed for Admin (PRD §61 Admin Activity). Supports filtering
 * by type and a bounded page size so this stays cheap as Activity grows — this is the
 * kind of query an index on (type, createdAt) exists for in the schema.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? undefined;
  const take = Math.min(Number(searchParams.get('take') ?? 50), 200);

  const activity = await prisma.activity.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: 'desc' },
    take,
    include: { user: { select: { email: true, name: true } }, project: { select: { name: true } } }
  });

  const typeCounts = await prisma.activity.groupBy({ by: ['type'], _count: { type: true }, orderBy: { _count: { type: 'desc' } } });

  return NextResponse.json({
    activity: activity.map((a) => ({
      id: a.id,
      type: a.type,
      createdAt: a.createdAt,
      user: a.user?.email ?? a.user?.name ?? 'unknown',
      project: a.project?.name ?? null,
      metadata: a.metadata
    })),
    typeCounts: typeCounts.map((t) => ({ type: t.type, count: t._count.type }))
  });
});
