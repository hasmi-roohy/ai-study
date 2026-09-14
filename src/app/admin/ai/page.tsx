'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { AdminPanel, AdminStat } from '@/components/admin/AdminUI';

interface Overview {
  aiUsage: { totalRequests: number; avgLatencyMs: number; totalCostUsd: number; errorRate: number };
}
interface EvalRunSummary {
  id: string;
  promptVersion: string | null;
  createdAt: string;
  passRate: number;
  cases: number;
}
interface EvalSuite {
  suite: string;
  latest: EvalRunSummary;
  previous: EvalRunSummary | null;
  regression: boolean;
  history: EvalRunSummary[];
}

export default function AdminAIPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [suites, setSuites] = useState<EvalSuite[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<Overview>('/api/admin/overview'), apiFetch<{ suites: EvalSuite[] }>('/api/admin/evals')])
      .then(([o, e]) => {
        setOverview(o);
        setSuites(e.suites);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <AdminPanel><p className="text-sm text-[#E2685F]">{error}</p></AdminPanel>;

  return (
    <div>
      <h1 className="mb-5 text-[15px] font-semibold text-[#E7EAF0]">AI Usage & Evaluation</h1>

      {overview && (
        <AdminPanel title="Usage">
          <div className="flex flex-wrap gap-8">
            <AdminStat label="Total requests" value={overview.aiUsage.totalRequests} />
            <AdminStat label="Avg latency" value={`${overview.aiUsage.avgLatencyMs}ms`} />
            <AdminStat label="Est. cost" value={`$${overview.aiUsage.totalCostUsd}`} />
            <AdminStat label="Error rate" value={`${overview.aiUsage.errorRate}%`} />
          </div>
        </AdminPanel>
      )}

      <AdminPanel title="Evaluation suites">
        <p className="mb-3 text-xs text-[#7C8598]">
          Populated by <code className="font-mono">npm run eval</code> (src/eval/runEvals.ts). Each suite&apos;s latest run is
          compared against its previous run to surface regressions.
        </p>
        {suites.length === 0 && <p className="text-sm text-[#7C8598]">No evaluation runs yet — run the eval suite to populate this view.</p>}
        {suites.map((s) => (
          <div key={s.suite} className="mb-4 border-t border-[#232A38] pt-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[13px] text-[#E7EAF0]">{s.suite}</span>
              <span className="font-mono text-[13px]">{Math.round(s.latest.passRate * 100)}% pass</span>
              {s.previous && (
                <span className={`font-mono text-xs ${s.regression ? 'text-[#E2685F]' : 'text-[#4FB3C6]'}`}>
                  {s.regression ? '▼ regression vs previous run' : '▲ no regression'} (prev {Math.round(s.previous.passRate * 100)}%)
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[#7C8598]">
              {s.latest.cases} cases · {new Date(s.latest.createdAt).toLocaleString()}
              {s.latest.promptVersion ? ` · prompt ${s.latest.promptVersion}` : ''}
            </p>
          </div>
        ))}
      </AdminPanel>
    </div>
  );
}
