import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';

export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const [spaceCount, projects, activityCount, activeDays, tutorQuestions, quizzesTaken] = await Promise.all([
    prisma.space.count({ where: { userId: user.id } }),
    prisma.project.findMany({ where: { userId: user.id }, include: { concepts: true } }),
    prisma.activity.count({ where: { userId: user.id } }),
    prisma.activity
      .findMany({ where: { userId: user.id }, select: { createdAt: true } })
      .then((rows) => new Set(rows.map((r) => r.createdAt.toISOString().slice(0, 10))).size),
    prisma.activity.count({ where: { userId: user.id, type: 'TUTOR_QUESTION_ASKED' } }),
    prisma.activity.count({ where: { userId: user.id, type: 'QUIZ_COMPLETED' } })
  ]);

  const allConcepts = projects.flatMap((p) => p.concepts);
  const overallMastery = allConcepts.length
    ? Math.round(allConcepts.reduce((s, c) => s + c.masteryPct, 0) / allConcepts.length)
    : 0;

  const byProject = projects
    .map((p) => ({
      name: p.name,
      mastery: p.concepts.length ? Math.round(p.concepts.reduce((s, c) => s + c.masteryPct, 0) / p.concepts.length) : 0
    }))
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 8);

  return NextResponse.json({
    overallLearning: { totalActivity: activityCount, activeDays, spaces: spaceCount, projects: projects.length },
    performance: {
      overallMastery,
      conceptsImproving: allConcepts.filter((c) => c.trend === 'IMPROVING').length,
      conceptsStable: allConcepts.filter((c) => c.trend === 'STABLE').length,
      conceptsNeedingAttention: allConcepts.filter((c) => c.trend === 'NEEDS_ATTENTION').length,
      byProject
    },
    aiUsage: { tutorQuestions, quizzesTaken }
  });
});
