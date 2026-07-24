import { describe, it, expect } from 'vitest';
import { activeSyncRunId } from './sync-guard.js';
import type { MemoryEngine } from '@companybrain/core';

/** Stub an engine whose sql tagged-template resolves to the given rows. */
function engineReturning(rows: { id: string }[]): MemoryEngine {
  return { client: { sql: async () => rows } } as unknown as MemoryEngine;
}

describe('activeSyncRunId', () => {
  it('returns the run id when a running run exists', async () => {
    expect(await activeSyncRunId(engineReturning([{ id: 'run-1' }]), 'conn-1')).toBe('run-1');
  });

  it('returns null when no running run exists', async () => {
    expect(await activeSyncRunId(engineReturning([]), 'conn-1')).toBeNull();
  });
});
