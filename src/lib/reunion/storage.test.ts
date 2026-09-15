import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  REUNION_CONTEXT_VERSION,
  clearReunionContext,
  getReunionContextStorageKey,
  readReunionContext,
  writeReunionContext,
  type ReunionContext
} from './index';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}

const context: ReunionContext = {
  schemaVersion: REUNION_CONTEXT_VERSION,
  breakupDuration: 'threeTo6m',
  contactStatus: 'no-contact',
  breakupReason: '거리와 일정 문제로 자주 다툴어요.',
  desiredOutcome: 'reconnect',
  notes: '',
  consentToUsePartnerData: true
};

describe('reunion session storage', () => {
  const sessionStorage = createMemoryStorage();
  const localStorage = createMemoryStorage();

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage, localStorage }
    });
  });

  afterEach(() => Reflect.deleteProperty(globalThis, 'window'));

  it('keeps sensitive relationship context in session storage only and round-trips it', () => {
    writeReunionContext(context, 'member@example.com');
    const key = getReunionContextStorageKey('member@example.com');

    expect(readReunionContext('member@example.com')).toEqual(context);
    expect(sessionStorage.getItem(key)).not.toBeNull();
    expect(localStorage.length).toBe(0);
    expect(key).not.toContain('member@example.com');
  });

  it('isolates owner keys and clears only the requested context', () => {
    writeReunionContext(context, 'owner-a');
    writeReunionContext({ ...context, desiredOutcome: 'closure' }, 'owner-b');
    clearReunionContext('owner-a');

    expect(readReunionContext('owner-a')).toBeNull();
    expect(readReunionContext('owner-b')?.desiredOutcome).toBe('closure');
  });

  it('purges malformed and future-version values', () => {
    const key = getReunionContextStorageKey();
    sessionStorage.setItem(key, '{broken');
    expect(readReunionContext()).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();

    sessionStorage.setItem(key, JSON.stringify({ ...context, schemaVersion: 'reunion-context-v99' }));
    expect(readReunionContext()).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
  });
});
