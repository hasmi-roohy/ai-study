'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { FileTextIcon, CheckIcon, AlertIcon } from '@/components/icons';

interface Material {
  id: string;
  filename: string;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';
  failureReason?: string | null;
}

const STATUS_LABEL: Record<Material['status'], string> = {
  QUEUED: 'Queued',
  PROCESSING: 'Processing…',
  READY: 'Ready',
  FAILED: 'Failed'
};

const STATUS_COLOR: Record<Material['status'], string> = {
  QUEUED: 'bg-slate-100 text-slate-500',
  PROCESSING: 'bg-amber-50 text-amber-600',
  READY: 'bg-emerald-50 text-emerald-600',
  FAILED: 'bg-red-50 text-red-600'
};

export default function MaterialsTab({ projectId }: { projectId: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{ materials: Material[] }>(`/api/projects/${projectId}/materials`);
    setMaterials(data.materials);
  }, [projectId]);

  useEffect(() => {
    load();
    // Poll while any material is still processing, so the UI reflects background job completion.
    const interval = setInterval(() => {
      setMaterials((current) => {
        if (current.some((m) => m.status === 'QUEUED' || m.status === 'PROCESSING')) load();
        return current;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/projects/${projectId}/materials`, { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Upload failed');
      }
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="max-w-2xl">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-8 text-center transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-600">
          <FileTextIcon className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium text-slate-700">{uploading ? 'Uploading…' : 'Upload a PDF'}</span>
        <span className="text-xs text-slate-400">Give the Tutor something to learn from · up to 20MB</span>
      </button>
      <input ref={fileInput} type="file" accept="application/pdf" onChange={handleUpload} disabled={uploading} className="hidden" />

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {materials.length > 0 && (
        <div className="surface mt-5 divide-y divide-slate-100">
          {materials.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400">
                  <FileTextIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{m.filename}</p>
                  {m.status === 'FAILED' && m.failureReason && <p className="mt-0.5 text-xs text-red-500">{m.failureReason}</p>}
                </div>
              </div>
              <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[m.status]}`}>
                {m.status === 'READY' && <CheckIcon className="h-3 w-3" />}
                {m.status === 'FAILED' && <AlertIcon className="h-3 w-3" />}
                {STATUS_LABEL[m.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
