import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_ACCESS_TOKEN_KEY,
  ADMIN_SESSION_KEY,
  clearAdminSession,
  getAdminAccessTokenExpiresAt,
  isAdminAccessTokenExpired,
  readAdminSessionState,
  writeAdminAccessSession,
  writeLocalAdminSession
} from './adminSession';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function token(exp: number) {
  return `${Buffer.from(JSON.stringify({ purpose: 'admin', exp })).toString('base64url')}.signature`;
}

function installWindow(hostname = 'admin.example.test') {
  const sessionStorage = new MemoryStorage();
  vi.stubGlobal('window', {
    sessionStorage,
    location: { hostname },
    crypto: globalThis.crypto
  });
  return sessionStorage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin session contract', () => {
  it('keeps the established sessionStorage keys', () => {
    expect(ADMIN_SESSION_KEY).toBe('unwoldang.admin.session.v2');
    expect(ADMIN_ACCESS_TOKEN_KEY).toBe('unwoldang.admin.accessToken.v1');
  });

  it('reads token expiry without adding a new storage key', () => {
    const expiresAt = Date.now() + 60_000;
    const adminToken = token(expiresAt);
    expect(getAdminAccessTokenExpiresAt(adminToken)).toBe(expiresAt);
    expect(isAdminAccessTokenExpired(adminToken, expiresAt - 1)).toBe(false);
    expect(isAdminAccessTokenExpired(adminToken, expiresAt)).toBe(true);
  });

  it('requires server verification before unlocking a stored token', () => {
    installWindow();
    const adminToken = token(Date.now() + 60_000);
    writeAdminAccessSession(adminToken);

    expect(readAdminSessionState()).toEqual({
      adminAccessToken: adminToken,
      isUnlocked: false,
      requiresServerVerification: true
    });
  });

  it('clears both established keys for an expired token and logout', () => {
    const storage = installWindow();
    writeAdminAccessSession(token(Date.now() - 1));

    expect(readAdminSessionState()).toEqual({
      adminAccessToken: '',
      isUnlocked: false,
      requiresServerVerification: false
    });
    expect(storage.getItem(ADMIN_SESSION_KEY)).toBeNull();
    expect(storage.getItem(ADMIN_ACCESS_TOKEN_KEY)).toBeNull();

    writeAdminAccessSession(token(Date.now() + 60_000));
    clearAdminSession();
    expect(storage.getItem(ADMIN_SESSION_KEY)).toBeNull();
    expect(storage.getItem(ADMIN_ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('keeps the explicit localhost-only fallback session', () => {
    installWindow('localhost');
    writeLocalAdminSession();
    expect(readAdminSessionState()).toMatchObject({
      adminAccessToken: '',
      isUnlocked: true,
      requiresServerVerification: false
    });
  });
});
