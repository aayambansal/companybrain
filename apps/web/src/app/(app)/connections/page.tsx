'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Page } from '@/components/app-shell';
import { Button, Input, Field, Skeleton, EmptyState, Badge } from '@/components/ui';
import { useToast } from '@/components/toast';
import { timeAgo } from '@/lib/format';
import { IconPlug, IconArrowRight } from '@/components/icons';

interface ConfigField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
}
interface ConnectorInfo {
  id: string;
  displayName: string;
  description: string;
  category?: string;
  auth?: string;
  configSchema: ConfigField[];
}
interface Connection {
  id: string;
  connector: string;
  name: string;
  status: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

export default function ConnectionsPage() {
  const toast = useToast();
  const [available, setAvailable] = useState<ConnectorInfo[] | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<ConnectorInfo | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [syncEvery, setSyncEvery] = useState('0');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [a, c] = await Promise.allSettled([
      api.get<{ connectors: ConnectorInfo[] }>('/v1/connections/available'),
      api.get<{ connections: Connection[] }>('/v1/connections'),
    ]);
    setAvailable(a.status === 'fulfilled' ? a.value.connectors : []);
    if (c.status === 'fulfilled') setConnections(c.value.connections);
  }
  useEffect(() => {
    load();
  }, []);

  function pick(c: ConnectorInfo) {
    setSelected(c);
    setName(c.displayName);
    setForm({});
    setSyncEvery('0');
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const config = { ...form, syncIntervalMinutes: Number(syncEvery) || 0 };
      // The server requires a non-empty name; fall back to the connector's label
      // if the field was cleared, rather than failing with a generic error.
      await api.post('/v1/connections', {
        connector: selected.id,
        name: name.trim() || selected.displayName,
        config,
      });
      toast('success', `Connected ${selected.displayName}.`);
      setSelected(null);
      load();
    } catch {
      toast('error', 'Could not create the connection.');
    } finally {
      setBusy(false);
    }
  }

  async function sync(c: Connection) {
    try {
      const r = await api.post<{ started?: boolean }>(`/v1/connections/${c.id}/sync`);
      toast(r.started ? 'success' : 'info', r.started ? 'Sync started.' : 'Sync queued.');
      setTimeout(load, 1500);
    } catch {
      toast('error', 'No sync runner is registered on the server yet.');
    }
  }

  return (
    <Page
      title="Connections"
      subtitle="Point CompanyBrain at your sources. Everything lands in one searchable store."
    >
      {/* Configured */}
      {connections.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2.5 font-mono text-sm text-ink-muted">Connected</h2>
          <ul className="space-y-2">
            {connections.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div>
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="font-mono text-[11px] text-ink-faint">
                    {c.connector} ·{' '}
                    {c.lastSyncedAt ? `synced ${timeAgo(c.lastSyncedAt)}` : 'never synced'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      c.status === 'active'
                        ? 'success'
                        : c.status === 'error'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {c.status}
                  </Badge>
                  <Button variant="secondary" size="sm" onClick={() => sync(c)}>
                    Sync now
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Add connection form */}
      {selected && (
        <form onSubmit={create} className="card mb-8 space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm text-ink">Configure {selected.displayName}</h2>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[13px] text-ink-faint hover:text-ink"
            >
              Cancel
            </button>
          </div>
          <Field label="Name" htmlFor="conn-name">
            <Input id="conn-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {selected.configSchema.map((f) => (
            <Field key={f.key} label={f.label} hint={f.help} htmlFor={`f-${f.key}`}>
              <Input
                id={`f-${f.key}`}
                type={f.type === 'password' ? 'password' : 'text'}
                required={f.required}
                placeholder={f.placeholder}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
          <Field label="Auto-sync" hint="Sync automatically on this interval. 0 means manual only.">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={syncEvery}
                onChange={(e) => setSyncEvery(e.target.value)}
                className="w-24"
              />
              <span className="text-[13px] text-ink-faint">minutes</span>
            </div>
          </Field>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" type="submit" loading={busy}>
              Connect
            </Button>
          </div>
        </form>
      )}

      {/* Available connectors */}
      <h2 className="mb-2.5 font-mono text-sm text-ink-muted">Available</h2>
      {available === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : available.length === 0 ? (
        <EmptyState
          title="no connectors registered"
          description="The server has no connector runner wired in yet. Add a memory from the overview, or use the API and SDK to ingest directly."
          icon={<IconPlug size={28} />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              className="group flex flex-col rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-md bg-surface-2 font-mono text-[13px] text-[var(--color-primary)]">
                  {c.displayName[0]}
                </span>
                {c.category && <Badge tone="neutral">{c.category}</Badge>}
              </div>
              <p className="mt-2.5 font-medium text-ink">{c.displayName}</p>
              <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{c.description}</p>
              <span className="mt-3 flex items-center gap-1 text-[12px] text-ink-faint transition-colors group-hover:text-[var(--color-primary)]">
                Configure <IconArrowRight size={12} />
              </span>
            </button>
          ))}
        </div>
      )}
    </Page>
  );
}
