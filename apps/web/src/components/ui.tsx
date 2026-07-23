'use client';

import { forwardRef } from 'react';

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ── Button ─────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const sizeCls: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  const base =
    'inline-flex items-center justify-center font-medium select-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<ButtonVariant, string> = {
    primary: 'btn-primary',
    secondary:
      'bg-surface-2 text-ink border border-border-strong hover:bg-surface-hover',
    ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
    danger:
      'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-ink',
  };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(base, sizeCls[size], variants[variant], className)}
      {...rest}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  );
});

// ── Input ──────────────────────────────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cx(
          'h-9.5 w-full rounded-md border border-border bg-bg-subtle px-3 text-sm text-ink',
          'placeholder:text-ink-faint transition-colors',
          'hover:border-border-strong focus:border-[var(--color-primary-line)]',
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cx(
          'w-full rounded-md border border-border bg-bg-subtle px-3 py-2.5 text-sm text-ink leading-relaxed',
          'placeholder:text-ink-faint transition-colors resize-y',
          'hover:border-border-strong focus:border-[var(--color-primary-line)]',
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cx(
          'h-9.5 w-full rounded-md border border-border bg-bg-subtle px-3 text-sm text-ink',
          'transition-colors hover:border-border-strong focus:border-[var(--color-primary-line)]',
          'appearance-none bg-[right_0.6rem_center] bg-no-repeat pr-8',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>\")",
        }}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

// ── Field ──────────────────────────────────────────────────────────────────
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────
type BadgeTone = 'neutral' | 'primary' | 'success' | 'warn' | 'danger' | 'info';
const badgeTone: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-muted border-border',
  primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] border-[var(--color-primary-line)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[color-mix(in_oklch,var(--color-success),transparent_60%)]',
  warn: 'bg-[color-mix(in_oklch,var(--color-warn),transparent_85%)] text-[var(--color-warn)] border-[color-mix(in_oklch,var(--color-warn),transparent_60%)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[color-mix(in_oklch,var(--color-danger),transparent_55%)]',
  info: 'bg-[var(--color-info-soft)] text-[var(--color-info)] border-[color-mix(in_oklch,var(--color-info),transparent_60%)]',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  mono,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        mono && 'font-mono',
        badgeTone[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const tone =
    status === 'indexed'
      ? 'var(--color-success)'
      : status === 'failed'
        ? 'var(--color-danger)'
        : status === 'processing'
          ? 'var(--color-primary)'
          : 'var(--color-ink-faint)';
  return (
    <span
      className="inline-block size-1.5 rounded-full"
      style={{ background: tone, animation: status === 'processing' ? 'cb-pulse 1.4s ease-in-out infinite' : undefined }}
      title={status}
    />
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx('relative overflow-hidden rounded-md bg-surface-2', className)}>
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in oklch, var(--color-surface-hover), transparent 30%), transparent)',
          animation: 'cb-shimmer 1.4s infinite',
        }}
      />
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <h3 className="font-mono text-sm text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export { cx };
