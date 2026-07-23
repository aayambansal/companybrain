'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type Space } from '@/lib/api';
import { Page } from '@/components/app-shell';
import { Button, Input, Field, Skeleton, EmptyState, Badge } from '@/components/ui';
import { useToast } from '@/components/toast';
import { IconSpaces, IconPlus, IconArrowRight, IconTrash } from '@/components/icons';

export default function SpacesPage() {
  const toast = useToast();
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api.get<{ spaces: Space[] }>('/v1/spaces');
      setSpaces(r.spaces);
    } catch {
      setSpaces([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post('/v1/spaces', { name: name.trim(), description: desc.trim() || undefined });
      setName('');
      setDesc('');
      setCreating(false);
      toast('success', 'Space created.');
      load();
    } catch {
      toast('error', 'Could not create space.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Space) {
    if (!confirm(`Delete the "${s.name}" space? Its memories are deleted too.`)) return;
    try {
      await api.del(`/v1/spaces/${s.id}`);
      toast('success', 'Space deleted.');
      load();
    } catch {
      toast('error', 'Could not delete (default spaces cannot be removed).');
    }
  }

  return (
    <Page
      title="Spaces"
      subtitle="Named collections that scope search and organize memories."
      actions={
        <Button variant="primary" size="sm" onClick={() => setCreating((v) => !v)}>
          <IconPlus size={15} /> New space
        </Button>
      }
    >
      {creating && (
        <form onSubmit={create} className="card mb-5 space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="sp-name">
              <Input id="sp-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering" />
            </Field>
            <Field label="Description" htmlFor="sp-desc">
              <Input id="sp-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={busy} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </form>
      )}

      {spaces === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : spaces.length === 0 ? (
        <EmptyState title="no spaces" description="Create one to start organizing." icon={<IconSpaces size={28} />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((s) => (
            <div key={s.id} className="group card flex flex-col p-4 transition-colors hover:border-border-strong">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-md bg-[var(--color-primary-soft)] font-mono text-[13px] text-[var(--color-primary)]">
                    {(s.name[0] ?? '?').toUpperCase()}
                  </span>
                  <div>
                    <p className="font-medium text-ink">{s.name}</p>
                    <p className="font-mono text-[11px] text-ink-faint">/{s.slug}</p>
                  </div>
                </div>
                {s.isDefault ? (
                  <Badge tone="primary">default</Badge>
                ) : (
                  <button
                    onClick={() => remove(s)}
                    className="rounded-md p-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-[var(--color-danger)] group-hover:opacity-100"
                    title="Delete space"
                  >
                    <IconTrash size={15} />
                  </button>
                )}
              </div>
              {s.description && <p className="mt-2 line-clamp-2 text-[13px] text-ink-muted">{s.description}</p>}
              <div className="mt-auto flex items-center justify-between pt-3">
                <span className="font-mono text-[12px] text-ink-faint">{s.documentCount ?? 0} memories</span>
                <Link href={`/memories?spaceId=${s.id}`} className="flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink">
                  Open <IconArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
