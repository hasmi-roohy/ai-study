'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogoMark, AlertIcon } from '@/components/icons';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password.');
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500 text-white shadow-sm">
            <LogoMark className="h-6 w-6" />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-slate-900">Study Companion</p>
        </div>

        <form onSubmit={handleSubmit} className="surface p-7">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue your learning journey.</p>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="mb-1.5 mt-6 block text-sm font-medium text-slate-700">Email</label>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-control" />

          <label className="mb-1.5 mt-4 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-control"
          />

          <button type="submit" disabled={loading} className="primary-button mt-6 w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            No account? <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
