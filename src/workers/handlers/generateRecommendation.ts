import { prisma } from '@/lib/db';
import { generateStructured } from '@/lib/ai/provider';
import { z } from 'zod';

const RecommendationSchema = z.object({
  text: z.string(),
  focusConcepts: z.array(z.string()).max(3)
});

/**
 * PRD §32/§33: triggered by meaningful events (material processed, quiz completed,
 * repeated mistake detected) rather than on a fixed schedule — keeps recommendations
 * fresh without unnecessary AI spend.
 */
export async function generateRecommendation(payload: { projectId: string }) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: payload.projectId },
    include: { concepts: true }
  });

  if (project.concepts.length === 0) return; // nothing to recommend yet

  const weakConcepts = [...project.concepts].sort((a, b) => a.masteryPct - b.masteryPct).slice(0, 3);

  const result = await generateStructured({
    system:
      'You generate one short, specific, actionable study recommendation for a learner based on their current concept mastery. Be concrete, not generic.',
    prompt: `Project goal: ${project.goal ?? 'not specified'}\n\nConcept mastery:\n${project.concepts
      .map((c) => `- ${c.name}: ${c.masteryPct}% (trend: ${c.trend})`)
      .join(
        '\n'
      )}\n\nFocus on the weakest concepts: ${weakConcepts.map((c) => c.name).join(', ')}.\n\nReturn JSON: { "text": string, "focusConcepts": string[] (max 3 concept names) } — a single object, not a bare array.`,
    schema: RecommendationSchema,
    ctx: { feature: 'RECOMMENDATION', promptVersion: 'recommendation-v2' }
  });

  await prisma.recommendation.create({
    data: {
      projectId: project.id,
      text: result.text,
      reason: { focusConcepts: result.focusConcepts, weakConceptsAtGeneration: weakConcepts.map((c) => c.name) }
    }
  });
}
