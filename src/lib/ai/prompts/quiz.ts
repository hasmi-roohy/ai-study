import { z } from 'zod';

export const QUIZ_GEN_PROMPT_VERSION = 'quiz-gen-v1';
export const GRADING_PROMPT_VERSION = 'grading-v1';

export const GeneratedQuestionSchema = z.object({
  prompt: z.string(),
  type: z.enum(['MULTIPLE_CHOICE', 'OPEN_ENDED']),
  options: z.array(z.string()).min(2).max(6).optional(), // required when type === MULTIPLE_CHOICE
  correctOption: z.string().optional()
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export function buildQuestionGenPrompt(params: {
  conceptName: string;
  conceptDescription?: string | null;
  difficulty: number; // 1-5
  type: 'MULTIPLE_CHOICE' | 'OPEN_ENDED';
  evidence: string[]; // relevant material excerpts to ground the question
  recentMistakes: string[]; // prior wrong answers on this concept, to avoid repeats and target the gap
}) {
  return [
    `Generate one ${params.type === 'MULTIPLE_CHOICE' ? 'multiple-choice' : 'open-ended'} quiz question testing the concept "${params.conceptName}".`,
    params.conceptDescription ? `Concept description: ${params.conceptDescription}` : '',
    `Target difficulty: ${params.difficulty}/5.`,
    params.recentMistakes.length
      ? `The learner previously struggled with: ${params.recentMistakes.join('; ')}. Target that gap if relevant.`
      : '',
    params.evidence.length ? `Ground the question in this material excerpt:\n${params.evidence.join('\n---\n')}` : '',
    params.type === 'MULTIPLE_CHOICE'
      ? 'Return JSON: { "prompt": string, "type": "MULTIPLE_CHOICE", "options": string[3-5], "correctOption": string (must exactly match one option) }'
      : 'Return JSON: { "prompt": string, "type": "OPEN_ENDED" }'
  ]
    .filter(Boolean)
    .join('\n');
}

export const GradingResultSchema = z.object({
  understandingScore: z.number().min(0).max(100),
  isCorrect: z.boolean(),
  missingConcepts: z.array(z.string()).default([]),
  feedbackText: z.string()
});
export type GradingResult = z.infer<typeof GradingResultSchema>;

export function buildGradingPrompt(params: { question: string; conceptName: string; learnerAnswer: string; evidence: string[] }) {
  return [
    `Grade this learner's open-ended answer for the concept "${params.conceptName}".`,
    `Question: ${params.question}`,
    `Learner's answer: ${params.learnerAnswer}`,
    params.evidence.length ? `Reference material:\n${params.evidence.join('\n---\n')}` : '',
    'Assess understanding, accuracy, and relevance. Note any missing concepts. Give constructive, specific feedback — not just a score.',
    'Return JSON: { "understandingScore": 0-100, "isCorrect": boolean, "missingConcepts": string[], "feedbackText": string }'
  ]
    .filter(Boolean)
    .join('\n');
}
