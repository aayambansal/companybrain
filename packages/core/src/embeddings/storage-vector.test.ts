import { describe, it, expect } from 'vitest';
import { toStorageVector } from './index.js';
import { STORAGE_DIMENSIONS } from '../config.js';

describe('toStorageVector', () => {
  it('returns the vector unchanged when it already matches the width', () => {
    expect(toStorageVector([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });

  it('truncates a longer vector to the target width', () => {
    expect(toStorageVector([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
  });

  it('zero-pads a shorter vector to the target width', () => {
    expect(toStorageVector([1, 2], 4)).toEqual([1, 2, 0, 0]);
  });

  it('pads to the storage width by default', () => {
    const out = toStorageVector([0.5, 0.5]);
    expect(out).toHaveLength(STORAGE_DIMENSIONS);
    expect(out[0]).toBe(0.5);
    expect(out[STORAGE_DIMENSIONS - 1]).toBe(0);
  });
});
