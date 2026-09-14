'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface AnalyticsData {
  performance: { avgAccuracy: number | null; conceptsMastered: number; conceptsNeedingAttention: number; totalConcepts: number };
  growth: { masteryTrend: { concept: string; previous: number; current: number; trend: string }[] };
  activity: { byType: { type: string; count: number }[] };
  aiActivity: { tutorQuestions: number };
}

const TREND_COLOR: Record<string, string> = {
  IMPROVING: '#059669',
  STABLE: '#94a3b8',
  NEEDS_ATTENTION: '#d97706'
};

const ACTIVITY_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0ea5e9', '#ef4444'];

export default function AnalyticsTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => { apiFetch<AnalyticsData>(`/api/projects/${projectId}/analytics`).then(setData); }, [projectId]);

  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;

  const stableCount = Math.max(0, data.performance.totalConcepts - data.performance.conceptsMastered - data.performance.conceptsNeedingAttention);
  const activityData = data.activity.byType.map((a) => ({ ...a, label: a.type.replace(/_/g, ' ').toLowerCase() }));

  return (
    <div className="max-w-4xl space-y-8">
      <section>
        <p className="mb-3 eyebrow">Performance</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Avg. quiz accuracy" value={data.performance.avgAccuracy != null ? `${data.performance.avgAccuracy}%` : '—'} />
          <Stat label="Concepts mastered" value={String(data.performance.conceptsMastered)} tone="emerald" />
          <Stat label="Needs attention" value={String(data.performance.conceptsNeedingAttention)} tone="amber" />
          <Stat label="Tutor questions" value={String(data.aiActivity.tutorQuestions)} />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="surface p-5">
          <p className="mb-1 eyebrow">Mastery by concept</p>
          <p className="mb-4 text-xs text-slate-400">Previous vs. current mastery</p>
          {data.growth.masteryTrend.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No concept data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, data.growth.masteryTrend.length * 46)}>
              <BarChart data={data.growth.masteryTrend} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={14}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="concept" width={130} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number, key: string) => [`${v}%`, key === 'previous' ? 'Previous' : 'Current']} cursor={{ fill: '#f8fafc' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="previous" name="Previous" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={10} />
                    <Bar dataKey="current" name="Current" fill="#2563eb" background={{ fill: '#f1f5f9', radius: 4 }} radius={[0, 4, 4, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="surface p-5">
          <p className="mb-1 eyebrow">Concept status</p>
          <p className="mb-2 text-xs text-slate-400">{data.performance.totalConcepts} tracked</p>
          {data.performance.totalConcepts === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No concepts yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Mastered', value: data.performance.conceptsMastered, color: TREND_COLOR.IMPROVING },
                    { name: 'In progress', value: stableCount, color: TREND_COLOR.STABLE },
                    { name: 'Needs attention', value: data.performance.conceptsNeedingAttention, color: TREND_COLOR.NEEDS_ATTENTION }
                  ].filter((d) => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={3}
                >
                  {[
                    { name: 'Mastered', color: TREND_COLOR.IMPROVING },
                    { name: 'In progress', color: TREND_COLOR.STABLE },
                    { name: 'Needs attention', color: TREND_COLOR.NEEDS_ATTENTION }
                  ].map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <ul className="mt-2 space-y-1.5 text-xs">
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: TREND_COLOR.IMPROVING }} /> Mastered · {data.performance.conceptsMastered}</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: TREND_COLOR.STABLE }} /> In progress · {stableCount}</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: TREND_COLOR.NEEDS_ATTENTION }} /> Needs attention · {data.performance.conceptsNeedingAttention}</li>
          </ul>
        </div>
      </section>

      <section>
        <p className="mb-3 eyebrow">Activity</p>
        {activityData.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet.</p>
        ) : (
          <div className="surface p-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={28}>
                  {activityData.map((_, i) => <Cell key={i} fill={ACTIVITY_COLORS[i % ACTIVITY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'amber' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className={`stat-value ${toneClass}`}>{value}</p>
    </div>
  );
}
