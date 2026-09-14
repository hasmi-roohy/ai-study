'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { LogoMark, HomeIcon, GridIcon, ChartIcon, SettingsIcon, LogOutIcon } from '@/components/icons';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/spaces', label: 'Spaces', icon: GridIcon },
  { href: '/analytics', label: 'Analytics', icon: ChartIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const name = session?.user?.name ?? 'Learner';
  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between bg-ink-950 px-4 py-5 text-slate-300">
        <div>
          <Link href="/dashboard" className="flex items-center gap-2 px-2 pb-6">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-white">
              <LogoMark />
            </span>
            <span className="text-[15px] font-semibold text-white">Study Companion</span>
          </Link>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin"
                className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200"
              >
                <GridIcon className="h-[18px] w-[18px]" />
                Admin console
              </Link>
            )}
          </nav>
        </div>
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-700 text-sm font-semibold text-white">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{name}</p>
              <p className="truncate text-xs text-slate-500">Focused learner</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <LogOutIcon className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-white">
              <LogoMark className="h-4 w-4" />
            </span>
            Study Companion
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} className={`rounded-lg p-2 ${active ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}>
                  <Icon />
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}
