import { describe, it, expect } from 'vitest';
import { SingleFlight } from './single-flight.js';

describe('SingleFlight', () => {
  it('admits the first start and rejects a concurrent one for the same key', () => {
    const sf = new SingleFlight();
    expect(sf.tryStart('org-a')).toBe(true);
    expect(sf.tryStart('org-a')).toBe(false);
    expect(sf.isActive('org-a')).toBe(true);
  });

  it('keeps keys independent', () => {
    const sf = new SingleFlight();
    expect(sf.tryStart('org-a')).toBe(true);
    expect(sf.tryStart('org-b')).toBe(true);
  });

  it('allows a restart after finish', () => {
    const sf = new SingleFlight();
    sf.tryStart('org-a');
    sf.finish('org-a');
    expect(sf.isActive('org-a')).toBe(false);
    expect(sf.tryStart('org-a')).toBe(true);
  });
});
