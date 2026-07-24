'use client';

import { useState } from 'react';
import Link from 'next/link';
import { API_URL, type Citation } from '@/lib/api';
import { Page } from '@/components/app-shell';
import { Button, Input, EmptyState, Badge } from '@/components/ui';
import { IconLayers, IconSparkle, IconArrowRight } from '@/components/icons';

interface Playbook {
  title: string;
  content: string;
  citations: Citation[];
}

const SUGGESTIONS = [
  'How we ship a release',
  'Onboarding a new customer',
  'Our stance on pricing',
  'Incident response process',
];

export default function PlaybooksPage() {
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyMarkdown() {
    if (!playbook) return;
    try {
      await navigator.clipboard.writeText(playbook.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }

  function downloadMarkdown() {
    if (!playbook) return;
    const slug =
      (playbook.title || 'playbook')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'playbook';
    const url = URL.createObjectURL(new Blob([playbook.content], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generate(t?: string) {
    const q = (t ?? topic).trim();
    if (!q || busy) return;
    setTopic(q);
    setBusy(true);
    setError(null);
    setPlaybook({ title: q, content: '', citations: [] });
    try {
      const res = await fetch(`${API_URL}/v1/playbooks/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: q, limit: 12 }),
      });
      if (!res.ok || !res.body) {
        // Surface the API's reason (rate limit, no LLM configured, ...).
        const errText = await res.text().catch(() => '');
        let reason = 'Could not generate a playbook. Is the API reachable and an LLM configured?';
        try {
          const e = JSON.parse(errText) as { message?: string; error?: string };
          if (e.message ?? e.error) reason = (e.message ?? e.error) as string;
        } catch {
          /* keep the generic reason */
        }
        throw new Error(reason);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';
      let citations: Citation[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          let event = 'message';
          let data = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (event === 'citations') {
            try {
              citations = JSON.parse(data) as Citation[];
            } catch {
              /* ignore */
            }
          } else if (event === 'token') {
            try {
              content += JSON.parse(data) as string;
            } catch {
              content += data;
            }
            const snapshot = content;
            setPlaybook({ title: q, content: snapshot, citations });
          }
        }
      }
      setPlaybook({ title: q, content, citations });
    } catch (err) {
      setPlaybook(null);
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Could not generate a playbook. Is the API reachable and an LLM configured?',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Playbooks"
      subtitle="A living page, synthesized from your memories and grounded in citations. Regenerate it and it reflects what the team knows now."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          aria-label="Playbook topic"
          placeholder="A topic to write up — e.g. how we ship a release"
          className="h-11 flex-1 text-[15px]"
        />
        <Button
          variant="primary"
          size="lg"
          onClick={() => generate()}
          loading={busy}
          disabled={!topic.trim()}
        >
          <IconSparkle size={16} />
          Generate
        </Button>
      </form>

      {!playbook && !busy && (
        <div className="mt-6">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => generate(s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
              >
                {s}
                <IconArrowRight size={13} className="text-ink-faint" />
              </button>
            ))}
          </div>
          <div className="mt-8">
            <EmptyState
              title="Write a playbook from memory"
              description="Pick a topic. CompanyBrain gathers the relevant memories and drafts a structured, cited page you can read on Monday."
              icon={<IconLayers size={28} />}
            />
          </div>
        </div>
      )}

      {busy && (
        <div className="mt-8 flex items-center gap-2.5 text-ink-faint">
          <IconSparkle size={16} className="animate-pulse text-[var(--color-primary)]" />
          <span className="text-sm">Reading the memories and drafting the playbook…</span>
        </div>
      )}

      {error && !busy && (
        <div className="mt-6 rounded-lg border border-[color-mix(in_oklch,var(--color-danger),transparent_55%)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger-ink)]">
          {error}
        </div>
      )}

      {playbook && !busy && (
        <article className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-bg-subtle px-6 py-3">
            <Badge tone="primary" mono>
              playbook
            </Badge>
            <div className="flex items-center gap-4">
              <button onClick={copyMarkdown} className="text-[13px] text-ink-faint hover:text-ink">
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={downloadMarkdown}
                className="text-[13px] text-ink-faint hover:text-ink"
              >
                Download .md
              </button>
              <button
                onClick={() => generate()}
                className="text-[13px] text-ink-faint hover:text-ink"
              >
                Regenerate
              </button>
            </div>
          </div>
          <div className="px-6 py-6 sm:px-8">
            <Markdown source={playbook.content} />
            {playbook.citations.length > 0 && (
              <div className="mt-8 border-t border-border pt-5">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  Sources
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {playbook.citations.map((c) => (
                    <Link
                      key={c.index}
                      href={`/memories/${c.documentId}`}
                      title={c.snippet}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[12px] text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
                    >
                      <span className="font-mono text-[10px] text-[var(--color-primary)]">
                        [{c.index}]
                      </span>
                      <span className="max-w-40 truncate">{c.title ?? 'Untitled'}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      )}
    </Page>
  );
}

/** Minimal Markdown renderer for the playbook structure (headings, bullets, bold, citations). */
function Markdown({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-3 space-y-1.5 pl-1">
          {list.map((li, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-ink">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
              <span>{inline(li)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#\s+/.test(line)) {
      flush();
      out.push(
        <h1
          key={out.length}
          className="mb-1 font-display text-2xl font-semibold tracking-tight text-ink"
        >
          {line.replace(/^#\s+/, '')}
        </h1>,
      );
    } else if (/^##\s+/.test(line)) {
      flush();
      out.push(
        <h2 key={out.length} className="mb-2 mt-6 font-display text-lg font-semibold text-ink">
          {line.replace(/^##\s+/, '')}
        </h2>,
      );
    } else if (/^###\s+/.test(line)) {
      flush();
      out.push(
        <h3 key={out.length} className="mb-1.5 mt-4 text-[15px] font-semibold text-ink">
          {line.replace(/^###\s+/, '')}
        </h3>,
      );
    } else if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ''));
    } else if (line.trim() === '') {
      flush();
    } else {
      flush();
      out.push(
        <p key={out.length} className="my-3 text-[15px] leading-relaxed text-ink">
          {inline(line)}
        </p>,
      );
    }
  }
  flush();
  return <div>{out}</div>;
}

/** Render inline **bold** and [n] citation markers. */
function inline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(\d+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] != null) {
      parts.push(
        <strong key={k++} className="font-semibold text-ink">
          {m[1]}
        </strong>,
      );
    } else if (m[2] != null) {
      parts.push(
        <sup key={k++} className="mx-0.5 font-mono text-[10px] text-[var(--color-primary)]">
          [{m[2]}]
        </sup>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
