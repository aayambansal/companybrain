'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Input, Select, Field, Skeleton, Badge } from '@/components/ui';
import { useToast } from '@/components/toast';
import { IconSparkle } from '@/components/icons';

interface ProviderOption {
  provider: string;
  label: string;
  needsKey: boolean;
  models: string[];
}
interface ProvidersResponse {
  embedding: { provider: string; model: string; hasKey: boolean };
  llm: { provider: string; model: string; available: boolean; hasKey: boolean };
  options: { embedding: ProviderOption[]; llm: ProviderOption[] };
}

export function ProvidersSection() {
  const toast = useToast();
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [reindexing, setReindexing] = useState(false);

  async function load() {
    try {
      setData(await api.get<ProvidersResponse>('/v1/providers'));
    } catch {
      setData(null);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function reindex() {
    if (
      !confirm(
        'Re-embed every memory with the current embedding provider? This runs in the background.',
      )
    )
      return;
    setReindexing(true);
    try {
      const r = await api.post<{ documents: number }>('/v1/reindex');
      toast('success', `Re-indexing ${r.documents} memories in the background.`);
    } catch {
      toast('error', 'Could not start re-indexing.');
    } finally {
      setReindexing(false);
    }
  }

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink-muted">
        <IconSparkle size={15} className="text-[var(--color-primary)]" /> Providers
      </h2>
      <p className="mb-3 text-[13px] text-ink-faint">
        Bring your own keys. The language model powers chat; embeddings power search. Local runs
        with no key.
      </p>
      {data === null ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-3">
          <ProviderCard
            kind="llm"
            title="Language model"
            current={data.llm}
            options={data.options.llm}
            onSaved={load}
            toast={toast}
          />
          <ProviderCard
            kind="embedding"
            title="Embeddings"
            current={data.embedding}
            options={data.options.embedding}
            onSaved={load}
            toast={toast}
            warn="Changing this does not re-embed existing memories. Re-index for comparable scores."
          />
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3">
            <p className="text-[13px] text-ink-muted">
              Re-embed every memory with the current embedding provider.
            </p>
            <Button variant="secondary" size="sm" onClick={reindex} loading={reindexing}>
              Re-index all
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ProviderCard({
  kind,
  title,
  current,
  options,
  onSaved,
  toast,
  warn,
}: {
  kind: 'llm' | 'embedding';
  title: string;
  current: { provider: string; model: string; hasKey: boolean; available?: boolean };
  options: ProviderOption[];
  onSaved: () => void;
  toast: (k: 'success' | 'error' | 'info', m: string) => void;
  warn?: string;
}) {
  const initialProvider = options.find((o) => o.provider === current.provider) ?? options[0];
  const [provider, setProvider] = useState(initialProvider?.provider ?? '');
  const [model, setModel] = useState(current.model);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const opt = options.find((o) => o.provider === provider);
  const needsKey = opt?.needsKey ?? false;

  function pickProvider(p: string) {
    setProvider(p);
    const o = options.find((x) => x.provider === p);
    if (o && !o.models.includes(model)) setModel(o.models[0] ?? '');
  }

  async function save() {
    setSaving(true);
    try {
      const body = { [kind]: { provider, model, apiKey: apiKey || undefined } };
      const r = await api.put<{ note?: string }>('/v1/providers', body);
      setApiKey('');
      toast('success', r.note ?? `${title} saved.`);
      onSaved();
    } catch {
      toast('error', `Could not save ${title.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const r = await api.post<{ llm?: string; embedding?: string }>('/v1/providers/test');
      const status = kind === 'llm' ? r.llm : r.embedding;
      if (status === 'ok') toast('success', `${title}: connection ok.`);
      else toast(status === 'not configured' ? 'info' : 'error', `${title}: ${status}`);
    } catch {
      toast('error', 'Test failed.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <div className="flex items-center gap-2">
          {kind === 'llm' && (
            <Badge tone={current.available ? 'success' : 'neutral'}>
              {current.available ? 'active' : 'off'}
            </Badge>
          )}
          {current.hasKey && <Badge tone="primary">key set</Badge>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Provider">
          <Select value={provider} onChange={(e) => pickProvider(e.target.value)}>
            {options.map((o) => (
              <option key={o.provider} value={o.provider}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Model">
          <Select value={model} onChange={(e) => setModel(e.target.value)}>
            {(opt?.models ?? [model]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {needsKey && (
        <div className="mt-3">
          <Field
            label="API key"
            hint={current.hasKey ? 'A key is saved. Leave blank to keep it.' : undefined}
          >
            <Input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={current.hasKey ? '•••••••• (unchanged)' : 'sk-...'}
            />
          </Field>
        </div>
      )}
      {warn && <p className="mt-2 text-[12px] text-[var(--color-warn-ink)]">{warn}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={test} loading={testing}>
          Test
        </Button>
        <Button variant="primary" size="sm" onClick={save} loading={saving}>
          Save
        </Button>
      </div>
    </div>
  );
}
