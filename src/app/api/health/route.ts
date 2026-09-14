import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** Public health check for uptime monitors. Unauthenticated by design — minimal info only. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (err) {
    console.error('Health check failed:', err);
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
