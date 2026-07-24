import { describe, it, expect, vi } from 'vitest';
import { createShutdown } from './shutdown.js';

function deps(over: Partial<Parameters<typeof createShutdown>[0]> = {}) {
  const calls: string[] = [];
  const exited: number[] = [];
  const base = {
    stopScheduler: vi.fn(() => calls.push('scheduler')),
    closeServer: vi.fn(async () => {
      calls.push('server');
    }),
    closeEngine: vi.fn(async () => {
      calls.push('engine');
    }),
    exit: (code: number) => exited.push(code),
    forceMs: 10_000,
    ...over,
  };
  return { base, calls, exited };
}

describe('createShutdown', () => {
  it('stops the scheduler, closes the server then the engine, and exits 0', async () => {
    const { base, calls, exited } = deps();
    await createShutdown(base)('SIGTERM');
    expect(calls).toEqual(['scheduler', 'server', 'engine']);
    expect(exited).toEqual([0]);
  });

  it('is idempotent: a second signal while shutting down is ignored', async () => {
    const { base, exited } = deps();
    const shutdown = createShutdown(base);
    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);
    expect(base.closeEngine).toHaveBeenCalledTimes(1);
    expect(exited).toEqual([0]);
  });

  it('tolerates a null scheduler', async () => {
    const { base, exited } = deps({ stopScheduler: null });
    await createShutdown(base)('SIGINT');
    expect(exited).toEqual([0]);
  });

  it('still exits 0 when a close step throws', async () => {
    const { base, exited } = deps({
      closeEngine: vi.fn(async () => {
        throw new Error('pool already gone');
      }),
    });
    await createShutdown(base)('SIGTERM');
    expect(exited).toEqual([0]);
  });
});
