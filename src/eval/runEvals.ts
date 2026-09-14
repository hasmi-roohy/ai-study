import { prisma } from '@/lib/db';
import { generateStructured } from '@/lib/ai/provider';
import { TutorResponseSchema, buildTutorSystemPrompt, buildTutorUserPrompt, TUTOR_PROMPT_VERSION } from '@/lib/ai/prompts/tutor';
import { GradingResultSchema, buildGradingPrompt, GRADING_PROMPT_VERSION } from '@/lib/ai/prompts/quiz';
import { TUTOR_GROUNDEDNESS_CASES, GRADING_QUALITY_CASES } from '@/eval/cases';

/**
 * PRD §47 Evaluation & Regression: run curated cases, store pass/fail + score per case
 * under an EvalRun, and print a comparison against the immediately previous run for
 * the same suite so a regression is visible without a dedicated dashboard.
 */
async function runTutorGroundednessSuite() {
  const suite = 'TUTOR_GROUNDEDNESS';
  const run = await prisma.evalRun.create({ data: { suite, promptVersion: TUTOR_PROMPT_VERSION } });

  for (const testCase of TUTOR_GROUNDEDNESS_CASES) {
    const evalCase = await prisma.evalCase.create({
      data: { suite, input: testCase as any }
    });

    let passed = false;
    let details: any = {};
    try {
      const result = await generateStructured({
        system: buildTutorSystemPrompt({ projectGoal: null }),
        prompt: buildTutorUserPrompt({
          question: testCase.question,
          evidence: testCase.evidence.map((content, i) => ({ chunkId: `eval-${i}`, filename: 'eval-fixture', page: null, content })),
          learnerContext: [],
          recentMessages: []
        }),
        schema: TutorResponseSchema,
        ctx: { feature: 'EVALUATION', promptVersion: TUTOR_PROMPT_VERSION }
      });
      passed = result.grounded === testCase.expect.grounded;
      details = { actual: result.grounded, expected: testCase.expect.grounded, answer: result.answer };
    } catch (err: any) {
      details = { error: err?.message };
    }

    await prisma.evalResult.create({
      data: { runId: run.id, caseId: evalCase.id, passed, score: passed ? 1 : 0, details }
    });
  }

  return summarizeRun(run.id, suite);
}

async function runGradingQualitySuite() {
  const suite = 'GRADING_QUALITY';
  const run = await prisma.evalRun.create({ data: { suite, promptVersion: GRADING_PROMPT_VERSION } });

  for (const testCase of GRADING_QUALITY_CASES) {
    const evalCase = await prisma.evalCase.create({ data: { suite, input: testCase as any } });

    let passed = false;
    let details: any = {};
    try {
      const result = await generateStructured({
        system: 'You are a fair, encouraging grader for open-ended learning assessments.',
        prompt: buildGradingPrompt({
          question: testCase.question,
          conceptName: testCase.concept,
          learnerAnswer: testCase.learnerAnswer,
          evidence: []
        }),
        schema: GradingResultSchema,
        ctx: { feature: 'EVALUATION', promptVersion: GRADING_PROMPT_VERSION }
      });

      const correctnessMatches = result.isCorrect === testCase.expect.isCorrectAtLeast;
      const scoreInRange =
        'minUnderstanding' in testCase.expect
          ? result.understandingScore >= (testCase.expect as any).minUnderstanding
          : result.understandingScore <= (testCase.expect as any).maxUnderstanding;

      passed = correctnessMatches && scoreInRange;
      details = { actual: result, expected: testCase.expect };
    } catch (err: any) {
      details = { error: err?.message };
    }

    await prisma.evalResult.create({
      data: { runId: run.id, caseId: evalCase.id, passed, score: passed ? 1 : 0, details }
    });
  }

  return summarizeRun(run.id, suite);
}

async function summarizeRun(runId: string, suite: string) {
  const results = await prisma.evalResult.findMany({ where: { runId } });
  const passRate = results.length ? results.filter((r) => r.passed).length / results.length : 0;

  const previousRun = await prisma.evalRun.findFirst({
    where: { suite, id: { not: runId } },
    orderBy: { createdAt: 'desc' }
  });

  let regression = false;
  let previousPassRate: number | null = null;
  if (previousRun) {
    const previousResults = await prisma.evalResult.findMany({ where: { runId: previousRun.id } });
    previousPassRate = previousResults.length ? previousResults.filter((r) => r.passed).length / previousResults.length : 0;
    regression = passRate < previousPassRate;
  }

  return { suite, runId, passRate, previousPassRate, regression };
}

async function main() {
  const results = await Promise.all([runTutorGroundednessSuite(), runGradingQualitySuite()]);
  for (const r of results) {
    console.log(
      `[${r.suite}] pass rate: ${(r.passRate * 100).toFixed(0)}%` +
        (r.previousPassRate != null ? ` (previous: ${(r.previousPassRate * 100).toFixed(0)}%)` : '') +
        (r.regression ? '  ⚠️  REGRESSION' : '')
    );
  }
}

if (require.main === module) {
  main().finally(() => prisma.$disconnect());
}
