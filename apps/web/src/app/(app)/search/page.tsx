'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, type SearchResponse, type SearchHit } from '@/lib/api';
import { Page } from '@/components/app-shell';
import { Badge, Skeleton, EmptyState, cx } from '@/components/ui';
import { IconSearch, IconExternal } from '@/components/icons';
import { hostname } from '@/lib/format';

type Mode = 'hybrid' | 'semantic' | 'keyword';
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'hybrid', label: 'Hybrid', hint: 'vector + keyword, fused' },
  { id: 'semantic', label: 'Semantic', hint: 'meaning only' },
  { id: 'keyword', label: 'Keyword', hint: 'exact terms' },
];

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get('q') ?? '';
  const [q, setQ] = useState(initial);
  const [mode, setMode] = useState<Mode>('hybrid');
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (query: string, m: Mode) => {
    if (!query.trim()) {
      setRes(null);
      setFailed(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      const r = await api.post<SearchResponse>('/v1/search', { q: query, mode: m, limit: 20 });
      setRes(r);
    } catch {
      // Distinguish a failed request from a genuinely empty result, so we never
      // tell someone "nothing matched" when the search never actually ran.
      setRes(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial) run(initial, 'hybrid');
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.replace(`/search?q=${encodeURIComponent(q)}`);
    run(q, mode);
  }

  function changeMode(m: Mode) {
    setMode(m);
    if (q.trim()) run(q, m);
  }

  return (
    <Page title="Search" subtitle="Retrieve exact passages across everything you have indexed.">
      <form onSubmit={submit}>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3.5 transition-colors focus-within:border-[var(--color-primary-line)]">
          <IconSearch size={18} className="text-ink-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your brain"
            className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => changeMode(m.id)}
            title={m.hint}
            className={cx(
              'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              mode === m.id
                ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            {m.label}
          </button>
        ))}
        {res && !loading && (
          <span className="ml-auto font-mono text-[11px] text-ink-faint">
            {res.hits.length} results in {res.tookMs}ms
          </span>
        )}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : failed ? (
          <EmptyState
            title="search failed"
            description="Something went wrong reaching the index. Check the connection and try again."
            icon={<IconSearch size={28} />}
          />
        ) : !res ? (
          <EmptyState
            title="type a query"
            description="Try a question, a phrase, or a keyword."
            icon={<IconSearch size={28} />}
          />
        ) : res.hits.length === 0 ? (
          <EmptyState
            title="no matches"
            description={`Nothing indexed matched "${res.query}".`}
            icon={<IconSearch size={28} />}
          />
        ) : (
          <ul className="space-y-3">
            {res.hits.map((h) => (
              <Hit key={h.chunkId} hit={h} query={res.query} />
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}

/** Wrap case-insensitive query-term matches in the text with a subtle mark. */
function highlight(text: string, query: string): React.ReactNode {
  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 1),
    ),
  ).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (terms.length === 0) return text;
  const re = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded bg-[var(--color-primary-soft)] px-0.5 text-[var(--color-primary-strong)]"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function Hit({ hit, query }: { hit: SearchHit; query: string }) {
  const pct = Math.round(hit.score * 100);
  return (
    <li className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/memories/${hit.documentId}`}
          className="font-medium text-ink hover:text-[var(--color-primary)]"
        >
          {hit.document.title ?? 'Untitled'}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-[var(--color-primary)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-ink-faint">{pct}</span>
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-muted">
        {highlight(hit.content, query)}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Badge tone="neutral" mono>
          {hit.document.connector}
        </Badge>
        {hit.scores.vector !== undefined && (
          <Badge tone="primary">vec {hit.scores.vector.toFixed(2)}</Badge>
        )}
        {hit.scores.keyword !== undefined && (
          <Badge tone="info">kw {hit.scores.keyword.toFixed(2)}</Badge>
        )}
        {hit.document.sourceUrl && (
          <a
            href={hit.document.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1 text-[12px] text-ink-faint hover:text-ink"
          >
            {hostname(hit.document.sourceUrl)} <IconExternal size={12} />
          </a>
        )}
      </div>
    </li>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <Page title="Search">
          <Skeleton className="h-12 w-full" />
        </Page>
      }
    >
      <SearchInner />
    </Suspense>
  );
}
