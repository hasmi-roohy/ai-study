import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as { id: string; email: string; name?: string; role: 'USER' | 'ADMIN' };
}

/** Throws if there is no authenticated user; use at the top of every protected API route. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    const err: any = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return user;
}
