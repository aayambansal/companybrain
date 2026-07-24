import { describe, it, expect } from 'vitest';
import {
  isPrivateIpv4,
  isPrivateIp,
  urlBlockReason,
  isBlockedInternalTarget,
} from './net-guard.js';

describe('isPrivateIpv4', () => {
  it('flags loopback, private, link-local, and CGNAT ranges', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.1',
      '172.16.5.5',
      '172.31.0.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
    ]) {
      expect(isPrivateIpv4(ip)).toBe(true);
    }
  });
  it('treats public addresses as public', () => {
    for (const ip of [
      '8.8.8.8',
      '1.1.1.1',
      '172.32.0.1',
      '11.0.0.1',
      '100.63.0.1',
      '93.184.216.34',
    ]) {
      expect(isPrivateIpv4(ip)).toBe(false);
    }
  });
});

describe('isPrivateIp (v6 aware)', () => {
  it('flags loopback, link-local, and ULA v6', () => {
    for (const ip of ['::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:10.0.0.1']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });
  it('treats public v6 as public', () => {
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
  });
});

describe('urlBlockReason', () => {
  it('rejects internal targets and bad schemes', () => {
    expect(urlBlockReason('http://localhost/hook')).toMatch(/localhost/);
    expect(urlBlockReason('http://app.localhost/hook')).toMatch(/localhost/);
    expect(urlBlockReason('http://127.0.0.1:9000/hook')).toMatch(/private|loopback/);
    expect(urlBlockReason('http://169.254.169.254/latest/meta-data')).toMatch(/private/);
    expect(urlBlockReason('http://[::1]/hook')).toMatch(/private|loopback/);
    expect(urlBlockReason('ftp://example.com/hook')).toMatch(/http/);
    expect(urlBlockReason('not a url')).toMatch(/valid/);
  });
  it('accepts a normal public https URL', () => {
    expect(urlBlockReason('https://hooks.example.com/companybrain')).toBeNull();
  });
});

describe('isBlockedInternalTarget', () => {
  it('blocks a literal-internal target without needing DNS', async () => {
    expect(await isBlockedInternalTarget('http://127.0.0.1/x')).toBe(true);
    expect(await isBlockedInternalTarget('ftp://example.com')).toBe(true);
  });
});
