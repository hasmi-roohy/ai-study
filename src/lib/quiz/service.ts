import { prisma } from '@/lib/db';
import { generateStructured } from '@/lib/ai/provider';
import {
  GeneratedQuestionSchema,
  GradingResultSchema,
  QUIZ_GEN_PROMPT_VERSION,
  GRADING_PROMPT_VERSION,
  buildQuestionGenPrompt,
  buildGradingPrompt
} from '@/lib/ai/prompts/quiz';
import { selectNextConcept, selectDifficulty, computeMasteryUpdate, computeTrend } from '@/lib/quiz/adaptive';
import { retrieveRelevantChunks } from '@/lib/retrieval/search';
import { recordActivity } from '@/lib/activity';
import { enqueueJob } from '@/lib/jobs/queue';

const QUESTIONS_PER_QUIZ = 6;

export async function startQuiz(params: { userId: string; projectId: string }) {
  const quiz = await prisma.quiz.create({ data: { projectId: params.projectId, userId: params.userId } });
  const question = await generateNextQuestion(params.projectId, quiz.id);
  await recordActivity({ userId: params.userId, projectId: params.projectId, type: 'QUIZ_STARTED', metadata: { quizId: quiz.id } });
  return { quiz, question };
}

async function generateNextQuestion(projectId: string, quizId: string) {
  const concept = await selectNextConcept(projectId, quizId);
  if (!concept) return null;

  const difficulty = selectDifficulty(concept.masteryPct);
  const type: 'MULTIPLE_CHOICE' | 'OPEN_ENDED' = Math.random() < 0.6 ? 'MULTIPLE_CHOICE' : 'OPEN_ENDED';

  const [evidence, recentMistakes] = await Promise.all([
    retrieveRelevantChunks({ projectId, query: concept.name, topK: 2 }),
    prisma.assessmentQuestion.findMany({
      where: { conceptId: concept.id, isCorrect: false },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { prompt: true }
    })
  ]);

  const generated = await generateStructured({
    system: 'You write clear, focused quiz questions for a learning platform. Avoid ambiguity.',
    prompt: buildQuestionGenPrompt({
      conceptName: concept.name,
      conceptDescription: concept.description,
      difficulty,
      type,
      evidence: evidence.map((e) => e.content),
      recentMistakes: recentMistakes.map((m) => m.prompt)
    }),
    schema: GeneratedQuestionSchema,
    ctx: { feature: 'QUIZ_GENERATION', promptVersion: QUIZ_GEN_PROMPT_VERSION }
  });

  return prisma.assessmentQuestion.create({
    data: {
      quizId,
      conceptId: concept.id,
      type: generated.type,
      difficulty,
      prompt: generated.prompt,
      options: generated.options,
      correctOption: generated.correctOption
    },
    include: { concept: true }
  });
}

export async function submitAnswer(params: {
  userId: string;
  quizId: string;
  questionId: string;
  answer: string;
}) {
  const question = await prisma.assessmentQuestion.findFirstOrThrow({
    where: { id: params.questionId, quizId: params.quizId },
    include: { concept: true, quiz: true }
  });

  let isCorrect: boolean;
  let scored: number;
  let feedback: { understanding?: number; missingConcepts?: string[]; feedbackText: string };

  if (question.type === 'MULTIPLE_CHOICE') {
    isCorrect = params.answer.trim() === question.correctOption?.trim();
    scored = isCorrect ? 100 : 0;
    feedback = { feedbackText: isCorrect ? 'Correct!' : `Not quite — the correct answer was "${question.correctOption}".` };
  } else {
    const evidence = question.conceptId
      ? (await retrieveRelevantChunks({ projectId: question.quiz.projectId, query: question.prompt, topK: 2 })).map((e) => e.content)
      : [];
    const graded = await generateStructured({
      system: 'You are a fair, encouraging grader for open-ended learning assessments.',
      prompt: buildGradingPrompt({
        question: question.prompt,
        conceptName: question.concept?.name ?? 'the concept',
        learnerAnswer: params.answer,
        evidence
      }),
      schema: GradingResultSchema,
      ctx: { feature: 'GRADING', promptVersion: GRADING_PROMPT_VERSION }
    });
    isCorrect = graded.isCorrect;
    scored = graded.understandingScore;
    feedback = { understanding: graded.understandingScore, missingConcepts: graded.missingConcepts, feedbackText: graded.feedbackText };
  }

  await prisma.assessmentQuestion.update({
    where: { id: question.id },
    data: { userAnswer: params.answer, isCorrect, aiFeedback: feedback as any, answeredAt: new Date() }
  });

  let updatedConcept = null;
  if (question.concept) {
    const newMastery = computeMasteryUpdate({ currentMastery: question.concept.masteryPct, difficulty: question.difficulty, scored });
    const trend = computeTrend(question.concept.masteryPct, newMastery);
    updatedConcept = await prisma.concept.update({
      where: { id: question.concept.id },
      data: { previousMasteryPct: question.concept.masteryPct, masteryPct: newMastery, trend }
    });
  }

  const answeredCount = await prisma.assessmentQuestion.count({ where: { quizId: params.quizId, answeredAt: { not: null } } });
  const isQuizComplete = answeredCount >= QUESTIONS_PER_QUIZ;

  let nextQuestion = null;
  if (!isQuizComplete) {
    nextQuestion = await generateNextQuestion(question.quiz.projectId, params.quizId);
  } else {
    await completeQuiz(question.quiz.id, question.quiz.projectId, params.userId);
  }

  return { isCorrect, feedback, updatedConcept, nextQuestion, isQuizComplete };
}

async function completeQuiz(quizId: string, projectId: string, userId: string) {
  const questions = await prisma.assessmentQuestion.findMany({ where: { quizId } });
  const correctCount = questions.filter((q) => q.isCorrect).length;
  const accuracy = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  await prisma.quiz.update({ where: { id: quizId }, data: { status: 'COMPLETED', completedAt: new Date() } });
  await prisma.assessment.create({
    data: {
      projectId,
      quizId,
      summary: {
        accuracy,
        totalQuestions: questions.length,
        conceptsCovered: [...new Set(questions.map((q) => q.conceptId).filter(Boolean))]
      }
    }
  });

  await recordActivity({ userId, projectId, type: 'QUIZ_COMPLETED', metadata: { quizId, accuracy } });

  // Event-driven follow-up (PRD §33): a completed quiz may surface a new recommendation.
  await enqueueJob({
    type: 'GENERATE_RECOMMENDATION',
    payload: { projectId },
    idempotencyKey: `reco:${projectId}:quiz:${quizId}`
  });
}
