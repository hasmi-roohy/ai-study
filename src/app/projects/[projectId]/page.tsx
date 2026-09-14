'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';
import AppShell from '@/components/AppShell';
import MaterialsTab from '@/components/project/MaterialsTab';
import TutorTab from '@/components/project/TutorTab';
import QuizTab from '@/components/project/QuizTab';
import AnalyticsTab from '@/components/project/AnalyticsTab';
import { LayersIcon, FileTextIcon, MessageIcon, HelpCircleIcon, TrendUpIcon } from '@/components/icons';

type Tab = 'overview' | 'materials' | 'tutor' | 'quiz' | 'growth';
type ProjectData = {
  project: { name: string; description?: string | null; goal?: string | null; space?: { id: string; name: string } };
  overallMastery: number;
  concepts: { id: string; name: string; masteryPct: number; trend: string }[];
  materials: { id: string; filename: string; status: string }[];
  recentActivity: { id: string; type: string; createdAt: string }[];
  recommendation: { text: string } | null;
  learningContext: { id: string; type: string; content: string }[];
};

const tabs: { id: Tab; label: string; icon: typeof LayersIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayersIcon },
  { id: 'materials', label: 'Materials', icon: FileTextIcon },
  { id: 'tutor', label: 'Tutor', icon: MessageIcon },
  { id: 'quiz', label: 'Quiz', icon: HelpCircleIcon },
  { id: 'growth', label: 'Growth & Analytics', icon: TrendUpIcon }
];

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<ProjectData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    apiFetch<ProjectData>(`/api/projects/${projectId}`).then(setData).catch((err) => setError(err.message));
  }, [projectId]);

  return (
    <AppShell>
      <p className="breadcrumb">
        <Link href="/spaces">Spaces</Link>
        {data?.project.space && <> / <Link href={`/spaces/${data.project.space.id}`}>{data.project.space.name}</Link></>}
        {data && <> / {data.project.name}</>}
      </p>

      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">{data?.project.name ?? 'Your learning workspace'}</h1>
          {data?.project.goal && <p className="mt-1 text-sm text-slate-500">Goal: {data.project.goal}</p>}
        </div>
        {data && (
          <div className="stat-card !p-3 text-center">
            <p className="text-2xl font-semibold text-brand-600">{data.overallMastery}%</p>
            <p className="text-[11px] text-slate-400">overall mastery</p>
          </div>
        )}
      </div>

      <nav className="mb-7 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" aria-label="Project sections">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                active ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-500">Loading your learning context…</p>}
      {data && tab === 'overview' && <Overview data={data} goTo={setTab} />}
      {data && tab === 'materials' && <MaterialsTab projectId={projectId} />}
      {data && tab === 'tutor' && <TutorTab projectId={projectId} />}
      {data && tab === 'quiz' && <QuizTab projectId={projectId} />}
      {data && tab === 'growth' && <AnalyticsTab projectId={projectId} />}
    </AppShell>
  );
}

function Overview({ data, goTo }: { data: ProjectData; goTo: (tab: Tab) => void }) {
  const readyMaterials = data.materials.filter((material) => material.status === 'READY').length;
  return (
    <div className="space-y-8">
      {data.recommendation ? (
        <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Recommended next step</p>
          <p className="mt-2 text-sm text-emerald-900">{data.recommendation.text}</p>
        </section>
      ) : (
        <section className="surface p-5">
          <p className="font-medium">Choose your next step</p>
          <p className="mt-1 text-sm text-slate-500">Upload material, ask the Tutor, or take a quiz once concepts are available.</p>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Materials ready" value={`${readyMaterials} / ${data.materials.length}`} />
        <Metric label="Concepts tracked" value={String(data.concepts.length)} />
        <Metric label="Mastery" value={`${data.overallMastery}%`} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">Concept mastery</p>
          <button onClick={() => goTo('growth')} className="text-sm font-medium text-brand-600">View analytics</button>
        </div>
        {data.concepts.length ? (
          <div className="space-y-3">
            {data.concepts.map((concept) => (
              <div key={concept.id} className="surface p-4">
                <div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-700">{concept.name}</span><span className="font-semibold text-slate-900">{concept.masteryPct}%</span></div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${concept.masteryPct}%` }} /></div>
                <p className="mt-2 text-xs text-slate-400">{concept.trend.replace('_', ' ').toLowerCase()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Concepts appear after your first material has finished processing.</p>
        )}
      </section>

      <section>
        <p className="mb-3 eyebrow">Continue learning</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Action title="Add material" body="Upload a PDF" onClick={() => goTo('materials')} />
          <Action title="Ask Tutor" body="Learn from your sources" onClick={() => goTo('tutor')} />
          <Action title="Take a quiz" body="Measure understanding" onClick={() => goTo('quiz')} />
        </div>
      </section>

      {data.learningContext.length > 0 && (
        <section>
          <p className="mb-3 eyebrow">What your companion remembers</p>
          <div className="surface space-y-2 p-4">
            {data.learningContext.map((item) => (
              <p key={item.id} className="text-sm"><span className="mr-2 text-xs font-semibold text-brand-700">{item.type.replace('_', ' ').toLowerCase()}</span>{item.content}</p>
            ))}
          </div>
        </section>
      )}

      {data.recentActivity.length > 0 && (
        <section>
          <p className="mb-3 eyebrow">Recent activity</p>
          <div className="space-y-2">
            {data.recentActivity.slice(0, 5).map((activity) => (
              <div key={activity.id} className="surface flex justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-slate-600">{activity.type.replace(/_/g, ' ').toLowerCase()}</span>
                <time className="text-xs text-slate-400">{new Date(activity.createdAt).toLocaleDateString()}</time>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  );
}

function Action({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="surface p-4 text-left transition hover:border-brand-200">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{body}</p>
    </button>
  );
}
