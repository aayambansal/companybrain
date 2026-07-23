'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type Status, type Memory, type Space } from '@/lib/api';
import { Page } from '@/components/app-shell';
import { Button, Textarea, Badge, StatusDot, Skeleton, EmptyState, cx } from '@/components/ui';
import { useToast } from '@/components/toast';
import { timeAgo, hostname } from '@/lib/format';
import { IconSearch, IconSparkle, IconArrowRight, IconMemory, IconLayers, IconSpaces, IconHash } from '@/components/icons';

export default function OverviewPage() {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function load() {
    const [s, m, sp, tp] = await Promise.allSettled([
      api.get<Status>('/v1/status'),
      api.get<{ memories: Memory[] }>('/v1/memories?limit=6'),
      api.get<{ spaces: Space[] }>('/v1/spaces'),
      api.get<{ topics: { topic: string; count: number }[] }>('/v1/topics?limit=12&minCount=1'),
    ]);
    if (s.status === 'fulfilled') setStatus(s.value);
    setMemories(m.status === 'fulfilled' ? m.value.memories : []);
    if (sp.status === 'fulfilled') setSpaces(sp.value.spaces);
    if (tp.status === 'fulfilled') setTopics(tp.value.topics);
  }
  useEffect(() => {
    load();
  }, []);

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  async function capture() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.post('/v1/memories', { content: note.trim() });
      setNote('');
      toast('success', 'Saved to your brain.');
      load();
    } catch {
      toast('error', 'Could not save that.');
    } finally {
      setSaving(false);
    }
  }

  // Read text/markdown files in the browser and add each as a memory.
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const readable = Array.from(files).filter((f) => /\.(md|markdown|txt|text|csv|log|json|mdx|rst)$/i.test(f.name) || f.type.startsWith('text/'));
    if (readable.length === 0) {
      toast('error', 'Only text and markdown files can be added here.');
      return;
    }
    setUploading(true);
    let ok = 0;
    for (const file of readable) {
      try {
        const content = await file.text();
        if (!content.trim()) continue;
        const isMd = /\.(md|markdown|mdx)$/i.test(file.name);
        await api.post('/v1/memories', {
          title: file.name,
          content,
          format: isMd ? 'markdown' : 'text',
          sourceType: 'upload',
          metadata: { filename: file.name, size: file.size },
        });
        ok += 1;
      } catch {
        /* keep going */
      }
    }
    setUploading(false);
    toast(ok > 0 ? 'success' : 'error', ok > 0 ? `Added ${ok} file${ok === 1 ? '' : 's'}.` : 'Could not add those files.');
    if (ok > 0) load();
  }

  const counts = status?.counts;

  return (
    <Page
      title="Overview"
      subtitle={status ? `${status.embedding.provider} embeddings, ${status.llm.available ? status.llm.provider + ' llm' : 'no llm'}` : undefined}
    >
      {/* Search bar */}
      <form onSubmit={search} className="mb-5">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3.5 transition-colors focus-within:border-[var(--color-primary-line)]">
          <IconSearch size={18} className="text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask your brain anything, or search for it"
            className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-ink-faint sm:block">
            enter
          </kbd>
        </div>
      </form>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<IconMemory size={16} />} label="Memories" value={counts?.documents} />
        <Stat icon={<IconLayers size={16} />} label="Chunks" value={counts?.chunks} />
        <Stat icon={<IconSpaces size={16} />} label="Spaces" value={counts?.spaces} />
        <Stat
          icon={<IconSparkle size={16} />}
          label="Model"
          text={status?.embedding.model ?? '—'}
        />
      </div>

      {/* Topics: background organization at a glance */}
      {topics.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Link href="/topics" className="mr-1 flex items-center gap-1 font-mono text-[12px] text-ink-faint hover:text-ink">
            <IconHash size={13} /> topics
          </Link>
          {topics.map((t) => (
            <Link
              key={t.topic}
              href={`/search?q=${encodeURIComponent(t.topic)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[13px] text-ink-muted transition-colors hover:border-[var(--color-primary-line)] hover:text-ink"
            >
              {t.topic}
              <span className="font-mono text-[10px] text-ink-faint">{t.count}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Recent memories */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-mono text-sm text-ink-muted">Recent</h2>
            <Link href="/memories" className="flex items-center gap-1 text-[13px] text-ink-faint hover:text-ink">
              All memories <IconArrowRight size={13} />
            </Link>
          </div>
          {memories === null ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : memories.length === 0 ? (
            <EmptyState
              title="nothing indexed yet"
              description="Capture a note on the right, or connect a source to fill your brain."
              icon={<IconMemory size={28} />}
            />
          ) : (
            <ul className="space-y-2">
              {memories.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/memories/${m.id}`}
                    className="block rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-hover"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate font-medium text-ink">{m.title ?? 'Untitled'}</p>
                      <span className="shrink-0 font-mono text-[11px] text-ink-faint">{timeAgo(m.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
                      {m.content?.slice(0, 200)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                        <StatusDot status={m.status} />
                        {m.status}
                      </span>
                      <Badge tone="neutral" mono>
                        {m.connector}
                      </Badge>
                      {hostname(m.sourceUrl) && <Badge tone="info">{hostname(m.sourceUrl)}</Badge>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick capture */}
        <section className="space-y-5">
          <div
            className={cx('card p-4 transition-colors', dragOver && 'border-[var(--color-primary-line)] bg-[var(--color-primary-soft)]')}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <h2 className="mb-2.5 flex items-center gap-1.5 font-mono text-sm text-ink-muted">
              <IconSparkle size={15} className="text-[var(--color-primary)]" /> Quick capture
            </h2>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') capture();
              }}
              rows={5}
              placeholder="Paste a decision, a doc, a link, a thought. Or drop text and markdown files here."
            />
            <div className="mt-2.5 flex items-center justify-between">
              <label className="cursor-pointer font-mono text-[11px] text-ink-faint transition-colors hover:text-ink">
                {uploading ? 'uploading…' : '+ upload files'}
                <input
                  type="file"
                  multiple
                  accept=".md,.markdown,.mdx,.txt,.text,.csv,.log,.json,.rst,text/*"
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              <Button variant="primary" size="sm" onClick={capture} loading={saving} disabled={!note.trim()}>
                Save memory
              </Button>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="mb-3 font-mono text-sm text-ink-muted">Spaces</h2>
            {spaces.length === 0 ? (
              <p className="text-[13px] text-ink-faint">No spaces yet.</p>
            ) : (
              <ul className="space-y-1">
                {spaces.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/memories?spaceId=${s.id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <span className="flex items-center gap-2">
                        <span className={cx('size-1.5 rounded-full', s.isDefault ? 'bg-[var(--color-primary)]' : 'bg-ink-faint')} />
                        {s.name}
                      </span>
                      <span className="font-mono text-[11px] text-ink-faint">{s.documentCount ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </Page>
  );
}

function Stat({
  icon,
  label,
  value,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  text?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-ink-faint">
        {icon}
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 font-mono text-2xl font-semibold text-ink">
        {text ?? (value === undefined ? <span className="text-ink-faint">—</span> : value.toLocaleString())}
      </p>
    </div>
  );
}
