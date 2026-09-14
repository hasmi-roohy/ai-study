import { JetBrains_Mono } from 'next/font/google';
import AdminNav from '@/components/admin/AdminNav';

const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-mono' });

/**
 * The Admin console intentionally looks and feels like a different tool from the
 * learner-facing app: dark background, sidebar navigation, monospace data — an
 * operator console rather than another product tab. It reuses the same API routes
 * and data as the rest of the app; only the presentation layer differs.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${mono.variable} min-h-screen bg-[#0A0D12] text-[#C7CDDB]`}>
      <div className="mx-auto flex max-w-6xl">
        <AdminNav />
        <main className="min-w-0 flex-1 px-8 py-8">
          <p className="mb-6 font-mono text-[11px] text-[#E0A458]">
            NOTE — demo data isolation only: cross-user visibility here relies on the ADMIN role check in
            requireAdmin(), not a separate infrastructure boundary.
          </p>
          {children}
        </main>
      </div>
    </div>
  );
}
