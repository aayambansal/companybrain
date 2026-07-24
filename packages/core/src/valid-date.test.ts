import { describe, it, expect } from 'vitest';
import { validDate } from './memory.js';

describe('validDate', () => {
  it('keeps a valid Date', () => {
    const d = new Date('2026-07-24T10:00:00.000Z');
    expect(validDate(d)).toBe(d);
  });

  it('nulls an Invalid Date (malformed source timestamp)', () => {
    // This is what `new Date(someWeirdSourceField)` produces.
    expect(validDate(new Date('not a date'))).toBeNull();
    expect(validDate(new Date(NaN))).toBeNull();
  });

  it('nulls null and undefined', () => {
    expect(validDate(null)).toBeNull();
    expect(validDate(undefined)).toBeNull();
  });

  it('accepts the unix epoch (a real, if old, date)', () => {
    const epoch = new Date(0);
    expect(validDate(epoch)).toBe(epoch);
  });
});
