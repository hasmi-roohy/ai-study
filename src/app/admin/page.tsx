'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { AdminPanel, AdminStat } from '@/components/admin/AdminUI';

interface Overview {
  totals: { totalUsers: number; activeUsers: number; totalSpaces: number; totalProjects: number; materialsUploaded: number };
  activity: { tutorRequests: number; quizActivity: number };
  aiUsage: { totalRequests: number; avgLatencyMs: number; totalCostUsd: number; errorRate: number };
  backgroundJobs: { status: string; count: number }[];
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Overview>('/api/admin/overview').then(setOverview).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <AdminPanel title="Access error">
        <p className="text-sm text-[#E2685F]">{error}</p>
        <p className="mt-2 text-sm text-[#7C8598]">This console requires an ADMIN account.</p>
      </AdminPanel>
    );
  }

  if (!overview) return <AdminPanel><p className="text-sm text-[#7C8598]">Loading…</p></AdminPanel>;

  const backlog = overview.backgroundJobs.filter((j) => j.status === 'QUEUED' || j.status === 'RUNNING').reduce((s, j) => s + j.count, 0);

  return (
    <div>
      <h1 className="mb-5 text-[15px] font-semibold text-[#E7EAF0]">Platform snapshot</h1>
      <AdminPanel>
        <div className="flex flex-wrap gap-8">
          <AdminStat label="Total users" value={overview.totals.totalUsers} />
          <AdminStat label="Active (7d)" value={overview.totals.activeUsers} />
          <AdminStat label="Spaces" value={overview.totals.totalSpaces} />
          <AdminStat label="Projects" value={overview.totals.totalProjects} />
          <AdminStat label="Materials" value={overview.totals.materialsUploaded} />
          <AdminStat label="Processing backlog" value={backlog} />
        </div>
      </AdminPanel>

      <AdminPanel title="AI usage & quality">
        <div className="flex flex-wrap gap-8">
          <AdminStat label="AI requests" value={overview.aiUsage.totalRequests} />
          <AdminStat label="Avg latency" value={`${overview.aiUsage.avgLatencyMs}ms`} />
          <AdminStat label="Est. cost" value={`$${overview.aiUsage.totalCostUsd}`} />
          <AdminStat label="Error rate" value={`${overview.aiUsage.errorRate}%`} />
        </div>
      </AdminPanel>

      <AdminPanel title="Background jobs">
        <div className="flex flex-wrap gap-3">
          {overview.backgroundJobs.map((j) => (
            <span key={j.status} className="rounded-full border border-[#232A38] px-3 py-1 font-mono text-xs">
              {j.status.toLowerCase()}: {j.count}
            </span>
          ))}
        </div>
      </AdminPanel>
    </div>
  );
}
