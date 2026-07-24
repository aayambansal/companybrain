'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { api, type Me } from '@/lib/api';
import { Logo, BrainMark } from './logo';
import { Spinner, TooltipProvider } from './ui';
import { CommandPalette } from './command-palette';
import { NAV_ITEMS, NAV_GROUPS } from './nav-items';
import { IconLogout, IconSearch, IconSettings } from './icons';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'anon'>('loading');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let alive = true;
    api
      .get<Me>('/v1/auth/me')
      .then((m) => {
        if (!alive) return;
        if (!m.org) {
          setState('anon');
          router.replace('/login');
        } else {
          setMe(m);
          setState('ready');
        }
      })
      .catch(() => {
        if (!alive) return;
        setState('anon');
        router.replace('/login');
      });
    return () => {
      alive = false;
    };
  }, [router]);

  // "/" jumps to search from anywhere outside a text field. Cmd-K opens the
  // palette and is owned by CommandPalette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      e.preventDefault();
      router.push('/search');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  if (state !== 'ready' || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="flex items-center gap-2.5 text-ink-faint">
          <Spinner className="size-4" />
          <span className="text-sm">Loading your brain</span>
        </div>
      </div>
    );
  }

  async function logout() {
    try {
      await api.post('/v1/auth/logout');
    } finally {
      router.replace('/login');
    }
  }

  const label = me.user?.name ?? me.user?.email ?? 'Workspace';
  const initials = label.slice(0, 2).toUpperCase();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <TooltipProvider delayDuration={300}>
      <CommandPalette />
      <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[15rem_1fr]">
        {/* Rail. Deeper than the canvas so navigation reads as chassis. */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-[var(--color-rail)] md:flex">
          <div className="flex h-14 items-center px-4">
            <Link href="/" className="rounded-md" aria-label="CompanyBrain home">
              <Logo />
            </Link>
          </div>

          <div className="px-3 pb-2">
            <CommandHint />
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-2" aria-label="Main">
            {NAV_GROUPS.map((group) => (
              <div key={group.key} className="mb-4">
                <p className="px-2.5 pb-1 text-2xs font-medium text-ink-faint">{group.label}</p>
                <div className="space-y-0.5">
                  {NAV_ITEMS.filter((i) => i.group === group.key).map((item) => {
                    const active = isActive(item.href, item.exact);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                          active ? 'text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="nav-active"
                            transition={
                              reduceMotion
                                ? { duration: 0 }
                                : { type: 'spring', stiffness: 500, damping: 40 }
                            }
                            className="absolute inset-0 -z-10 rounded-md bg-[var(--color-primary-soft)] ring-1 ring-[var(--color-primary-line)]"
                          />
                        )}
                        <Icon
                          size={16}
                          className={cn('shrink-0', active && 'text-primary')}
                          aria-hidden
                        />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-border p-3">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-surface-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 font-mono text-2xs text-ink-muted">
                    {initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{label}</span>
                    <span className="block truncate text-2xs text-ink-faint">{me.org?.name}</span>
                  </span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="min-w-[13rem] rounded-lg border border-border bg-surface-2 p-1 shadow-[var(--shadow-lg)]"
                  style={{ zIndex: 'var(--z-dropdown)' as unknown as number }}
                >
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/settings"
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink-muted outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-ink"
                    >
                      <IconSettings size={15} /> Settings
                    </Link>
                  </DropdownMenu.Item>
                  {me.authMode !== 'single' && (
                    <>
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Item
                        onSelect={logout}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink-muted outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-ink"
                      >
                        <IconLogout size={15} /> Sign out
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          {/* Mobile bar */}
          <header className="sticky top-0 z-[var(--z-sticky)] flex h-14 items-center justify-between border-b border-border bg-[var(--color-bg)]/90 px-4 backdrop-blur md:hidden">
            <Link href="/" className="flex items-center gap-2">
              <BrainMark size={20} className="text-primary" />
              <span className="text-sm font-semibold">CompanyBrain</span>
            </Link>
            <Link
              href="/search"
              aria-label="Search"
              className="rounded-md p-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <IconSearch size={18} />
            </Link>
          </header>

          <nav
            className="flex gap-1 overflow-x-auto border-b border-border bg-[var(--color-rail)] px-3 py-2 md:hidden"
            aria-label="Main"
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'shrink-0 rounded-md px-3 py-1.5 text-sm',
                    active
                      ? 'bg-[var(--color-primary-soft)] text-primary'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

/** Opens the palette by dispatching the same shortcut the palette listens for. */
function CommandHint() {
  const [mac, setMac] = useState(true);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);
  return (
    <button
      onClick={() =>
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
        )
      }
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 py-2',
        'text-sm text-ink-faint transition-colors hover:border-border-strong hover:text-ink-muted',
      )}
    >
      <IconSearch size={15} className="shrink-0" />
      <span className="flex-1 text-left">Search</span>
      <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-2xs">
        {mac ? '⌘' : 'Ctrl '}K
      </kbd>
    </button>
  );
}

/** Standard page container with a header row. */
export function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 md:px-8 md:py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
