import { afterEach, describe, expect, it, vi } from 'vitest';
import * as legacyAuth from '../../lib/auth';
import { buildHashCallbackLocation } from '../../shared/api/callbackRouting';
import { APP_STORAGE_KEYS } from '../../shared/storage';
import { readPendingPayment, savePendingPayment } from '../payments/storage';
import { completeAuthUser } from './authUser';
import {
  buildKakaoAuthorizeUrl,
  decodeAuthState,
  sanitizeAuthReturnTo
} from './kakao';
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
  vi.unstubAllEnvs();
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

  it('preserves a pending payment while Kakao state returns to checkout', () => {
    installWindow();
    vi.stubEnv('VITE_KAKAO_REST_API_KEY', 'test-kakao-client-id');
    const pendingPayment = {
      orderId: 'UW-123456789012-login',
      productId: 'general-signature' as const,
      paymentMethod: 'portone' as const,
      amount: 79_000,
      orderClaim: 'c'.repeat(48),
      createdAt: '2026-07-21T00:00:00.000Z'
    };
    savePendingPayment(pendingPayment);

    const authorizeUrl = buildKakaoAuthorizeUrl('/checkout');
    expect(authorizeUrl).not.toBeNull();
    const state = new URL(authorizeUrl!).searchParams.get('state');

    expect(state).not.toBeNull();
    expect(decodeAuthState(state)).toMatchObject({
      provider: 'kakao',
      returnTo: '/checkout'
    });
    expect(consumePendingAuthState(state)).toBe(true);
    expect(readPendingPayment()).toEqual(pendingPayment);
  });
});

describe('auth navigation compatibility', () => {
  it.each([
    '/',
    '/my',
    '/detail/general-saju',
    '/report/general-signature',
    '/my?tab=archive#recent'
  ])('allows same-origin returnTo=%s', (returnTo) => {
    expect(sanitizeAuthReturnTo(returnTo)).toBe(returnTo);
  });

  it.each([
    undefined,
    '',
    '//evil.example',
    '/\\evil.example',
    '\\evil.example',
    'https://evil.example',
    'http://evil.example',
    'javascript:alert(1)',
    '/%5Cevil.example',
    '/%255Cevil.example',
    decodeURIComponent('/%5Cevil.example'),
    '%2F%2Fevil.example',
    '/my\n//evil.example',
    '/%0Aevil.example',
    '/auth/kakao/callback',
    '/payment/portone/callback',
    '/safe/../auth/kakao/callback',
    '/safe/../payment/portone/callback'
  ])('rejects unsafe returnTo=%s', (returnTo) => {
    expect(sanitizeAuthReturnTo(returnTo)).toBe('/my');
  });

  it('keeps the checkout return path used by the paid flow', () => {
    expect(sanitizeAuthReturnTo('/checkout')).toBe('/checkout');
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
