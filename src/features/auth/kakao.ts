import type { AuthStatePayload } from './model';
import { writePendingAuthState } from './storage';

const AUTH_RETURN_TO_FALLBACK = '/my';
const RETURN_TO_VALIDATION_ORIGIN = 'https://internal-navigation.invalid';
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

function decodeForNavigationValidation(value: string) {
  let decoded = value;

  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return decoded;
      decoded = next;
    } catch {
      return null;
    }
  }

  return decoded;
}

export const getKakaoRedirectUri = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const canonicalOrigin = 'https://www.unwoldang.com';
  const overrideOrigin = import.meta.env.VITE_KAKAO_REDIRECT_ORIGIN;
  const origin =
    overrideOrigin ||
    (window.location.hostname.endsWith('.vercel.app')
      ? canonicalOrigin
      : window.location.hostname === '127.0.0.1' && window.location.port === '5173'
        ? 'http://localhost:5173'
        : window.location.origin);

  return `${origin.replace(/\/$/, '')}/auth/kakao/callback`;
};

export const sanitizeAuthReturnTo = (returnTo?: string | null) => {
  if (!returnTo || returnTo !== returnTo.trim()) {
    return AUTH_RETURN_TO_FALLBACK;
  }

  const decoded = decodeForNavigationValidation(returnTo);
  if (
    !decoded ||
    CONTROL_CHARACTER_PATTERN.test(returnTo) ||
    CONTROL_CHARACTER_PATTERN.test(decoded) ||
    returnTo.includes('\\') ||
    decoded.includes('\\') ||
    !decoded.startsWith('/') ||
    decoded.startsWith('//')
  ) {
    return AUTH_RETURN_TO_FALLBACK;
  }

  try {
    const decodedUrl = new URL(decoded, RETURN_TO_VALIDATION_ORIGIN);
    const navigationUrl = new URL(returnTo, RETURN_TO_VALIDATION_ORIGIN);
    const isCallbackReentry = /^\/(?:auth|payment)(?:\/|$)/i.test(decodedUrl.pathname);

    if (
      decodedUrl.origin !== RETURN_TO_VALIDATION_ORIGIN ||
      navigationUrl.origin !== RETURN_TO_VALIDATION_ORIGIN ||
      isCallbackReentry
    ) {
      return AUTH_RETURN_TO_FALLBACK;
    }

    return `${navigationUrl.pathname}${navigationUrl.search}${navigationUrl.hash}`;
  } catch {
    return AUTH_RETURN_TO_FALLBACK;
  }
};

export const decodeAuthState = (rawState?: string | null): AuthStatePayload | null => {
  if (!rawState) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(rawState)) as AuthStatePayload;
  } catch {
    return null;
  }
};

export const buildKakaoAuthorizeUrl = (returnTo: string) => {
  const clientId = import.meta.env.VITE_KAKAO_REST_API_KEY;

  if (!clientId) {
    return null;
  }

  const redirectUri = getKakaoRedirectUri();
  const state = encodeURIComponent(JSON.stringify({
    provider: 'kakao',
    returnTo: sanitizeAuthReturnTo(returnTo),
    issuedAt: Date.now()
  } satisfies AuthStatePayload));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state
  });
  writePendingAuthState(state);

  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
};

export const buildLoginRoute = (returnTo: string, shouldAutoStart = false) => {
  const params = new URLSearchParams({
    returnTo: sanitizeAuthReturnTo(returnTo)
  });

  if (shouldAutoStart) {
    params.set('kakao', '1');
  }

  return `/login?${params.toString()}`;
};

export const getKakaoLoginBridgeUrl = (returnTo: string) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const safeReturnTo = sanitizeAuthReturnTo(returnTo);
  const loginRoute = buildLoginRoute(safeReturnTo, true);

  if (window.location.hostname === '127.0.0.1' && window.location.port === '5173') {
    return `${window.location.protocol}//localhost:5173${loginRoute}`;
  }

  if (window.location.hostname.endsWith('.vercel.app')) {
    return `https://www.unwoldang.com${loginRoute}`;
  }

  return null;
};

export const beginKakaoLogin = (returnTo: string) => {
  const bridgeUrl = getKakaoLoginBridgeUrl(returnTo);

  if (bridgeUrl) {
    return {
      ok: true as const,
      url: bridgeUrl
    };
  }

  const authorizeUrl = buildKakaoAuthorizeUrl(returnTo);

  if (!authorizeUrl) {
    return {
      ok: false as const,
      message: '카카오 REST API 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.'
    };
  }

  return {
    ok: true as const,
    url: authorizeUrl
  };
};
