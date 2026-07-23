import { describe, it, expect } from 'vitest';
import { connectors, getConnector } from './index.js';

describe('connector registry', () => {
  it('registers every connector with a unique id', () => {
    const ids = connectors.map((c) => c.id);
    const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
    expect(dupes).toEqual([]);
  });

  it('ships a substantial set of connectors', () => {
    expect(connectors.length).toBeGreaterThanOrEqual(44);
  });

  it('every connector has the required shape', () => {
    for (const c of connectors) {
      expect(typeof c.id).toBe('string');
      expect(c.id.length).toBeGreaterThan(0);
      expect(typeof c.displayName).toBe('string');
      expect(typeof c.pull).toBe('function');
      expect(Array.isArray(c.configSchema)).toBe(true);
    }
  });

  it('resolves connectors by id and returns undefined for unknown ids', () => {
    expect(getConnector('slack')?.id).toBe('slack');
    expect(getConnector('granola')?.id).toBe('granola');
    expect(getConnector('nope')).toBeUndefined();
  });
});
