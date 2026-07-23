'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, type Memory, type Space } from '@/lib/api';
import { Page } from '@/components/app-shell';
import { Badge, StatusDot, Skeleton, EmptyState, Button, cx } from '@/components/ui';
import { timeAgo, hostname } from '@/lib/format';
import { IconMemory, IconPlus } from '@/components/icons';

const PAGE_SIZE = 25;

function MemoriesInner() {
  const params = useSearchParams();
  const spaceId = params.get('spaceId') ?? undefined;
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [activeSpace, setActiveSpace] = useState<string | undefined>(spaceId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selected.size === 0 || deleting) return;
    setDeleting(true);
    try {
      await Promise.all([...selected].map((id) => api.del(`/v1/memories/${id}`).catch(() => null)));
      setSelected(new Set());
      await load(activeSpace, offset);
    } finally {
      setDeleting(false);
    }
  }

  const load = useCallback(async (space: string | undefined, off: number) => {
    setMemories(null);
    const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
    if (space) query.set('spaceId', space);
    const [m, sp] = await Promise.allSettled([
      api.get<{ memories: Memory[]; total: number }>(`/v1/memories?${query}`),
      api.get<{ spaces: Space[] }>('/v1/spaces'),
    ]);
    if (m.status === 'fulfilled') {
      setMemories(m.value.memories);
      setTotal(m.value.total);
    } else {
      setMemories([]);
    }
    if (sp.status === 'fulfilled') setSpaces(sp.value.spaces);
  }, []);

  useEffect(() => {
    load(activeSpace, offset);
  }, [activeSpace, offset, load]);

  function pickSpace(id: string | undefined) {
    setOffset(0);
    setActiveSpace(id);
  }

  const pages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <Page
      title="Memories"
      subtitle={total ? `${total.toLocaleString()} indexed` : undefined}
      actions={
        <Button variant="secondary" size="sm" onClick={() => (window.location.href = '/')}>
          <IconPlus size={15} /> Capture
        </Button>
      }
    >
      {/* Space filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip active={!activeSpace} onClick={() => pickSpace(undefined)}>
          All
        </FilterChip>
        {spaces.map((s) => (
          <FilterChip key={s.id} active={activeSpace === s.id} onClick={() => pickSpace(s.id)}>
            {s.name}
            {s.documentCount !== undefined && <span className="ml-1.5 font-mono text-[10px] opacity-60">{s.documentCount}</span>}
          </FilterChip>
        ))}
      </div>

      {memories === null ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <EmptyState
          title="no memories here"
          description="Capture something from the overview, or configure a connector to sync a source."
          icon={<IconMemory size={28} />}
          action={
            <Link href="/connections">
              <Button variant="secondary" size="sm">
                Browse connectors
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {selected.size > 0 && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] px-4 py-2.5">
              <span className="text-[13px] font-medium text-[var(--color-primary-strong)]">
                {selected.size} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button variant="danger" size="sm" loading={deleting} onClick={deleteSelected}>
                  Delete{selected.size > 1 ? ` ${selected.size}` : ''}
                </Button>
              </div>
            </div>
          )}
          <ul className="space-y-2">
            {memories.map((m) => (
              <li key={m.id} className="flex items-stretch gap-2">
                <button
                  aria-label={selected.has(m.id) ? 'Deselect memory' : 'Select memory'}
                  onClick={() => toggle(m.id)}
                  className={cx(
                    'grid w-9 shrink-0 place-items-center rounded-lg border transition-colors',
                    selected.has(m.id)
                      ? 'border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      : 'border-border bg-surface text-transparent hover:border-border-strong hover:text-ink-faint',
                  )}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                </button>
                <Link
                  href={`/memories/${m.id}`}
                  className="block flex-1 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate font-medium text-ink">{m.title ?? 'Untitled'}</p>
                    <span className="shrink-0 font-mono text-[11px] text-ink-faint">{timeAgo(m.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[13px] text-ink-muted">{m.content?.slice(0, 180)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                      <StatusDot status={m.status} />
                      {m.status}
                    </span>
                    <Badge tone="neutral" mono>
                      {m.connector}
                    </Badge>
                    {hostname(m.sourceUrl) && <Badge tone="info">{hostname(m.sourceUrl)}</Badge>}
                    {m.tags.slice(0, 3).map((t) => (
                      <Badge key={t} tone="primary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="ghost" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                Previous
              </Button>
              <span className="font-mono text-[12px] text-ink-faint">
                {currentPage} / {pages}
              </span>
              <Button variant="ghost" size="sm" disabled={currentPage >= pages} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
        active ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export default function MemoriesPage() {
  return (
    <Suspense fallback={<Page title="Memories"><Skeleton className="h-16 w-full" /></Page>}>
      <MemoriesInner />
    </Suspense>
  );
}
