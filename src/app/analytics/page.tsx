'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import AppShell from '@/components/AppShell';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface GlobalAnalytics {
  overallLearning: { totalActivity: number; activeDays: number; spaces: number; projects: number };
  performance: {
    overallMastery: number;
    conceptsImproving: number;
    conceptsStable: number;
    conceptsNeedingAttention: number;
    byProject: { name: string; mastery: number }[];
  };
  aiUsage: { tutorQuestions: number; quizzesTaken: number };
}

const TREND_COLORS = { improving: '#059669', stable: '#94a3b8', attention: '#d97706' };

export default function GlobalAnalyticsPage() {
  const [data, setData] = useState<GlobalAnalytics | null>(null);

  useEffect(() => { apiFetch<GlobalAnalytics>('/api/analytics').then(setData); }, []);

  const pieData = data
    ? [
        { name: 'Improving', value: data.performance.conceptsImproving, color: TREND_COLORS.improving },
        { name: 'Stable', value: data.performance.conceptsStable, color: TREND_COLORS.stable },
        { name: 'Needs attention', value: data.performance.conceptsNeedingAttention, color: TREND_COLORS.attention }
      ].filter((d) => d.value > 0)
    : [];

  return (
    <AppShell>
      <p className="eyebrow">Overview</p>
      <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-slate-900">Platform Analytics</h1>
      <p className="mt-1.5 text-sm text-slate-500">Your engagement, mastery, and AI usage across every Space.</p>

      {!data ? (
        <div className="surface mt-7 p-8 text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="mt-7 space-y-8">
          <section>
            <p className="mb-3 eyebrow">Learning</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Spaces" value={data.overallLearning.spaces} />
              <Stat label="Projects" value={data.overallLearning.projects} />
              <Stat label="Active days" value={data.overallLearning.activeDays} />
              <Stat label="Total activity" value={data.overallLearning.totalActivity} />
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="surface p-5">
              <p className="mb-1 eyebrow">Mastery by project</p>
              <p className="mb-4 text-xs text-slate-400">Average concept mastery in each project</p>
              {data.performance.byProject.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No concept data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, data.performance.byProject.length * 42)}>
                  <BarChart data={data.performance.byProject} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Mastery']} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="mastery" fill="#2563eb" background={{ fill: '#f1f5f9', radius: 6 }} radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {data.performance.byProject.length > 0 && data.performance.byProject.every((p) => p.mastery === 0) && (
                <p className="mt-2 text-center text-xs text-slate-400">
                  Everything shows 0% until a quiz is taken &mdash; mastery isn&apos;t tracked from materials alone.
                </p>
              )}
            </div>

            <div className="surface p-5">
              <p className="mb-1 eyebrow">Concept trend</p>
              <p className="mb-2 text-xs text-slate-400">Across every project</p>
              {pieData.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No concepts tracked yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3}>
                      {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="mt-2 text-center">
                <p className="text-3xl font-semibold text-brand-600">{data.performance.overallMastery}%</p>
                <p className="text-xs text-slate-400">overall mastery</p>
              </div>
            </div>
          </section>

          <section>
            <p className="mb-3 eyebrow">AI Activity</p>
            <div className="grid grid-cols-2 gap-4 sm:w-1/2">
              <Stat label="Tutor questions asked" value={data.aiUsage.tutorQuestions} />
              <Stat label="Quizzes taken" value={data.aiUsage.quizzesTaken} />
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  );
}
