import Link from 'next/link';
import { LogoMark } from '@/components/icons';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500 text-white shadow-sm">
        <LogoMark className="h-6 w-6" />
      </span>
      <p className="mt-5 text-6xl font-semibold tracking-tight text-slate-900">404</p>
      <h1 className="mt-2 text-lg font-semibold text-slate-800">Page not found</h1>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist, or you may not have access to it.
      </p>
      <Link href="/dashboard" className="primary-button mt-6">Back to Home</Link>
    </div>
  );
}
