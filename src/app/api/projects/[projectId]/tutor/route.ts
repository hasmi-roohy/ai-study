import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { assertProjectOwnership } from '@/lib/api/ownership';
import { askTutor } from '@/lib/ai/tutor';

const AskSchema = z.object({
  question: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional()
});

export const GET = withApiHandler(async (_req: NextRequest, context: { params: { projectId: string } | Promise<{ projectId: string }> }) => {
    const params = await context.params;
  const user = await requireUser();
  await assertProjectOwnership(params.projectId, user.id);

  const conversations = await prisma.conversation.findMany({
    where: { projectId: params.projectId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });

  return NextResponse.json({ conversations });
});

export const POST = withApiHandler(async (req: NextRequest, context: { params: { projectId: string } | Promise<{ projectId: string }> }) => {
    const params = await context.params;
  const user = await requireUser();
  await assertProjectOwnership(params.projectId, user.id);
  const body = AskSchema.parse(await req.json());

  const conversation = body.conversationId
    ? await prisma.conversation.findFirstOrThrow({ where: { id: body.conversationId, projectId: params.projectId } })
    : await prisma.conversation.create({ data: { projectId: params.projectId, userId: user.id } });

  const { message, error } = await askTutor({
    userId: user.id,
    projectId: params.projectId,
    conversationId: conversation.id,
    question: body.question
  });

  return NextResponse.json({ conversationId: conversation.id, message, error });
});
