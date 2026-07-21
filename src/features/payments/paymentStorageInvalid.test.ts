import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_STORAGE_KEYS } from '../../shared/storage';
import { readPaymentEntitlementReferences } from './storage';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('legacy entitlement storage cleanup', () => {
  it('removes a valid JSON value that is not the expected array', () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage, sessionStorage: new MemoryStorage() });
    localStorage.setItem(APP_STORAGE_KEYS.paymentEntitlementReferences.key, 'null');

    expect(readPaymentEntitlementReferences()).toEqual([]);
    expect(localStorage.getItem(APP_STORAGE_KEYS.paymentEntitlementReferences.key)).toBeNull();
  });
});
