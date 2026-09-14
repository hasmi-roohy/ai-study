'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiFetch';
import AppShell from '@/components/AppShell';
import { AlertIcon } from '@/components/icons';

interface Space { id: string; name: string; _count: { projects: number }; }
interface Project {
  id: string;
  name: string;
  overallMastery: number;
  lastAccessedAt: string;
  attentionConcepts: { id: string; name: string; masteryPct: number }[];
  spaceName: string;
}
interface GlobalAnalytics {
  overallLearning: { totalActivity: number; activeDays: number; spaces: number; projects: number };
  performance: { overallMastery: number; conceptsImproving: number; conceptsNeedingAttention: number };
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [analytics, setAnalytics] = useState<GlobalAnalytics | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      const [{ spaces }, globalAnalytics] = await Promise.all([
        apiFetch<{ spaces: Space[] }>('/api/spaces'),
        apiFetch<GlobalAnalytics>('/api/analytics')
      ]);
      setAnalytics(globalAnalytics);

      const perSpace: Project[][] = await Promise.all(
        spaces.map((space) =>
          apiFetch<{ projects: Omit<Project, 'spaceName'>[] }>(`/api/spaces/${space.id}/projects`)
            .then((data): Project[] => data.projects.map((p) => ({ ...p, spaceName: space.name })))
            .catch((): Project[] => [])
        )
      );
      const merged = perSpace.flat().sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime());
      setProjects(merged);

      if (merged[0]) {
        apiFetch<{ recommendation: { text: string } | null }>(`/api/projects/${merged[0].id}`)
          .then((data) => setRecommendation(data.recommendation?.text ?? null))
          .catch(() => {});
      }
    })();
  }, [status]);

  if (status !== 'authenticated') return null;
  const firstName = session.user?.name?.split(' ')[0] ?? 'there';
  const topProject = projects?.[0];
  const areasToImprove = (projects ?? []).flatMap((p) => p.attentionConcepts.map((c) => ({ ...c, project: p }))).slice(0, 3);

  return (
    <AppShell>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">{greeting()}, {firstName}</h1>
          <p className="mt-1 text-sm text-slate-500">Pick up where you left off, or start something new.</p>
        </div>
      </div>

      {topProject && (
        <div className="mb-8 overflow-hidden rounded-2xl bg-ink-950 px-6 py-6 text-white sm:px-8 sm:py-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
            Continue Learning · {topProject.spaceName}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{topProject.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{topProject.overallMastery}% mastery · updated {timeAgo(topProject.lastAccessedAt)}</p>
            </div>
            <Link href={`/projects/${topProject.id}`} className="primary-button shrink-0">Continue Learning</Link>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">Recent Projects</p>
            <Link href="/spaces" className="text-sm font-medium text-brand-600">View all</Link>
          </div>
          {!projects ? (
            <div className="surface p-8 text-sm text-slate-500">Loading your recent projects…</div>
          ) : projects.length === 0 ? (
            <div className="surface border-dashed p-10 text-center">
              <p className="font-medium">No projects yet</p>
              <p className="mt-1 text-sm text-slate-500">Create a Space, then start a project to begin learning.</p>
              <Link href="/spaces" className="primary-button mt-4 inline-flex">Go to Spaces</Link>
            </div>
          ) : (
            <div className="surface divide-y divide-slate-100">
              {projects.slice(0, 5).map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{project.name}</p>
                    <p className="text-xs text-slate-400">{project.spaceName} · Updated {timeAgo(project.lastAccessedAt)}</p>
                    <div className="progress-track mt-2 w-40"><div className="progress-fill" style={{ width: `${project.overallMastery}%` }} /></div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-700">{project.overallMastery}%</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="surface p-5">
            <p className="mb-3 eyebrow">Overall Progress</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-semibold text-slate-900">{analytics?.performance.overallMastery ?? '—'}%</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Mastery</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-slate-900">{analytics?.overallLearning.projects ?? '—'}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Projects</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-slate-900">{analytics?.overallLearning.activeDays ?? '—'}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Active days</p>
              </div>
            </div>
            <div className="progress-track mt-4"><div className="progress-fill" style={{ width: `${analytics?.performance.overallMastery ?? 0}%` }} /></div>
          </div>

          <div className="surface p-5">
            <p className="mb-3 eyebrow">Areas to Improve</p>
            {areasToImprove.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing needs attention right now — nice work.</p>
            ) : (
              <ul className="space-y-3">
                {areasToImprove.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-600"><AlertIcon className="h-3.5 w-3.5 text-amber-500" />{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">{c.masteryPct}%</span>
                      <Link href={`/projects/${c.project.id}`} className="text-xs font-semibold text-brand-600">Review</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Recommended Next Step</p>
            <p className="mt-2 text-sm text-emerald-900">
              {recommendation ?? (topProject ? `Continue with ${topProject.name} to keep your momentum going.` : 'Create a Space and project to get a personalized recommendation.')}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
