'use client';

/**
 * Command palette (Cmd/Ctrl-K), built on cmdk inside a Radix Dialog.
 *
 * It is the fastest path to the product's actual job: type a question, get the
 * passage. Navigation is the fallback, not the headline, so live search results
 * sit above the page list and win the default selection.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, CornerDownLeft, Loader2 } from 'lucide-react';
import { api, type SearchResponse, type SearchHit } from '@/lib/api';
import { NAV_ITEMS } from './nav-items';
import { cn } from '@/lib/utils';

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  // Cmd/Ctrl-K from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Debounced live retrieval. Stale responses are dropped by sequence number.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++seq.current;
    const t = setTimeout(() => {
      api
        .post<SearchResponse>('/v1/search', { q, limit: 5, mode: 'hybrid' })
        .then((r) => {
          if (id === seq.current) setHits(r.hits ?? []);
        })
        .catch(() => {
          if (id === seq.current) setHits([]);
        })
        .finally(() => {
          if (id === seq.current) setSearching(false);
        });
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery('');
      router.push(href);
    },
    [router],
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in"
          style={{ zIndex: 'var(--z-backdrop)' as unknown as number }}
        />
        <Dialog.Content
          aria-label="Command palette"
          className={cn(
            'fixed left-1/2 top-[18vh] w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2',
            'overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[var(--shadow-lg)]',
          )}
          style={{ zIndex: 'var(--z-modal)' as unknown as number }}
        >
          <Dialog.Title className="sr-only">Search and navigate</Dialog.Title>
          <Dialog.Description className="sr-only">
            Type to search your memories, or jump to a page.
          </Dialog.Description>

          <Command shouldFilter={false} loop className="flex flex-col">
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              {searching ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-[var(--color-spark)]" />
              ) : (
                <Search className="size-4 shrink-0 text-ink-faint" />
              )}
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Ask your brain, or jump to a page"
                className="h-12 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
              />
              <kbd className="hidden shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-ink-faint sm:block">
                esc
              </kbd>
            </div>

            <Command.List className="max-h-[min(24rem,50vh)] overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-ink-muted">
                {query.trim().length < 2
                  ? 'Type at least two characters to search.'
                  : searching
                    ? 'Searching your memory.'
                    : 'Nothing matched. Try different words, or index more sources.'}
              </Command.Empty>

              {hits.length > 0 && (
                <Command.Group
                  heading="From your memory"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-faint"
                >
                  {hits.map((hit) => (
                    <Command.Item
                      key={hit.chunkId}
                      value={`hit-${hit.chunkId}`}
                      onSelect={() => go(`/memories/${hit.documentId}`)}
                      className={cn(
                        'flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2.5',
                        'data-[selected=true]:bg-[var(--color-primary-soft)]',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">
                          {hit.document.title ?? 'Untitled memory'}
                        </span>
                        <span
                          data-numeric
                          className="ml-auto shrink-0 font-mono text-2xs text-ink-faint"
                        >
                          {hit.score.toFixed(2)}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
                        {hit.content}
                      </p>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group
                heading="Go to"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-faint"
              >
                {NAV_ITEMS.filter(
                  (i) =>
                    !query.trim() || i.label.toLowerCase().includes(query.trim().toLowerCase()),
                ).map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.href}
                      value={`nav-${item.label}`}
                      onSelect={() => go(item.href)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-muted',
                        'data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink',
                      )}
                    >
                      <Icon size={16} className="shrink-0" />
                      {item.label}
                      <CornerDownLeft className="ml-auto size-3 opacity-0 data-[selected=true]:opacity-100" />
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
