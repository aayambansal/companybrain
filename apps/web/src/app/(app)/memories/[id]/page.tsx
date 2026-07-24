'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type Memory, type SearchHit } from '@/lib/api';
import { Badge, StatusDot, Button, Skeleton, EmptyState } from '@/components/ui';
import { useToast } from '@/components/toast';
import { timeAgo, hostname } from '@/lib/format';
import { IconArrowRight, IconExternal, IconTrash, IconMemory } from '@/components/icons';

export default function MemoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [memory, setMemory] = useState<Memory | null | 'missing'>(null);
  const [related, setRelated] = useState<SearchHit[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyContent(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }

  useEffect(() => {
    api
      .get<{ memory: Memory }>(`/v1/memories/${id}`)
      .then((r) => setMemory(r.memory))
      .catch(() => setMemory('missing'));
    api
      .get<{ related: SearchHit[] }>(`/v1/memories/${id}/related?limit=5`)
      .then((r) => setRelated(r.related))
      .catch(() => setRelated([]));
  }, [id]);

  async function remove() {
    if (!confirm('Delete this memory and all its chunks? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.del(`/v1/memories/${id}`);
      toast('success', 'Memory deleted.');
      router.push('/memories');
    } catch {
      toast('error', 'Could not delete.');
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 md:px-8 md:py-8">
      <Link
        href="/memories"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-faint hover:text-ink"
      >
        <IconArrowRight size={13} className="rotate-180" /> Memories
      </Link>

      {memory === null ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : memory === 'missing' ? (
        <EmptyState
          title="Memory not found"
          description="This memory does not exist or was deleted."
          icon={<IconMemory size={28} />}
        />
      ) : (
        <article>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
              {memory.title ?? 'Untitled'}
            </h1>
            <Button variant="danger" size="sm" onClick={remove} loading={deleting}>
              <IconTrash size={14} /> Delete
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
            <span className="flex items-center gap-1.5">
              <StatusDot status={memory.status} /> {memory.status}
            </span>
            <span>·</span>
            <span>captured {timeAgo(memory.createdAt)}</span>
            <Badge tone="neutral" mono>
              {memory.connector}
            </Badge>
            {memory.sourceType && <Badge tone="neutral">{memory.sourceType}</Badge>}
          </div>

          {memory.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {memory.tags.map((t) => (
                <Badge key={t} tone="primary">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {memory.sourceUrl && (
            <a
              href={memory.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
            >
              {hostname(memory.sourceUrl) ?? memory.sourceUrl} <IconExternal size={13} />
            </a>
          )}

          {memory.summary && (
            <div className="mt-6 rounded-lg border border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] p-4">
              <h2 className="mb-1.5 text-[12px] uppercase tracking-wide text-[var(--color-primary-strong)]">
                Summary
              </h2>
              <p className="text-[14px] leading-relaxed text-ink">{memory.summary}</p>
            </div>
          )}

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[12px] uppercase tracking-wide text-ink-faint">Content</h2>
              <button
                onClick={() => copyContent(memory.content ?? '')}
                className="text-[12px] text-ink-faint transition-colors hover:text-ink"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="whitespace-pre-wrap rounded-lg border border-border bg-surface p-5 text-[14px] leading-relaxed text-ink">
              {memory.content}
            </div>
          </div>

          {related.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-[12px] uppercase tracking-wide text-ink-faint">Related</h2>
              <ul className="space-y-2">
                {related.map((h) => (
                  <li key={h.documentId}>
                    <Link
                      href={`/memories/${h.documentId}`}
                      className="block rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-hover"
                    >
                      <p className="truncate text-[14px] font-medium text-ink">
                        {h.document.title ?? 'Untitled'}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[13px] text-ink-muted">
                        {h.content.slice(0, 160)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
