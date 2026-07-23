'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { API_URL, type Citation } from '@/lib/api';
import { Button, Textarea, EmptyState } from '@/components/ui';
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
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
  }

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: 'user', content: q }, { role: 'assistant', content: '', streaming: true }]);
    scrollDown();

    try {
      const res = await fetch(`${API_URL}/v1/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history, limit: 8 }),
      });
      if (!res.ok || !res.body) throw new Error('stream failed');
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
            update((a) => ({ ...a, content: a.content + data }));
            scrollDown();
          }
        }
      }
      update((a) => ({ ...a, streaming: false }));
    } catch {
      setTurns((t) => {
        const copy = t.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant')
          copy[copy.length - 1] = { ...last, content: 'Something went wrong reaching the brain.', streaming: false };
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
        <h1 className="font-mono text-xl font-semibold tracking-tight">Ask</h1>
        {turns.length > 0 && (
          <button onClick={() => setTurns([])} className="text-[13px] text-ink-faint hover:text-ink">
            New thread
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto pb-4">
        {turns.length === 0 ? (
          <div className="pt-10">
            <EmptyState
              title="ask your company brain"
              description="Answers are grounded in your indexed knowledge and come back with citations you can open."
              icon={<IconChat size={28} />}
            />
            <div className="mx-auto mt-6 flex max-w-md flex-col gap-2">
              {['What did we decide about the release process?', 'Summarize what we know about onboarding', 'Who owns the billing system?'].map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-2.5 text-left text-[13px] text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
                  >
                    {s}
                    <IconArrowRight size={14} className="text-ink-faint" />
                  </button>
                ),
              )}
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
            placeholder="Ask anything about your knowledge"
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 focus:border-0"
          />
          <Button variant="primary" size="md" onClick={() => ask()} loading={busy} disabled={!input.trim()}>
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
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[15px] text-ink">{turn.content}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-[var(--color-primary-soft)]">
        <IconSparkle size={15} className="text-[var(--color-primary)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="prose-invert whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
          {turn.content}
          {turn.streaming && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-[var(--color-primary)]" />}
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
                <span className="font-mono text-[10px] text-[var(--color-primary)]">[{c.index}]</span>
                <span className="max-w-40 truncate">{c.title ?? 'Untitled'}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
