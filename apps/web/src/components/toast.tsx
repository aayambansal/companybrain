'use client';

/**
 * Toasts, backed by sonner (stacking, swipe-to-dismiss, screen-reader
 * announcements, and reduced-motion handling out of the box).
 *
 * The `useToast()` -> `toast(kind, message)` shape is kept so call sites read
 * the same as before; only the machinery underneath changed.
 */
import { useCallback } from 'react';
import { Toaster as SonnerToaster, toast as sonner } from 'sonner';
import { CircleCheck, CircleAlert, Info } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

export function useToast() {
  return useCallback((kind: ToastKind, message: string) => {
    const icon =
      kind === 'success' ? (
        <CircleCheck className="size-4 text-[var(--color-success)]" />
      ) : kind === 'error' ? (
        <CircleAlert className="size-4 text-[var(--color-danger)]" />
      ) : (
        <Info className="size-4 text-primary" />
      );
    sonner[kind === 'error' ? 'error' : kind === 'success' ? 'success' : 'message'](message, {
      icon,
    });
  }, []);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SonnerToaster
        position="bottom-right"
        gap={8}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              'flex items-center gap-2.5 rounded-md border border-border bg-surface-2 px-3.5 py-2.5 ' +
              'text-sm text-ink shadow-[var(--shadow-md)] w-full',
            title: 'text-ink font-normal',
            description: 'text-ink-muted',
          },
        }}
        style={{ zIndex: 'var(--z-toast)' as unknown as number }}
      />
    </>
  );
}
