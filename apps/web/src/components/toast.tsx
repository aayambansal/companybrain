'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="fixed bottom-4 right-4 flex flex-col gap-2"
        style={{ zIndex: 'var(--z-toast)' }}
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-sm shadow-[var(--shadow-md)]"
            style={{
              animation: 'cb-fade-up 200ms var(--ease-out-quart)',
              background: 'var(--color-surface-2)',
              borderColor:
                t.kind === 'error'
                  ? 'var(--color-danger)'
                  : t.kind === 'success'
                    ? 'var(--color-success)'
                    : 'var(--color-border-strong)',
            }}
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{
                background:
                  t.kind === 'error'
                    ? 'var(--color-danger)'
                    : t.kind === 'success'
                      ? 'var(--color-success)'
                      : 'var(--color-primary)',
              }}
            />
            <span className="text-ink">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
