import './globals.css';
import Providers from '@/components/Providers';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata = {
  title: 'AI Study Companion',
  description: 'A persistent, contextual, measurable AI learning companion'
};

// This is a session-backed application. Rendering dynamically prevents Next from
// trying to pre-render protected routes and authenticated API handlers at build time.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
