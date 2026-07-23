'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, type Me } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';
import { BrainMark } from '@/components/logo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If sign-in is off (single-user mode) or a session already exists, skip login.
  useEffect(() => {
    api
      .get<Me>('/v1/auth/me')
      .then((m) => {
        if (m.org) router.replace('/');
      })
      .catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/v1/auth/login', { email, password });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Wrong email or password.' : 'Could not sign in.');
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col items-center text-center">
        <BrainMark size={34} className="text-[var(--color-primary)]" />
        <h1 className="mt-4 font-mono text-lg font-semibold">
          <span className="text-ink">company</span>
          <span className="text-[var(--color-primary)]">brain</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to your workspace.</p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        {error && (
          <p className="rounded-md border border-[color-mix(in_oklch,var(--color-danger),transparent_55%)] bg-[var(--color-danger-soft)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        No workspace yet?{' '}
        <Link href="/register" className="text-[var(--color-primary)] hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
