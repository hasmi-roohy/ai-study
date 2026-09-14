import { processJobBatch } from '@/lib/jobs/runner';

const POLL_INTERVAL_MS = 2000;

/**
 * For local development only. On Vercel (serverless, no persistent process), don't run
 * this — use the /api/cron/process-jobs endpoint instead, triggered by an external
 * scheduler. See docs/DEPLOYMENT.md.
 */
async function main() {
  console.log('Worker started. Polling for jobs every', POLL_INTERVAL_MS, 'ms');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await processJobBatch({ maxJobs: 1 });
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
