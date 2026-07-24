'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Page } from '@/components/app-shell';
import { Badge, Skeleton, EmptyState, cx } from '@/components/ui';
import { IconMemory } from '@/components/icons';

interface Analytics {
  totals: { documents: number; chunks: number; spaces: number; connections: number };
  byConnector: { connector: string; count: number }[];
  byStatus: { status: string; count: number }[];
  activity: { day: string; count: number }[];
  topTags: { tag: string; count: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    api
      .get<Analytics>('/v1/analytics')
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (data === null) {
    return (
      <Page title="Analytics">
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="mt-5 h-56 w-full" />
      </Page>
    );
  }

  const maxDay = Math.max(1, ...data.activity.map((a) => a.count));
  const maxConn = Math.max(1, ...data.byConnector.map((c) => c.count));
  const maxTag = Math.max(1, ...data.topTags.map((t) => t.count));
  const empty = data.totals.documents === 0;

  return (
    <Page title="Analytics" subtitle="What's in your brain and how it's growing.">
      {/* One instrument strip, matching Overview: these totals describe the
          same instance, so they read as one line rather than four tiles. */}
      <div className="panel mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3">
        <Reading label="memories" value={data.totals.documents} />
        <Reading label="chunks" value={data.totals.chunks} />
        <Reading label="spaces" value={data.totals.spaces} />
        <Reading label="connections" value={data.totals.connections} />
      </div>

      {empty ? (
        <EmptyState
          title="Nothing to chart yet"
          description="Charts appear once memories start landing. Capture one from the overview, or connect a source."
          icon={<IconMemory size={28} />}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* Activity */}
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-medium text-ink-muted">Added, last 14 days</h2>
            <div className="flex h-40 items-end gap-1.5">
              {data.activity.length === 0 ? (
                <p className="text-[13px] text-ink-faint">No recent activity.</p>
              ) : (
                data.activity.map((a) => (
                  <div
                    key={a.day}
                    className="group flex flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${a.day}: ${a.count}`}
                  >
                    <span className="font-mono text-[10px] text-ink-faint opacity-0 group-hover:opacity-100">
                      {a.count}
                    </span>
                    <div
                      className="w-full rounded-t bg-[var(--color-primary)] transition-all"
                      style={{
                        height: `${Math.max(4, (a.count / maxDay) * 100)}%`,
                        opacity: 0.55 + 0.45 * (a.count / maxDay),
                      }}
                    />
                    <span className="font-mono text-[9px] text-ink-faint">{a.day.slice(5)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Status */}
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-medium text-ink-muted">Status</h2>
            <ul className="space-y-2.5">
              {data.byStatus.map((s) => (
                <li key={s.status} className="flex items-center justify-between text-sm">
                  <Badge
                    tone={
                      s.status === 'indexed'
                        ? 'success'
                        : s.status === 'failed'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {s.status}
                  </Badge>
                  <span className="font-mono text-ink">{s.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* By connector */}
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-medium text-ink-muted">By source</h2>
            <ul className="space-y-2.5">
              {data.byConnector.map((c) => (
                <li key={c.connector}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="font-mono text-ink-muted">{c.connector}</span>
                    <span className="font-mono text-ink-faint">{c.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)]"
                      style={{ width: `${(c.count / maxConn) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Top tags */}
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-medium text-ink-muted">Top tags</h2>
            {data.topTags.length === 0 ? (
              <p className="text-[13px] text-ink-faint">
                No tags yet. Connect an LLM to auto-tag on ingest.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.topTags.map((t) => (
                  <span
                    key={t.tag}
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[12px]',
                    )}
                    style={{
                      background: `color-mix(in oklch, var(--color-primary-soft), transparent ${100 - Math.round((t.count / maxTag) * 100)}%)`,
                    }}
                  >
                    <span className="text-ink-muted">{t.tag}</span>
                    <span className="font-mono text-ink-faint">{t.count}</span>
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}

/** One reading on the instrument strip: the count leads, the noun follows. */
function Reading({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span data-numeric className="text-xl font-semibold text-ink">
        {value.toLocaleString()}
      </span>
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  );
}
