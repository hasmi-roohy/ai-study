'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6">
              An unexpected error occurred. This has been logged &mdash; please try again.
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
