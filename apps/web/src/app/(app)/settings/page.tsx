'use client';

import { useEffect, useState } from 'react';
import { api, type ApiKey, type Status, type Me } from '@/lib/api';
import { Page } from '@/components/app-shell';
import { Button, Input, Skeleton, Badge } from '@/components/ui';
import { useToast } from '@/components/toast';
import { timeAgo } from '@/lib/format';
import { IconPlus, IconTrash } from '@/components/icons';
import { ProvidersSection } from './providers';
import { BackupSection } from './backup';
import { WebhooksSection } from './webhooks';

export default function SettingsPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [reveal, setReveal] = useState<string | null>(null);

  async function load() {
    const [k, s, m] = await Promise.allSettled([
      api.get<{ keys: ApiKey[] }>('/v1/api-keys'),
      api.get<Status>('/v1/status'),
      api.get<Me>('/v1/auth/me'),
    ]);
    setKeys(k.status === 'fulfilled' ? k.value.keys : []);
    if (s.status === 'fulfilled') setStatus(s.value);
    if (m.status === 'fulfilled') setMe(m.value);
  }
  useEffect(() => {
    load();
  }, []);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await api.post<{ key: ApiKey & { secret: string } }>('/v1/api-keys', {
        name: newName.trim(),
      });
      setReveal(r.key.secret);
      setNewName('');
      load();
    } catch {
      toast('error', 'Could not create the key.');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(k: ApiKey) {
    if (!confirm(`Revoke "${k.name}"? Applications using it stop working immediately.`)) return;
    try {
      await api.del(`/v1/api-keys/${k.id}`);
      toast('success', 'Key revoked.');
      load();
    } catch {
      toast('error', 'Could not revoke.');
    }
  }

  return (
    <Page title="Settings">
      <div className="space-y-8">
        {/* Workspace */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Workspace</h2>
          <div className="card divide-y divide-border">
            <Row label="Organization" value={me?.org?.name ?? '—'} />
            <Row
              label="You"
              value={me ? `${me.user?.name ?? me.user?.email} · ${me.user?.role}` : '—'}
            />
            <Row
              label="Embeddings"
              value={status ? `${status.embedding.provider} · ${status.embedding.model}` : '—'}
            />
            <Row
              label="Language model"
              value={
                status
                  ? status.llm.available
                    ? `${status.llm.provider} · ${status.llm.model}`
                    : 'not configured'
                  : '—'
              }
            />
            <Row label="Version" value={status ? `v${status.version}` : '—'} mono />
          </div>
        </section>

        {/* Providers */}
        <ProvidersSection />

        {/* Backup */}
        <BackupSection />

        {/* Webhooks */}
        <WebhooksSection />

        {/* API keys */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-muted">API keys</h2>
          </div>

          {reveal && (
            <div className="card mb-4 border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] p-4">
              <p className="text-[13px] text-ink">
                Copy this key now. It is shown once and not stored in plaintext.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-md bg-bg px-3 py-2 font-mono text-[13px] text-[var(--color-primary-strong)]">
                  {reveal}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(reveal);
                    toast('success', 'Copied.');
                  }}
                >
                  Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setReveal(null)}>
                  Done
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={createKey} className="mb-4 flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Key name, e.g. production"
            />
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={creating}
              disabled={!newName.trim()}
            >
              <IconPlus size={15} /> New key
            </Button>
          </form>

          {keys === null ? (
            <Skeleton className="h-20 w-full" />
          ) : keys.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-ink-faint">
              No API keys yet. Create one to use the SDK, CLI, or MCP server.
            </p>
          ) : (
            <ul className="card divide-y divide-border">
              {keys.map((k) => {
                const revoked = Boolean(k.revokedAt);
                return (
                  <li key={k.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${revoked ? 'text-ink-faint line-through' : 'text-ink'}`}
                        >
                          {k.name}
                        </span>
                        <code className="font-mono text-[11px] text-ink-faint">{k.prefix}…</code>
                        {revoked && <Badge tone="danger">revoked</Badge>}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                        created {timeAgo(k.createdAt)}
                        {k.lastUsedAt ? ` · used ${timeAgo(k.lastUsedAt)}` : ' · never used'}
                      </p>
                    </div>
                    {!revoked && (
                      <button
                        onClick={() => revoke(k)}
                        className="rounded-md p-2 text-ink-faint transition-colors hover:bg-surface-2 hover:text-[var(--color-danger)]"
                        title="Revoke key"
                      >
                        <IconTrash size={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className={`text-[13px] text-ink ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
