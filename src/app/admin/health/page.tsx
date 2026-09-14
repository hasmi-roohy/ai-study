'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { AdminPanel, AdminStat } from '@/components/admin/AdminUI';

interface Health {
  database: { healthy: boolean };
  aiProvider: { requestsLastHour: number; errorRatePct: number; avgLatencyMs: number };
  backgroundJobs: { byStatus: { status: string; count: number }[]; recentFailures: { id: string; type: string; lastError: string | null; attempts: number; completedAt: string | null }[] };
  materialProcessing: { byStatus: { status: string; count: number }[] };
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Health>('/api/admin/health').then(setHealth).catch((err) => setError(err.message));
  }, []);

  if (error) return <AdminPanel><p className="text-sm text-[#E2685F]">{error}</p></AdminPanel>;
  if (!health) return <AdminPanel><p className="text-sm text-[#7C8598]">Loading…</p></AdminPanel>;

  const operational = health.database.healthy && health.aiProvider.errorRatePct < 20;

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <h1 className="text-[15px] font-semibold text-[#E7EAF0]">System Health</h1>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-mono ${operational ? 'bg-[#4FB3C6]/15 text-[#4FB3C6]' : 'bg-[#E2685F]/15 text-[#E2685F]'}`}>
          {operational ? 'operational' : 'attention needed'}
        </span>
      </div>

      <AdminPanel title="Core services">
        <div className="flex flex-wrap gap-8">
          <AdminStat label="Database" value={health.database.healthy ? 'healthy' : 'unreachable'} />
          <AdminStat label="AI requests (1h)" value={health.aiProvider.requestsLastHour} />
          <AdminStat label="AI error rate (1h)" value={`${health.aiProvider.errorRatePct}%`} />
          <AdminStat label="Avg AI latency (1h)" value={`${health.aiProvider.avgLatencyMs}ms`} />
        </div>
      </AdminPanel>

      <AdminPanel title="Background jobs">
        <div className="mb-3 flex flex-wrap gap-3">
          {health.backgroundJobs.byStatus.map((j) => (
            <span key={j.status} className="rounded-full border border-[#232A38] px-3 py-1 font-mono text-xs">
              {j.status.toLowerCase()}: {j.count}
            </span>
          ))}
        </div>
        {health.backgroundJobs.recentFailures.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-[#7C8598]">Recent failures</p>
            {health.backgroundJobs.recentFailures.map((f) => (
              <div key={f.id} className="border-t border-[#232A38] py-1.5 font-mono text-xs text-[#E2685F]">
                {f.type} — {f.lastError ?? 'unknown error'} ({f.attempts} attempts)
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminPanel title="Material processing backlog">
        <div className="flex flex-wrap gap-8">
          {health.materialProcessing.byStatus.map((m) => (
            <AdminStat key={m.status} label={m.status.toLowerCase()} value={m.count} />
          ))}
        </div>
      </AdminPanel>
    </div>
  );
}
