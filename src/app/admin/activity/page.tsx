'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { AdminPanel, AdminTable } from '@/components/admin/AdminUI';

interface ActivityRow {
  id: string;
  type: string;
  createdAt: string;
  user: string;
  project: string | null;
}

export default function AdminActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [typeCounts, setTypeCounts] = useState<{ type: string; count: number }[]>([]);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = filter ? `?type=${encodeURIComponent(filter)}` : '';
    apiFetch<{ activity: ActivityRow[]; typeCounts: { type: string; count: number }[] }>(`/api/admin/activity${qs}`)
      .then((r) => {
        setRows(r.activity);
        setTypeCounts(r.typeCounts);
      })
      .catch((err) => setError(err.message));
  }, [filter]);

  return (
    <div>
      <h1 className="mb-5 text-[15px] font-semibold text-[#E7EAF0]">Activity</h1>
      <AdminPanel title="Filter by type">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter(undefined)}
            className={`rounded-full border px-3 py-1 font-mono text-xs ${!filter ? 'border-[#4FB3C6] text-[#E7EAF0]' : 'border-[#232A38] text-[#7C8598]'}`}
          >
            all
          </button>
          {typeCounts.map((t) => (
            <button
              key={t.type}
              onClick={() => setFilter(t.type)}
              className={`rounded-full border px-3 py-1 font-mono text-xs ${
                filter === t.type ? 'border-[#4FB3C6] text-[#E7EAF0]' : 'border-[#232A38] text-[#7C8598]'
              }`}
            >
              {t.type.toLowerCase()} ({t.count})
            </button>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel title="Recent events">
        {error && <p className="text-sm text-[#E2685F]">{error}</p>}
        {!error && rows.length === 0 && <p className="text-sm text-[#7C8598]">No activity recorded.</p>}
        {rows.length > 0 && (
          <AdminTable head={['Type', 'User', 'Project', 'When']}>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#232A38]">
                <td className="py-1.5">{r.type.toLowerCase().replaceAll('_', ' ')}</td>
                <td className="font-sans">{r.user}</td>
                <td className="font-sans">{r.project ?? '—'}</td>
                <td className="text-[#7C8598]">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminPanel>
    </div>
  );
}
