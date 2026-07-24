'use client';

/**
 * The dashboard's component vocabulary, built on Radix primitives (accessible
 * behaviour, focus management, portalling) with class-variance-authority for
 * variants. Every interactive component here ships default, hover, focus,
 * active, and disabled states.
 */
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Button ─────────────────────────────────────────────────────────────────
const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium select-none whitespace-nowrap ' +
    'transition-[background-color,border-color,color,box-shadow] duration-150 ' +
    'disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-[var(--color-primary-ink)] hover:bg-[var(--color-primary-strong)] ' +
          'shadow-[var(--shadow-sm)] active:brightness-95',
        secondary:
          'bg-surface-2 text-ink border border-border hover:bg-surface-hover ' +
          'hover:border-border-strong shadow-[var(--bevel)]',
        ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
        danger:
          'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger-soft)] ' +
          'hover:border-[var(--color-danger)]',
      },
      size: {
        sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
        md: 'h-9.5 px-4 text-sm gap-2 rounded-md',
        lg: 'h-11 px-5 text-base gap-2 rounded-lg',
        icon: 'size-9 rounded-md',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, className, children, disabled, asChild, ...rest },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
});

// ── Form controls ──────────────────────────────────────────────────────────
const fieldBase =
  'w-full rounded-md border border-border bg-[var(--color-bg-subtle)] text-ink ' +
  'placeholder:text-ink-faint transition-colors ' +
  'hover:border-border-strong focus:border-[var(--color-primary-line)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(fieldBase, 'h-9.5 px-3 text-sm', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, 'resize-y px-3 py-2.5 text-sm leading-relaxed', className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          fieldBase,
          'h-9.5 appearance-none bg-[right_0.6rem_center] bg-no-repeat pr-8 pl-3 text-sm',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e929b' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>\")",
        }}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

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
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-ink-muted border-border',
        primary: 'bg-[var(--color-primary-soft)] text-primary border-[var(--color-primary-line)]',
        spark:
          'bg-[var(--color-spark-soft)] text-[var(--color-spark)] border-[var(--color-spark-line)]',
        success:
          'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success-soft)]',
        warn: 'bg-[var(--color-warn-soft)] text-[var(--color-warn)] border-[var(--color-warn-soft)]',
        danger:
          'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger-soft)]',
        info: 'bg-[var(--color-info-soft)] text-[var(--color-info)] border-[var(--color-info-soft)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  tone,
  children,
  className,
  mono,
}: VariantProps<typeof badgeVariants> & {
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span className={cn(badgeVariants({ tone }), mono && 'font-mono', className)}>{children}</span>
  );
}

/**
 * Indexing status. Shape carries the meaning as much as hue: a ring for
 * pending, a filled dot for indexed, a pulsing ring for live processing.
 */
export function StatusDot({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string; live?: boolean; hollow?: boolean }> = {
    indexed: { color: 'var(--color-success)', label: 'Indexed' },
    failed: { color: 'var(--color-danger)', label: 'Failed' },
    processing: { color: 'var(--color-spark)', label: 'Indexing', live: true },
    pending: { color: 'var(--color-ink-faint)', label: 'Pending', hollow: true },
  };
  const s = map[status] ?? { color: 'var(--color-ink-faint)', label: status, hollow: true };
  return (
    <span className="inline-flex items-center" title={s.label}>
      <span className="sr-only">{s.label}</span>
      <span
        className={cn('inline-block size-2 rounded-full', s.live && 'live-dot')}
        style={
          s.hollow
            ? { boxShadow: `inset 0 0 0 1.5px ${s.color}` }
            : { background: s.color, ...(s.live ? { background: 'var(--color-spark)' } : {}) }
        }
      />
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-surface-2', className)}>
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in oklch, var(--color-surface-hover), transparent 25%), transparent)',
          animation: 'cb-shimmer 1.5s infinite',
        }}
      />
    </div>
  );
}

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
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Radix re-exports, styled ───────────────────────────────────────────────
export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  children,
  side = 'right',
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className={cn(
            'z-[var(--z-tooltip)] rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-ink',
            'shadow-[var(--shadow-md)]',
            'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border',
        'transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-3.5 rounded-full bg-ink shadow-sm transition-transform',
          'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5',
          'data-[state=checked]:bg-[var(--color-primary-ink)]',
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn('inline-flex items-center gap-1 border-b border-border', className)}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        '-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-muted',
        'transition-colors hover:text-ink',
        'data-[state=active]:border-primary data-[state=active]:text-ink',
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = TabsPrimitive.Content;

export const Separator = forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(function Separator({ className, orientation = 'horizontal', ...props }, ref) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
});

/** Legacy alias: several pages still import `cx`. */
export const cx = cn;
export { cn };
