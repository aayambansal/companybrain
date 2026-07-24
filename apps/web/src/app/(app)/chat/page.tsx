'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { API_URL, type Citation } from '@/lib/api';
import { Button, Textarea } from '@/components/ui';
import { IconChat, IconArrowRight, IconSparkle } from '@/components/icons';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  streaming?: boolean;
}

export default function ChatPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollDown() {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
    );
  }

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [
      ...t,
      { role: 'user', content: q },
      { role: 'assistant', content: '', streaming: true },
    ]);
    scrollDown();

    try {
      const res = await fetch(`${API_URL}/v1/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history, limit: 8 }),
      });
      if (!res.ok || !res.body) {
        // Surface the API's reason (rate limit, no LLM configured, ...) instead
        // of a generic failure, so the user knows what to do.
        const errText = await res.text().catch(() => '');
        let reason = 'Something went wrong reaching the brain.';
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
      let citations: Citation[] = [];

      const update = (fn: (a: Turn) => Turn) =>
        setTurns((t) => {
          const copy = t.slice();
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') copy[copy.length - 1] = fn(last);
          return copy;
        });

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
            update((a) => ({ ...a, citations }));
          } else if (event === 'token') {
            try {
              update((a) => ({ ...a, content: a.content + (JSON.parse(data) as string) }));
            } catch {
              /* ignore a malformed token frame */
            }
            scrollDown();
          }
        }
      }
      update((a) => ({ ...a, streaming: false }));
    } catch (err) {
      const reason =
        err instanceof Error && err.message
          ? err.message
          : 'Something went wrong reaching the brain.';
      setTurns((t) => {
        const copy = t.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant')
          copy[copy.length - 1] = {
            ...last,
            content: reason,
            streaming: false,
          };
        return copy;
      });
    } finally {
      setBusy(false);
      scrollDown();
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-3xl flex-col px-5 md:h-dvh md:px-8">
      <div className="flex items-center justify-between py-5">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Ask</h1>
        {turns.length > 0 && (
          <button
            onClick={() => setTurns([])}
            className="text-[13px] text-ink-faint hover:text-ink"
          >
            New thread
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto pb-4">
        {turns.length === 0 ? (
          /* The page is already empty, so a dashed container inside it would be
             redundant. Centre one block in the free space and let the example
             questions be the affordance: they teach what this can answer and
             start the task in one click. */
          <div className="flex h-full flex-col items-center justify-center py-10">
            <div className="grid size-11 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-primary">
              <IconChat size={22} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Ask your company brain</h2>
            <p className="mt-1.5 max-w-sm text-center text-sm text-ink-muted">
              Answers are grounded in what you have indexed and come back with citations you can
              open.
            </p>
            <div className="mt-7 flex w-full max-w-md flex-col gap-2">
              {[
                'What did we decide about the release process?',
                'Summarize what we know about onboarding',
                'Who owns the billing system?',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-left text-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
                >
                  {s}
                  <IconArrowRight
                    size={14}
                    className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((t, i) => <Message key={i} turn={t} />)
        )}
      </div>

      <form onSubmit={ask} className="border-t border-border py-4">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-bg-subtle p-2 transition-colors focus-within:border-[var(--color-primary-line)]">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            rows={1}
            aria-label="Ask a question about your knowledge"
            placeholder="Ask anything about your knowledge"
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 focus:border-0"
          />
          <Button
            variant="primary"
            size="md"
            onClick={() => ask()}
            loading={busy}
            disabled={!input.trim()}
          >
            <IconSparkle size={15} />
          </Button>
        </div>
      </form>
    </div>
  );
}

function Message({ turn }: { turn: Turn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[15px] text-ink">
          {turn.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-[var(--color-primary-soft)]">
        <IconSparkle size={15} className="text-[var(--color-primary)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
          {turn.content}
          {turn.streaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-[var(--color-primary)]" />
          )}
        </div>
        {turn.citations && turn.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {turn.citations.map((c) => (
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
        )}
      </div>
    </div>
  );
}
