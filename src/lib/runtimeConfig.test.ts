import { describe, expect, it } from 'vitest';
import { deriveReleasePreflightEndpoint, resolvePaymentMode } from './runtimeConfig';

describe('payment runtime mode', () => {
  it('fails closed in production unless live mode is explicit', () => {
    expect(resolvePaymentMode(undefined, true)).toBe('disabled');
    expect(resolvePaymentMode('demo', true)).toBe('disabled');
    expect(resolvePaymentMode('test', true)).toBe('disabled');
    expect(resolvePaymentMode('live', true)).toBe('live');
  });

  it('keeps demo and test modes available outside production', () => {
    expect(resolvePaymentMode(undefined, false)).toBe('demo');
    expect(resolvePaymentMode('demo', false)).toBe('demo');
    expect(resolvePaymentMode('test', false)).toBe('test');
    expect(resolvePaymentMode('live', false)).toBe('live');
  });
});

describe('release preflight endpoint', () => {
  it('follows both supported report endpoint aliases', () => {
    expect(deriveReleasePreflightEndpoint('http://127.0.0.1:8787/api/report'))
      .toBe('http://127.0.0.1:8787/api/report/preflight');
    expect(deriveReleasePreflightEndpoint('http://127.0.0.1:8787/report/'))
      .toBe('http://127.0.0.1:8787/report/preflight');
  });
});
