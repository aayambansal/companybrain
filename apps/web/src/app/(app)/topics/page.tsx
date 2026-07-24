'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Page } from '@/components/app-shell';
import { Badge, Skeleton, EmptyState } from '@/components/ui';
import { IconSpaces } from '@/components/icons';

interface Topic {
  topic: string;
  count: number;
  sample: { id: string; title: string | null }[];
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[] | null>(null);

  useEffect(() => {
    api
      .get<{ topics: Topic[] }>('/v1/topics?limit=48&minCount=1')
      .then((r) => setTopics(r.topics))
      .catch(() => setTopics([]));
  }, []);

  return (
    <Page
      title="Topics"
      subtitle="The projects, people, and themes running through your brain — grouped automatically from what you've indexed. Nothing to file."
    >
      {topics === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <EmptyState
          title="No topics yet"
          description="Index a few memories with an LLM configured for enrichment, or connect a source. Topics form on their own from tags and people."
          icon={<IconSpaces size={28} />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <div
              key={t.topic}
              className="flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <Link
                  href={`/search?q=${encodeURIComponent(t.topic)}`}
                  className="truncate font-display text-[15px] font-semibold text-ink hover:text-[var(--color-primary-strong)]"
                >
                  {t.topic}
                </Link>
                <Badge tone="primary" mono>
                  {t.count}
                </Badge>
              </div>
              <ul className="space-y-1.5">
                {t.sample.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/memories/${m.id}`}
                      className="flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
                    >
                      <span className="size-1 shrink-0 rounded-full bg-ink-faint" />
                      <span className="truncate">{m.title ?? 'Untitled'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
