import { NextRequest, NextResponse } from 'next/server';
import { processJobBatch } from '@/lib/jobs/runner';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Vercel has no persistent background process — there's no equivalent of
 * `npm run worker` running 24/7. Instead, an external scheduler (e.g. cron-job.org,
 * free, supports sub-minute intervals — Vercel's own free Cron is capped at once/day)
 * hits this URL every 1-2 minutes. Each hit drains a small batch of the job queue.
 *
 * Protected by a shared secret (CRON_SECRET) since this has no user session.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured on the server' }, { status: 500 });
  }

  const provided = req.nextUrl.searchParams.get('secret') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processJobBatch({ maxJobs: 20, timeBudgetMs: 55_000 });

  return NextResponse.json({ ok: true, ...result });
}
