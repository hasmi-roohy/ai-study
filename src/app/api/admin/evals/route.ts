import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';

/**
 * Surfaces EvalRun/EvalResult rows (written by `npm run eval`, see src/eval/runEvals.ts)
 * in the Admin dashboard, per PRD §46 (AI Evaluation) and §47 (Evaluation & Regression).
 * Groups the most recent runs by suite and compares each to the previous run for that
 * suite so a regression is visible without re-running anything.
 */
export const GET = withApiHandler(async () => {
  await requireAdmin();

  const runs = await prisma.evalRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: { results: true }
  });

  const bySuite = new Map<string, typeof runs>();
  for (const run of runs) {
    const list = bySuite.get(run.suite) ?? [];
    list.push(run);
    bySuite.set(run.suite, list);
  }

  const suites = Array.from(bySuite.entries()).map(([suite, suiteRuns]) => {
    const withPassRate = suiteRuns.map((r) => ({
      id: r.id,
      promptVersion: r.promptVersion,
      createdAt: r.createdAt,
      passRate: r.results.length ? r.results.filter((x) => x.passed).length / r.results.length : 0,
      cases: r.results.length
    }));
    const [latest, previous] = withPassRate;
    return {
      suite,
      latest,
      previous: previous ?? null,
      regression: previous ? latest.passRate < previous.passRate : false,
      history: withPassRate.slice(0, 10)
    };
  });

  return NextResponse.json({ suites });
});
