'use client';

import { useSession, signOut } from 'next-auth/react';
import AppShell from '@/components/AppShell';

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <AppShell>
      <p className="eyebrow">Account</p>
      <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-slate-900">Settings</h1>
      <p className="mt-1.5 text-sm text-slate-500">Manage your profile and session.</p>

      <div className="surface mt-7 max-w-lg divide-y divide-slate-100">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Name</p>
            <p className="mt-0.5 text-sm font-medium text-slate-800">{session?.user?.name ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</p>
            <p className="mt-0.5 text-sm font-medium text-slate-800">{session?.user?.email ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Session</p>
            <p className="mt-0.5 text-sm text-slate-500">Sign out of Study Companion on this device.</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="secondary-button">Sign out</button>
        </div>
      </div>
    </AppShell>
  );
}
