'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';
import { BrainMark } from '@/components/logo';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', orgName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // name and workspace are optional; the server names the workspace for you when
    // they are omitted. Sending an empty string instead trips its min-length check,
    // so only include them when the user actually typed something.
    const payload: Record<string, string> = {
      email: form.email.trim(),
      password: form.password,
    };
    if (form.name.trim()) payload.name = form.name.trim();
    if (form.orgName.trim()) payload.orgName = form.orgName.trim();
    try {
      await api.post('/v1/auth/register', payload);
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        setError('That email is already registered.');
      else if (err instanceof ApiError && err.status === 400)
        setError('Password must be at least 8 characters.');
      else setError('Could not create the workspace.');
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
        <p className="mt-1 text-sm text-ink-muted">Create a workspace. You become the owner.</p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Your name" htmlFor="name">
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ada"
            />
          </Field>
          <Field label="Workspace" htmlFor="org">
            <Input
              id="org"
              value={form.orgName}
              onChange={(e) => set('orgName', e.target.value)}
              placeholder="Acme"
            />
          </Field>
        </div>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="you@company.com"
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        {error && (
          <p className="rounded-md border border-[color-mix(in_oklch,var(--color-danger),transparent_55%)] bg-[var(--color-danger-soft)] px-3 py-2 text-[13px] text-[var(--color-danger-ink)]">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          Create workspace
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Already have one?{' '}
        <Link href="/login" className="text-[var(--color-primary)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
