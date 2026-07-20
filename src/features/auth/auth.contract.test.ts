import { afterEach, describe, expect, it, vi } from 'vitest';
import * as legacyAuth from '../../lib/auth';
import { buildHashCallbackLocation } from '../../shared/api/callbackRouting';
import { APP_STORAGE_KEYS } from '../../shared/storage';
import { completeAuthUser } from './authUser';
import { sanitizeAuthReturnTo } from './kakao';
import {
  consumePendingAuthState,
  readStoredAuthUser,
  writePendingAuthState,
  writeStoredAuthUser
} from './storage';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const installWindow = (search = '', pathname = '/', hash = '') => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  vi.stubGlobal('window', {
    localStorage,
    sessionStorage,
    location: {
      hash,
      search,
      pathname,
      hostname: 'www.unwoldang.com',
      port: '',
      origin: 'https://www.unwoldang.com',
      protocol: 'https:'
    }
  });
  return { localStorage, sessionStorage };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('auth storage compatibility', () => {
  it('keeps the legacy key and raw JSON payload shape', () => {
    const { localStorage } = installWindow();
    const user = {
      id: 'user-1',
      nickname: '사용자',
      provider: 'kakao' as const,
      authToken: 'session-token',
      connectedAt: '2026-07-20T00:00:00.000Z'
    };

    writeStoredAuthUser(user);

    expect(localStorage.getItem(APP_STORAGE_KEYS.authUser.key)).toBe(JSON.stringify(user));
    expect(readStoredAuthUser()).toEqual(user);
  });

  it('removes corrupt legacy JSON', () => {
    const { localStorage } = installWindow();
    localStorage.setItem(APP_STORAGE_KEYS.authUser.key, '{broken');

    expect(readStoredAuthUser()).toBeNull();
    expect(localStorage.getItem(APP_STORAGE_KEYS.authUser.key)).toBeNull();
  });

  it('consumes Kakao state exactly once, including on a mismatch', () => {
    const { sessionStorage } = installWindow();
    writePendingAuthState('expected-state');

    expect(consumePendingAuthState('different-state')).toBe(false);
    expect(sessionStorage.getItem(APP_STORAGE_KEYS.kakaoAuthState.key)).toBeNull();
    expect(consumePendingAuthState('expected-state')).toBe(false);
  });
});

describe('auth navigation compatibility', () => {
  it.each([
    [undefined, '/my'],
    ['https://attacker.example', '/my'],
    ['//attacker.example', '/my'],
    ['/auth/kakao/callback', '/my'],
    ['/payment/portone/callback', '/my'],
    ['/checkout', '/checkout']
  ])('sanitizes returnTo=%s', (returnTo, expected) => {
    expect(sanitizeAuthReturnTo(returnTo)).toBe(expected);
  });

  it('preserves payment callback precedence over an auth code query', () => {
    installWindow('?code=kakao-code&paymentId=payment-id');
    expect(buildHashCallbackLocation()).toBe(
      '/payment/portone/callback?code=kakao-code&paymentId=payment-id'
    );
  });

  it('does not redirect an already normalized callback path', () => {
    installWindow('?code=kakao-code', '/auth/kakao/callback');
    expect(buildHashCallbackLocation()).toBeNull();
  });
});

describe('auth facade compatibility', () => {
  it('re-exports the split implementations by reference', () => {
    expect(legacyAuth.readStoredAuthUser).toBe(readStoredAuthUser);
    expect(legacyAuth.consumePendingAuthState).toBe(consumePendingAuthState);
    expect(legacyAuth.sanitizeAuthReturnTo).toBe(sanitizeAuthReturnTo);
    expect(legacyAuth.buildHashCallbackLocation).toBe(buildHashCallbackLocation);
  });

  it('preserves complete-login defaults', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    expect(completeAuthUser({})).toMatchObject({
      id: 'user-1234',
      nickname: '운월당 회원',
      provider: 'kakao'
    });
  });
});
