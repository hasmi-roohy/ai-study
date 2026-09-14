import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Wraps a route handler so every API route gets the same error shape and status mapping,
 * instead of each route re-implementing try/catch (PRD §71: consistent response patterns).
 */
export function withApiHandler<Args extends unknown[]>(fn: (...args: Args) => Promise<NextResponse>) {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err: any) {
      if (err instanceof ZodError) {
        return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 });
      }
      const status = err?.status ?? 500;
      if (status === 500) console.error('Unhandled API error:', err);
      return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status });
    }
  };
}
