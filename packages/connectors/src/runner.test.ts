import { describe, it, expect } from 'vitest';
import { resolveSyncStatus } from './runner.js';

describe('resolveSyncStatus', () => {
  it('is success when nothing went wrong', () => {
    expect(resolveSyncStatus({ fatal: false, failed: 0, synced: 10 })).toBe('success');
    expect(resolveSyncStatus({ fatal: false, failed: 0, synced: 0 })).toBe('success');
  });

  it('is partial when some synced despite a fatal error or failures', () => {
    expect(resolveSyncStatus({ fatal: true, failed: 0, synced: 5 })).toBe('partial');
    expect(resolveSyncStatus({ fatal: false, failed: 3, synced: 5 })).toBe('partial');
  });

  it('is error when nothing synced and something went wrong', () => {
    expect(resolveSyncStatus({ fatal: true, failed: 0, synced: 0 })).toBe('error');
    expect(resolveSyncStatus({ fatal: false, failed: 2, synced: 0 })).toBe('error');
  });
});
