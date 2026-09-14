import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { recordActivity } from '@/lib/activity';

const CreateSpaceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  color: z.string().max(20).optional()
});

export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const spaces = await prisma.space.findMany({
    where: { userId: user.id }, // isolation: only this user's spaces
    include: { _count: { select: { projects: true } } },
    orderBy: { updatedAt: 'desc' }
  });

  return NextResponse.json({ spaces });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = CreateSpaceSchema.parse(await req.json());

  const space = await prisma.space.create({
    data: { userId: user.id, name: body.name, description: body.description, color: body.color }
  });

  await recordActivity({ userId: user.id, type: 'SPACE_CREATED', metadata: { spaceId: space.id, name: space.name } });

  return NextResponse.json({ space }, { status: 201 });
});
