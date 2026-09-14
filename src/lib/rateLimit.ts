// -----------------------------------------------------------------------------
// Rate limiting — in-memory sliding window
//
// Deliberately simple for this prototype's scale. Known limitation: state lives in
// process memory, so it resets on restart and does NOT share state across multiple
// server instances (relevant on Vercel, where each invocation can hit a different
// serverless instance — this limiter is best-effort there, not a hard guarantee).
// For real multi-instance rate limiting, swap this for Redis/Upstash — the
// checkRateLimit() call signature wouldn't need to change.
// -----------------------------------------------------------------------------

const attempts = new Map<string, number[]>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of attempts.entries()) {
      const recent = timestamps.filter((t) => now - t < 60 * 60 * 1000);
      if (recent.length === 0) attempts.delete(key);
      else attempts.set(key, recent);
    }
  }, 10 * 60 * 1000).unref?.();
}

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    attempts.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  attempts.set(key, timestamps);
  return true;
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}
