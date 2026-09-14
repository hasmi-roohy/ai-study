'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';
import AppShell from '@/components/AppShell';
import { PlusIcon, AlertIcon, GridIcon } from '@/components/icons';

type Project = {
  id: string;
  name: string;
  description?: string | null;
  goal?: string | null;
  lastAccessedAt: string;
  createdAt: string;
  overallMastery: number;
  needsAttention: number;
  attentionConcepts: { id: string; name: string; masteryPct: number }[];
};

type SpaceInfo = { id: string; name: string; description?: string | null };
type ActivityItem = { id: string; type: string; createdAt: string; project: { name: string } | null };

function levelFor(mastery: number) {
  if (mastery >= 70) return { label: 'Advanced', className: 'level-advanced' };
  if (mastery >= 35) return { label: 'Intermediate', className: 'level-intermediate' };
  return { label: 'Beginner', className: 'level-beginner' };
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function activityLabel(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

export default function SpacePage() {
  const params = useParams<{ spaceId: string }>();
  const spaceId = params.spaceId;
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<{ space: SpaceInfo; projects: Project[]; recentActivity: ActivityItem[] }>(`/api/spaces/${spaceId}/projects`);
      setSpace(data.space);
      setProjects(data.projects);
      setActivity(data.recentActivity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this space.');
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => { if (spaceId) load(); }, [spaceId, load]);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const data = await apiFetch<{ project: Project }>(`/api/spaces/${spaceId}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name, description: description || undefined, goal: goal || undefined })
      });
      setProjects((current) => [{ ...data.project, overallMastery: 0, needsAttention: 0, attentionConcepts: [] }, ...current]);
      setName(''); setDescription(''); setGoal(''); setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setCreating(false);
    }
  }

  const totalConcepts = projects.reduce((sum, p) => sum + p.needsAttention, 0);
  const overallProgress = projects.length ? Math.round(projects.reduce((sum, p) => sum + p.overallMastery, 0) / projects.length) : 0;
  const attention = projects.flatMap((p) => p.attentionConcepts.map((c) => ({ ...c, project: p })));

  return (
    <AppShell>
      <p className="breadcrumb"><Link href="/spaces">Spaces</Link> / {space?.name ?? '…'}</p>

      <div className="mt-2 mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">{space?.name ?? 'Loading…'}</h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500">{space?.description || 'A focused place to build your knowledge.'}</p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)} className="primary-button">
          <PlusIcon /> Create New Project
        </button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="stat-card">
          <p className="stat-label">Projects</p>
          <p className="stat-value">{projects.length}</p>
          <p className="mt-1 text-xs text-slate-400">All active</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Overall Progress</p>
          <p className="stat-value">{overallProgress}%</p>
          <div className="progress-track mt-2"><div className="progress-fill" style={{ width: `${overallProgress}%` }} /></div>
        </div>
        <div className="stat-card">
          <p className="stat-label">Concepts Tracked</p>
          <p className="stat-value">{projects.reduce((s, p) => s + p.needsAttention, 0) >= 0 ? projects.reduce((s, p) => s + (p.attentionConcepts?.length ?? 0), 0) : 0}</p>
          <p className="mt-1 text-xs text-slate-400">Needing review</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Needs Attention</p>
          <p className="stat-value">{totalConcepts}</p>
          <p className="mt-1 text-xs text-slate-400">Concepts slowing progress</p>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={createProject} className="surface mb-8 max-w-xl p-6">
          <p className="eyebrow">New Project</p>
          <h2 className="mt-1 text-lg font-semibold">Start a focused learning journey</h2>
          <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="form-control mt-5" placeholder="e.g. Neural Networks Fundamentals" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} className="form-control mt-3" placeholder="Description (optional)" />
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={1000} rows={2} className="form-control mt-3" placeholder="What do you want to be able to do? (optional)" />
          <div className="mt-4 flex gap-3">
            <button disabled={creating} className="primary-button">{creating ? 'Creating…' : 'Create Project'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="secondary-button">Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="mb-3 eyebrow">Projects</p>
          {loading ? (
            <div className="surface p-8 text-sm text-slate-500">Loading projects…</div>
          ) : projects.length === 0 ? (
            <div className="surface border-dashed p-10 text-center">
              <GridIcon className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-3 font-medium">Start a focused learning journey</p>
              <p className="mt-1 text-sm text-slate-500">Create a project, upload a PDF, then learn with your Tutor.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((project) => {
                const level = levelFor(project.overallMastery);
                return (
                  <Link key={project.id} href={`/projects/${project.id}`} className="surface flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600"><GridIcon className="h-4 w-4" /></span>
                      <span className={`level-badge ${level.className}`}>{level.label}</span>
                    </div>
                    <h3 className="mt-4 font-semibold text-slate-900">{project.name}</h3>
                    <p className="mt-1 min-h-9 text-sm text-slate-500 line-clamp-2">{project.description || project.goal || 'A focused learning journey.'}</p>
                    <div className="mt-4">
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${project.overallMastery}%` }} /></div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                        <span>Updated {timeAgo(project.lastAccessedAt)}</span>
                        <span className="font-semibold text-slate-600">{project.overallMastery}%</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="surface p-5">
            <p className="mb-3 eyebrow">Recent Activity</p>
            {activity.length === 0 ? (
              <p className="text-sm text-slate-400">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex gap-2.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span className="text-slate-600">
                      {activityLabel(item.type)}
                      {item.project?.name ? <span className="text-slate-400"> · {item.project.name}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {attention.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                <AlertIcon className="h-4 w-4" /> {attention.length} concept{attention.length === 1 ? '' : 's'} slowing progress
              </p>
              <ul className="mt-3 space-y-1.5">
                {attention.slice(0, 4).map((c) => (
                  <li key={c.id} className="text-sm text-amber-900">{c.name} · {c.masteryPct}%</li>
                ))}
              </ul>
              <Link href={`/projects/${attention[0].project.id}`} className="mt-3 inline-block text-sm font-semibold text-amber-800 hover:text-amber-900">
                Start a focused review →
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
