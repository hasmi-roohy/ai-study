import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { assertProjectOwnership } from '@/lib/api/ownership';
import { startQuiz } from '@/lib/quiz/service';

export const POST = withApiHandler(async (_req: NextRequest, context: { params: { projectId: string } | Promise<{ projectId: string }> }) => {
    const params = await context.params;
  const user = await requireUser();
  await assertProjectOwnership(params.projectId, user.id);

  const { quiz, question } = await startQuiz({ userId: user.id, projectId: params.projectId });

  if (!question) {
    return NextResponse.json(
      { error: 'No concepts available yet — upload and process at least one material first.' },
      { status: 409 }
    );
  }

  return NextResponse.json({ quiz, question });
});
