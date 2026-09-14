'use client';

import { useEffect } from 'react';
import { AlertIcon } from '@/components/icons';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled UI error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-100 text-red-600">
        <AlertIcon className="h-6 w-6" />
      </span>
      <h1 className="mt-5 text-lg font-semibold text-slate-800">Something went wrong</h1>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">
        This page hit an unexpected error. You can try again, or head back to Home.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="primary-button">Try again</button>
        <a href="/dashboard" className="secondary-button">Back to Home</a>
      </div>
    </div>
  );
}
