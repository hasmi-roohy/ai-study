import Groq from 'groq-sdk';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// -----------------------------------------------------------------------------
// AI Provider Abstraction — backed by Groq
//
// Why this exists (see PRD §41 AI Model & Provider Abstraction):
// - No other module should import `groq-sdk` directly. Everything goes through
//   generateText / generateStructured / embedText below.
// - This is where usage tracking (§43), latency, and failure handling (§49)
//   live, so every AI feature gets those "for free" instead of re-implementing them.
// - Swapping models/providers later means changing this file, not the app.
// -----------------------------------------------------------------------------

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const MODELS = {
  // Large, capable model for Tutor answers, quiz generation, grading, recommendations.
  // NOTE: was 'llama-3.3-70b-versatile' — Groq decommissioned that model (and the
  // 'fast' model below) on 2026-08-16. Every generateText/generateStructured call was
  // failing with a `model_decommissioned` error until this was updated. See
  // https://console.groq.com/docs/deprecations
  primary: 'openai/gpt-oss-120b',
  // Smaller/faster model — useful for cheap, low-latency tasks (e.g. concept extraction).
  fast: 'openai/gpt-oss-20b'
} as const;

// Rough per-model $/1M token pricing (Groq, as of Sept 2026) used only for cost *estimates*
// in the observability views. Update if Groq's published pricing changes.
const PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  'openai/gpt-oss-120b': { input: 0.15, output: 0.6 },
  'openai/gpt-oss-20b': { input: 0.05, output: 0.08 }
};

interface UsageContext {
  userId?: string;
  feature: string; // TUTOR | QUIZ_GENERATION | GRADING | RECOMMENDATION | CONCEPT_EXTRACTION | EVALUATION
  promptVersion?: string;
}

async function logUsage(params: {
  ctx: UsageContext;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}) {
  const pricing = PRICING_PER_1M[params.model];
  const costUsd = pricing
    ? ((params.inputTokens ?? 0) / 1_000_000) * pricing.input +
      ((params.outputTokens ?? 0) / 1_000_000) * pricing.output
    : undefined;

  try {
    await prisma.aIUsageLog.create({
      data: {
        userId: params.ctx.userId,
        feature: params.ctx.feature,
        model: params.model,
        promptVersion: params.ctx.promptVersion,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        latencyMs: params.latencyMs,
        costUsd,
        success: params.success,
        errorMessage: params.errorMessage
      }
    });
  } catch (e) {
    // Observability must never break the primary request path.
    console.error('Failed to log AI usage', e);
  }
}

// -----------------------------------------------------------------------------
// Spend cap circuit breaker
//
// Tracking cost isn't the same as bounding it — a bug in a retry loop or a bad actor
// could otherwise run the bill up with nothing stopping it. This checks the last 24h
// of logged spend against a configurable cap before every call. The check result is
// cached briefly so it doesn't add a DB round-trip to every single AI call.
// -----------------------------------------------------------------------------

const DAILY_SPEND_CAP_USD = Number(process.env.DAILY_AI_SPEND_CAP_USD ?? '10');
let cachedSpendCheck: { checkedAt: number; totalUsd: number } | null = null;
const SPEND_CHECK_CACHE_MS = 30_000;

async function assertUnderSpendCap() {
  if (!DAILY_SPEND_CAP_USD || DAILY_SPEND_CAP_USD <= 0) return; // cap disabled

  const now = Date.now();
  if (!cachedSpendCheck || now - cachedSpendCheck.checkedAt > SPEND_CHECK_CACHE_MS) {
    const since = new Date(now - 24 * 60 * 60 * 1000);
    const result = await prisma.aIUsageLog.aggregate({
      _sum: { costUsd: true },
      where: { createdAt: { gte: since } }
    });
    cachedSpendCheck = { checkedAt: now, totalUsd: result._sum.costUsd ?? 0 };
  }

  if (cachedSpendCheck.totalUsd >= DAILY_SPEND_CAP_USD) {
    throw new Error(
      `AI spend cap reached ($${DAILY_SPEND_CAP_USD}/24h). New AI requests are paused. Set DAILY_AI_SPEND_CAP_USD to adjust.`
    );
  }
}

/** Plain text generation (used for streaming-style Tutor responses). */
export async function generateText(params: {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  ctx: UsageContext;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  await assertUnderSpendCap();
  const model = params.model ?? MODELS.primary;
  const start = Date.now();
  try {
    const resp = await client.chat.completions.create({
      model,
      max_tokens: params.maxTokens ?? 1024,
      messages: [{ role: 'system', content: params.system }, ...params.messages]
    });
    const text = resp.choices[0]?.message?.content ?? '';
    await logUsage({
      ctx: params.ctx,
      model,
      inputTokens: resp.usage?.prompt_tokens,
      outputTokens: resp.usage?.completion_tokens,
      latencyMs: Date.now() - start,
      success: true
    });
    return text;
  } catch (err: any) {
    await logUsage({
      ctx: params.ctx,
      model,
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: err?.message ?? 'unknown error'
    });
    throw err;
  }
}

/**
 * Structured generation: forces JSON output (via Groq's JSON mode) and validates it
 * against a zod schema before returning. Application code should NEVER trust raw AI
 * JSON without this. (See PRD §42 Structured AI Outputs.)
 */
export async function generateStructured<T>(params: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  ctx: UsageContext;
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  await assertUnderSpendCap();
  const model = params.model ?? MODELS.primary;
  const start = Date.now();
  const systemWithFormat = `${params.system}\n\nRespond with ONLY valid JSON matching the required shape. No markdown fences, no preamble, no commentary.`;

  try {
    const resp = await client.chat.completions.create({
      model,
      max_tokens: params.maxTokens ?? 1024,
      response_format: { type: 'json_object' }, // Groq JSON mode — guarantees syntactically valid JSON
      messages: [
        { role: 'system', content: systemWithFormat },
        { role: 'user', content: params.prompt }
      ]
    });

    const raw = (resp.choices[0]?.message?.content ?? '').replace(/```json|```/g, '').trim();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      throw new Error(`AI returned non-JSON output: ${raw.slice(0, 200)}`);
    }

    const validated = params.schema.safeParse(parsedJson);
    if (!validated.success) {
      throw new Error(`AI JSON failed schema validation: ${validated.error.message}`);
    }

    await logUsage({
      ctx: params.ctx,
      model,
      inputTokens: resp.usage?.prompt_tokens,
      outputTokens: resp.usage?.completion_tokens,
      latencyMs: Date.now() - start,
      success: true
    });
    return validated.data;
  } catch (err: any) {
    await logUsage({
      ctx: params.ctx,
      model,
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: err?.message ?? 'unknown error'
    });
    throw err;
  }
}

/**
 * Embeddings — Gemini (Google AI Studio), since Groq has no first-party embeddings endpoint.
 * Kept isolated in this one module, same as generateText/generateStructured, so retrieval
 * code never needs to know which provider is behind it.
 *
 * Uses gemini-embedding-001 directly over REST (no SDK dependency needed) with a free
 * Google AI Studio API key — see GEMINI_API_KEY in .env.example. Free tier: 100 requests/
 * min, 1,000 requests/day, no billing account required (as of Sept 2026).
 */
const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const GEMINI_EMBEDDING_DIMENSIONS = 768; // Matryoshka-truncated; good quality/storage tradeoff for a prototype
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_BATCH_SIZE = 100; // Gemini's batchEmbedContents cap per call

export type EmbeddingTaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';

function requireGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com and add it to .env.'
    );
  }
  return key;
}

/** Embed a single piece of text (e.g. one Tutor question at query time). */
export async function embedText(
  text: string,
  ctx: UsageContext,
  taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT'
): Promise<number[]> {
  await assertUnderSpendCap();
  const key = requireGeminiKey();
  const start = Date.now();
  try {
    const resp = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS
        })
      }
    );
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Gemini embedContent failed (${resp.status}): ${errBody.slice(0, 300)}`);
    }
    const data = await resp.json();
    const values: number[] | undefined = data?.embedding?.values;
    if (!values) throw new Error('Gemini embedContent returned no embedding values');

    await logUsage({
      ctx,
      model: GEMINI_EMBEDDING_MODEL,
      latencyMs: Date.now() - start,
      success: true
    });
    return values;
  } catch (err: any) {
    await logUsage({
      ctx,
      model: GEMINI_EMBEDDING_MODEL,
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: err?.message ?? 'unknown error'
    });
    throw err;
  }
}

/**
 * Embed many chunks in as few requests as possible (e.g. all chunks of a freshly-uploaded
 * material) using Gemini's batchEmbedContents endpoint. Batches internally at
 * GEMINI_BATCH_SIZE since Gemini caps requests-per-call.
 */
export async function embedTexts(
  texts: string[],
  ctx: UsageContext,
  taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> {
  if (texts.length === 0) return [];
  await assertUnderSpendCap();
  const key = requireGeminiKey();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += GEMINI_BATCH_SIZE) {
    const batch = texts.slice(i, i + GEMINI_BATCH_SIZE);
    const start = Date.now();
    try {
      const resp = await fetch(
        `${GEMINI_API_BASE}/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${GEMINI_EMBEDDING_MODEL}`,
              content: { parts: [{ text }] },
              taskType,
              outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS
            }))
          })
        }
      );
      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Gemini batchEmbedContents failed (${resp.status}): ${errBody.slice(0, 300)}`);
      }
      const data = await resp.json();
      const embeddings: { values: number[] }[] | undefined = data?.embeddings;
      if (!embeddings || embeddings.length !== batch.length) {
        throw new Error('Gemini batchEmbedContents returned an unexpected number of embeddings');
      }

      await logUsage({
        ctx,
        model: GEMINI_EMBEDDING_MODEL,
        latencyMs: Date.now() - start,
        success: true
      });
      results.push(...embeddings.map((e) => e.values));
    } catch (err: any) {
      await logUsage({
        ctx,
        model: GEMINI_EMBEDDING_MODEL,
        latencyMs: Date.now() - start,
        success: false,
        errorMessage: err?.message ?? 'unknown error'
      });
      throw err;
    }
  }

  return results;
}
