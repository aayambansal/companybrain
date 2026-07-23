'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/components/toast';
import { timeAgo } from '@/lib/format';
import { IconPlus, IconTrash } from '@/components/icons';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastStatus: number | null;
  lastDeliveredAt: string | null;
  hasSecret: boolean;
}

export function WebhooksSection() {
  const toast = useToast();
  const [hooks, setHooks] = useState<Webhook[] | null>(null);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api.get<{ webhooks: Webhook[] }>('/v1/webhooks');
      setHooks(r.webhooks);
    } catch {
      setHooks([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try {
      await api.post('/v1/webhooks', { url: url.trim(), secret: secret.trim() || undefined });
      setUrl('');
      setSecret('');
      toast('success', 'Webhook added.');
      load();
    } catch {
      toast('error', 'Could not add webhook (check the URL).');
    } finally {
      setBusy(false);
    }
  }

  async function test(h: Webhook) {
    try {
      const r = await api.post<{ status: number; ok: boolean }>(`/v1/webhooks/${h.id}/test`);
      toast(r.ok ? 'success' : 'error', `Test delivered: HTTP ${r.status || 'no response'}.`);
      load();
    } catch {
      toast('error', 'Test failed.');
    }
  }

  async function remove(h: Webhook) {
    if (!confirm('Delete this webhook?')) return;
    try {
      await api.del(`/v1/webhooks/${h.id}`);
      toast('success', 'Deleted.');
      load();
    } catch {
      toast('error', 'Could not delete.');
    }
  }

  return (
    <section>
      <h2 className="mb-1 font-mono text-sm text-ink-muted">Webhooks</h2>
      <p className="mb-3 text-[13px] text-ink-faint">Get a signed POST when a memory is created. Verify with the x-companybrain-signature header.</p>

      <form onSubmit={create} className="mb-4 flex flex-wrap gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks/companybrain" className="min-w-56 flex-1" />
        <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="signing secret (optional)" className="w-56" />
        <Button variant="primary" size="md" type="submit" loading={busy} disabled={!url.trim()}>
          <IconPlus size={15} /> Add
        </Button>
      </form>

      {hooks === null ? null : hooks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-[13px] text-ink-faint">No webhooks yet.</p>
      ) : (
        <ul className="card divide-y divide-border">
          {hooks.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-[13px] text-ink">{h.url}</p>
                <p className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-ink-faint">
                  {h.events.join(', ')}
                  {h.hasSecret && <Badge tone="primary">signed</Badge>}
                  {h.lastStatus !== null && (
                    <Badge tone={h.lastStatus >= 200 && h.lastStatus < 300 ? 'success' : 'danger'}>
                      {h.lastStatus || 'no response'}
                    </Badge>
                  )}
                  {h.lastDeliveredAt && <span>· {timeAgo(h.lastDeliveredAt)}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => test(h)}>
                  Test
                </Button>
                <button onClick={() => remove(h)} className="rounded-md p-2 text-ink-faint transition-colors hover:bg-surface-2 hover:text-[var(--color-danger)]" title="Delete">
                  <IconTrash size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
