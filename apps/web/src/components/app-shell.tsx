'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type Me } from '@/lib/api';
import { Logo, BrainMark } from './logo';
import { Spinner } from './ui';
import {
  IconHome,
  IconSearch,
  IconChat,
  IconMemory,
  IconSpaces,
  IconPlug,
  IconSettings,
  IconLogout,
  IconLayers,
  IconBook,
  IconHash,
} from './icons';

const NAV = [
  { href: '/', label: 'Overview', icon: IconHome, exact: true },
  { href: '/search', label: 'Search', icon: IconSearch },
  { href: '/chat', label: 'Ask', icon: IconChat },
  { href: '/playbooks', label: 'Playbooks', icon: IconBook },
  { href: '/memories', label: 'Memories', icon: IconMemory },
  { href: '/topics', label: 'Topics', icon: IconHash },
  { href: '/spaces', label: 'Spaces', icon: IconSpaces },
  { href: '/connections', label: 'Connections', icon: IconPlug },
  { href: '/analytics', label: 'Analytics', icon: IconLayers },
  { href: '/settings', label: 'Settings', icon: IconSettings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'anon'>('loading');

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

  // Press "/" from anywhere (outside a text field) to jump to search.
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
          <span className="font-mono text-sm">loading brain</span>
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

  const initials = (me.user?.name ?? me.user?.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-bg-subtle md:flex">
        <div className="flex h-14 items-center px-4">
          <Link href="/" className="rounded-md">
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                    : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                <Icon size={17} className={active ? 'text-[var(--color-primary)]' : ''} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-1 py-1">
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 font-mono text-[11px] text-ink-muted">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-ink">{me.user?.name ?? me.user?.email}</p>
              <p className="truncate text-[11px] text-ink-faint">{me.org?.name}</p>
            </div>
            {me.authMode !== 'single' && (
              <button
                onClick={logout}
                title="Sign out"
                className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <IconLogout size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-col">
        <header className="sticky top-0 z-[var(--z-sticky)] flex h-14 items-center justify-between border-b border-border bg-bg/85 px-4 backdrop-blur md:hidden">
          <Link href="/">
            <div className="flex items-center gap-2">
              <BrainMark size={20} className="text-[var(--color-primary)]" />
              <span className="font-mono text-sm font-semibold">companybrain</span>
            </div>
          </Link>
          {me.authMode !== 'single' && (
            <button onClick={logout} className="text-ink-faint">
              <IconLogout size={18} />
            </button>
          )}
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-bg-subtle px-3 py-2 md:hidden">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] ${
                  active ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]' : 'text-ink-muted'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1">{children}</main>
      </div>
    </div>
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
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[15px] text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
