'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/activity', label: 'Activity' },
  { href: '/admin/ai', label: 'AI Usage & Evaluation' },
  { href: '/admin/health', label: 'System Health' }
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-r border-[#232A38] py-6">
      <div className="mb-5 border-b border-[#232A38] px-5 pb-5">
        <p className="font-mono text-[13px] tracking-wide text-[#E7EAF0]">SYSTEM CONSOLE</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-block h-[7px] w-[7px] rounded-full bg-[#4FB3C6]" />
          <span className="text-[11px] text-[#7C8598]">Operational</span>
        </div>
      </div>
      <nav className="flex flex-col">
        {SECTIONS.map((s) => {
          const active = pathname === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`border-l-2 px-5 py-2.5 text-[13px] transition ${
                active
                  ? 'border-[#4FB3C6] bg-[#4FB3C6]/10 text-[#E7EAF0]'
                  : 'border-transparent text-[#7C8598] hover:text-[#C7CDDB]'
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 px-5">
        <Link href="/dashboard" className="text-[12px] text-[#7C8598] hover:text-[#C7CDDB]">
          ← Back to learner app
        </Link>
      </div>
    </aside>
  );
}
