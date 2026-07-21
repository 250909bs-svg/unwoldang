export const ADMIN_SESSION_KEY = 'unwoldang.admin.session.v2';
export const ADMIN_ACCESS_TOKEN_KEY = 'unwoldang.admin.accessToken.v1';
export const LOCAL_ADMIN_CREDENTIAL_HASH = import.meta.env.VITE_LOCAL_ADMIN_CREDENTIAL_HASH || '';
export const ENABLE_CLIENT_ADMIN = import.meta.env.VITE_ENABLE_CLIENT_ADMIN === 'true';

export type AdminSessionState = {
  adminAccessToken: string;
  isUnlocked: boolean;
  requiresServerVerification: boolean;
};

function getAdminSessionStorage() {
  return typeof window === 'undefined' ? undefined : window.sessionStorage;
}

function arrayBufferToHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function decodeTokenPayload(adminAccessToken: string) {
  try {
    const [encodedPayload] = adminAccessToken.split('.', 1);
    if (!encodedPayload || typeof globalThis.atob !== 'function') {
      return undefined;
    }

    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function getAdminAccessTokenExpiresAt(adminAccessToken: string) {
  const expiry = decodeTokenPayload(adminAccessToken)?.exp;
  return typeof expiry === 'number' && Number.isFinite(expiry) ? expiry : undefined;
}

export function isAdminAccessTokenExpired(adminAccessToken: string, now = Date.now()) {
  const expiresAt = getAdminAccessTokenExpiresAt(adminAccessToken);
  return expiresAt !== undefined && expiresAt <= now;
}

export function isLocalAdminHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

export async function hashAdminCredential(adminId: string, password: string) {
  const encoded = new TextEncoder().encode(`${adminId.trim()}:${password}`);
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);
  return arrayBufferToHex(digest);
}

export function clearAdminSession() {
  const storage = getAdminSessionStorage();
  storage?.removeItem(ADMIN_SESSION_KEY);
  storage?.removeItem(ADMIN_ACCESS_TOKEN_KEY);
}

export function readAdminAccessToken() {
  const adminAccessToken = getAdminSessionStorage()?.getItem(ADMIN_ACCESS_TOKEN_KEY) || '';

  if (adminAccessToken && isAdminAccessTokenExpired(adminAccessToken)) {
    clearAdminSession();
    return '';
  }

  return adminAccessToken;
}

export function readAdminSessionState(): AdminSessionState {
  const storage = getAdminSessionStorage();
  const adminAccessToken = readAdminAccessToken();
  const hasLocalSession = storage?.getItem(ADMIN_SESSION_KEY) === 'ok';
  const localSessionUnlocked = !adminAccessToken && (isLocalAdminHost() || ENABLE_CLIENT_ADMIN) && hasLocalSession;

  return {
    adminAccessToken,
    isUnlocked: localSessionUnlocked,
    requiresServerVerification: Boolean(adminAccessToken)
  };
}

export function writeAdminAccessSession(adminAccessToken: string) {
  const storage = getAdminSessionStorage();
  storage?.setItem(ADMIN_ACCESS_TOKEN_KEY, adminAccessToken);
  storage?.setItem(ADMIN_SESSION_KEY, 'ok');
}

export function writeLocalAdminSession() {
  getAdminSessionStorage()?.setItem(ADMIN_SESSION_KEY, 'ok');
}
