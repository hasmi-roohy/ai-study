'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiFetch';
import AppShell from '@/components/AppShell';
import { PlusIcon, GridIcon, ArrowRightIcon } from '@/components/icons';

interface Space { id: string; name: string; description?: string; _count: { projects: number }; }

const TILE_COLORS = ['bg-brand-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600'];

export default function SpacesIndexPage() {
  const { status } = useSession();
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);

  async function loadSpaces() {
    setLoading(true);
    try {
      setSpaces((await apiFetch<{ spaces: Space[] }>('/api/spaces')).spaces);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (status === 'authenticated') loadSpaces(); }, [status]);

  async function createSpace(event: React.FormEvent) {
    event.preventDefault();
    await apiFetch('/api/spaces', { method: 'POST', body: JSON.stringify({ name, description }) });
    setName(''); setDescription(''); setShowCreate(false);
    loadSpaces();
  }

  if (status !== 'authenticated') return null;

  return (
    <AppShell>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Learning library</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-slate-900">Your Spaces</h1>
          <p className="mt-1.5 text-sm text-slate-500">Group focused projects and keep the context of what you&apos;re learning together.</p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)} className="primary-button">
          <PlusIcon /> Create New Space
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createSpace} className="surface mb-8 max-w-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">New Space</p>
              <h2 className="mt-1 text-lg font-semibold">What are you learning?</h2>
            </div>
            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400">✕</button>
          </div>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="form-control mt-5" placeholder="e.g. Machine Learning" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="form-control mt-3 min-h-20" placeholder="A short description (optional)" />
          <button className="primary-button mt-4">Create Space</button>
        </form>
      )}

      {loading ? (
        <div className="surface p-8 text-sm text-slate-500">Loading your learning spaces…</div>
      ) : spaces.length === 0 ? (
        <div className="surface border-dashed p-12 text-center">
          <GridIcon className="mx-auto h-6 w-6 text-slate-300" />
          <h2 className="mt-3 font-semibold">Your learning library starts here</h2>
          <p className="mt-2 text-sm text-slate-500">Create a Space to group focused projects and keep your learning context together.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {spaces.map((space, index) => (
            <Link key={space.id} href={`/spaces/${space.id}`} className="surface group p-6 transition hover:-translate-y-1 hover:shadow-lg">
              <div className={`grid h-10 w-10 place-items-center rounded-xl text-white font-bold ${TILE_COLORS[index % TILE_COLORS.length]}`}>
                {space.name.slice(0, 1).toUpperCase()}
              </div>
              <h3 className="mt-6 font-semibold group-hover:text-brand-700">{space.name}</h3>
              <p className="mt-2 min-h-10 text-sm text-slate-500">{space.description || 'A focused place to build your knowledge.'}</p>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs font-medium text-slate-500">
                  {space._count.projects} {space._count.projects === 1 ? 'project' : 'projects'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  Open
                  <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
