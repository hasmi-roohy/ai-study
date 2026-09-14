import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { assertProjectOwnership } from '@/lib/api/ownership';
import { submitAnswer } from '@/lib/quiz/service';

const AnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string().min(1).max(5000)
});

export const POST = withApiHandler(
  async (req: NextRequest, context: { params: { projectId: string; quizId: string } | Promise<{ projectId: string; quizId: string }> }) => {
    const params = await context.params;
    const user = await requireUser();
    await assertProjectOwnership(params.projectId, user.id);
    const body = AnswerSchema.parse(await req.json());

    const result = await submitAnswer({
      userId: user.id,
      quizId: params.quizId,
      questionId: body.questionId,
      answer: body.answer
    });

    return NextResponse.json(result);
  }
);
