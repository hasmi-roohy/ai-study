import { prisma } from '@/lib/db';

/**
 * PRD §25/§26: selection considers mastery, recent mistakes, and question history —
 * not just "wrong -> easier, right -> harder". A concept with low mastery that hasn't
 * been tested recently is prioritized; a concept tested repeatedly in this quiz already
 * is deprioritized even if its mastery is still low, to keep coverage broad.
 */
export async function selectNextConcept(projectId: string, quizId: string) {
  const [concepts, askedInThisQuiz] = await Promise.all([
    prisma.concept.findMany({ where: { projectId } }),
    prisma.assessmentQuestion.findMany({ where: { quizId }, select: { conceptId: true } })
  ]);

  if (concepts.length === 0) return null;

  const askedCounts = new Map<string, number>();
  for (const q of askedInThisQuiz) {
    if (!q.conceptId) continue;
    askedCounts.set(q.conceptId, (askedCounts.get(q.conceptId) ?? 0) + 1);
  }

  // Priority score: lower mastery = higher priority, penalized by how often already asked this quiz.
  const scored = concepts.map((c) => {
    const askedCount = askedCounts.get(c.id) ?? 0;
    const priority = (100 - c.masteryPct) - askedCount * 25;
    return { concept: c, priority };
  });

  scored.sort((a, b) => b.priority - a.priority);
  return scored[0].concept;
}

/** Maps current mastery to a target difficulty, keeping questions in a productive challenge zone. */
export function selectDifficulty(masteryPct: number): number {
  if (masteryPct < 30) return 1;
  if (masteryPct < 50) return 2;
  if (masteryPct < 70) return 3;
  if (masteryPct < 85) return 4;
  return 5;
}

/**
 * Mastery update: a single question shifts mastery gradually (not a jump to 0/100),
 * weighted by how difficult the question was — a correct hard answer moves mastery
 * more than a correct easy one.
 */
export function computeMasteryUpdate(params: {
  currentMastery: number;
  difficulty: number; // 1-5
  scored: number; // 0-100 (100 for MCQ correct, 0 for MCQ incorrect, or the AI understanding score for open-ended)
}): number {
  const weight = 4 + params.difficulty * 2; // harder questions move mastery more, in either direction
  const delta = ((params.scored - 50) / 50) * weight;
  return Math.max(0, Math.min(100, Math.round(params.currentMastery + delta)));
}

export function computeTrend(previousMastery: number, currentMastery: number): 'IMPROVING' | 'STABLE' | 'NEEDS_ATTENTION' {
  const diff = currentMastery - previousMastery;
  if (diff >= 5) return 'IMPROVING';
  if (diff <= -5) return 'NEEDS_ATTENTION';
  return 'STABLE';
}
