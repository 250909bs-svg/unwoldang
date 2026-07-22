export const ANALYTICS_ATTRIBUTION_STORAGE_KEY = 'unwoldang.analytics.attribution.v1';

export const ATTRIBUTION_CHANNELS = [
  'direct',
  'organic_search',
  'paid_search',
  'organic_social',
  'paid_social',
  'email',
  'affiliate',
  'display',
  'referral',
  'other_campaign'
] as const;

export type AttributionChannel = (typeof ATTRIBUTION_CHANNELS)[number];

export const UTM_PARAMETER_NAMES = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content'
] as const;

export type UtmParameterName = (typeof UTM_PARAMETER_NAMES)[number];

export interface AttributionTouch extends Partial<Record<UtmParameterName, string>> {
  channel: AttributionChannel;
  referrer_hostname?: string;
}

export interface SessionAttribution {
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
}

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CaptureSessionAttributionInput {
  pathname?: string;
  search?: string;
  referrer?: string;
  currentHostname?: string;
  storage?: SessionStorageLike;
}

const attributionChannelSet = new Set<string>(ATTRIBUTION_CHANNELS);
const callbackPrefixes = ['/auth/', '/payment/'] as const;
const searchReferrers = ['google.', 'bing.com', 'search.naver.com', 'search.daum.net', 'duckduckgo.com'];
const socialReferrers = [
  'facebook.com',
  'instagram.com',
  'threads.net',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'youtube.com'
];

function getBrowserSessionStorage(): SessionStorageLike | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function normalizePathname(pathname?: string): string {
  const path = pathname?.split(/[?#]/, 1)[0] || '/';
  return path.length > 1 ? path.replace(/\/+$/, '').toLowerCase() : path;
}

export function isAttributionCallbackPath(pathname?: string): boolean {
  const normalized = normalizePathname(pathname);
  return callbackPrefixes.some(
    (prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)
  );
}

function hasUnsafeText(value: string, maxLength: number): boolean {
  if (!value || value.length > maxLength || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
    return true;
  }

  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(value)) {
    return true;
  }

  if (/(?:https?:\/\/|www\.|\/\/)/iu.test(value)) {
    return true;
  }

  if (
    /\d{7,}/u.test(value) ||
    /(?:^|\D)(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s])\d{3,4}[-.\s]\d{4}(?:\D|$)/u.test(value)
  ) {
    return true;
  }

  const digits = value.replace(/\D/gu, '');
  if (digits.length >= 7) {
    return true;
  }

  return /(?:^|[^a-z])(gclid|dclid|fbclid|msclkid|ttclid|wbraid|gbraid)(?:[^a-z]|$)/iu.test(value);
}

export function sanitizeAttributionValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  // Attribution values are machine-readable campaign tags, never free text.
  // Rejecting whitespace and non-ASCII text keeps names, addresses, and search
  // phrases out of storage while preserving conventional UTM identifiers.
  if (!/^[a-z0-9][a-z0-9._~-]{0,63}$/iu.test(normalized)) {
    return undefined;
  }
  return hasUnsafeText(normalized, 64) ? undefined : normalized;
}

function sanitizeHostname(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/\.$/u, '');
  if (
    !normalized ||
    normalized.length > 253 ||
    /[\u0000-\u0020\u007f-\u009f/@?#]/u.test(normalized) ||
    !/^[a-z0-9.:\-[\]]+$/u.test(normalized)
  ) {
    return undefined;
  }

  return normalized;
}

export function getReferrerHostname(
  referrer?: string,
  currentHostname?: string
): string | undefined {
  if (!referrer || referrer.length > 2_048 || /[\u0000-\u001f\u007f-\u009f]/u.test(referrer)) {
    return undefined;
  }

  try {
    const parsed = new URL(referrer);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }

    const hostname = sanitizeHostname(parsed.hostname);
    const ownHostname = sanitizeHostname(currentHostname);
    return hostname && hostname !== ownHostname ? hostname : undefined;
  } catch {
    return undefined;
  }
}

function hostnameMatches(hostname: string, candidates: readonly string[]): boolean {
  return candidates.some(
    (candidate) =>
      hostname === candidate ||
      hostname.endsWith(`.${candidate}`) ||
      (candidate.endsWith('.') && hostname.includes(candidate))
  );
}

function inferChannel(
  utm: Partial<Record<UtmParameterName, string>>,
  referrerHostname?: string
): AttributionChannel {
  const medium = utm.utm_medium?.toLowerCase().replace(/[\s-]+/gu, '_');
  const source = utm.utm_source?.toLowerCase().replace(/[\s-]+/gu, '_');
  const hasSocialSignal = Boolean(
    (source && /^(facebook|instagram|threads|tiktok|twitter|x|youtube)(?:[._-]|$)/u.test(source)) ||
      (referrerHostname && hostnameMatches(referrerHostname, socialReferrers))
  );

  if (medium) {
    if (['cpc', 'ppc', 'paid', 'paid_search', 'paid_social', 'sem'].includes(medium)) {
      return hasSocialSignal ? 'paid_social' : 'paid_search';
    }
    if (['organic', 'organic_search', 'seo'].includes(medium)) {
      return hasSocialSignal ? 'organic_social' : 'organic_search';
    }
    if (['social', 'social_media', 'social_network', 'sm', 'organic_social'].includes(medium)) {
      return 'organic_social';
    }
    if (['email', 'e_mail'].includes(medium)) {
      return 'email';
    }
    if (['affiliate', 'affiliates'].includes(medium)) {
      return 'affiliate';
    }
    if (['display', 'banner', 'cpm'].includes(medium)) {
      return 'display';
    }
    if (['referral', 'referrer'].includes(medium)) {
      return 'referral';
    }
    return 'other_campaign';
  }

  if (referrerHostname && hostnameMatches(referrerHostname, searchReferrers)) {
    return 'organic_search';
  }
  if (hasSocialSignal) {
    return 'organic_social';
  }
  if (referrerHostname) {
    return 'referral';
  }
  return Object.keys(utm).length ? 'other_campaign' : 'direct';
}

function sanitizeTouch(value: unknown): AttributionTouch | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  if (typeof source.channel !== 'string' || !attributionChannelSet.has(source.channel)) {
    return undefined;
  }

  const touch: AttributionTouch = { channel: source.channel as AttributionChannel };
  UTM_PARAMETER_NAMES.forEach((parameter) => {
    const sanitized = sanitizeAttributionValue(source[parameter]);
    if (sanitized) {
      touch[parameter] = sanitized;
    }
  });

  const referrerHostname = sanitizeHostname(source.referrer_hostname);
  if (referrerHostname) {
    touch.referrer_hostname = referrerHostname;
  }

  return touch;
}

function sanitizeSessionAttribution(value: unknown): SessionAttribution | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const firstTouch = sanitizeTouch(source.firstTouch);
  const lastTouch = sanitizeTouch(source.lastTouch);
  return firstTouch && lastTouch ? { firstTouch, lastTouch } : undefined;
}

export function readSessionAttribution(
  storage: SessionStorageLike | undefined = getBrowserSessionStorage()
): SessionAttribution | undefined {
  if (!storage) {
    return undefined;
  }

  try {
    const serialized = storage.getItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY);
    return serialized ? sanitizeSessionAttribution(JSON.parse(serialized) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

function persistSessionAttribution(
  attribution: SessionAttribution,
  storage?: SessionStorageLike
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Storage can be unavailable in private browsing or embedded contexts.
  }
}

function createTouch(
  search: string,
  referrer?: string,
  currentHostname?: string
): { touch: AttributionTouch; hasAcquisitionSignal: boolean } {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const utm: Partial<Record<UtmParameterName, string>> = {};

  UTM_PARAMETER_NAMES.forEach((parameter) => {
    const value = sanitizeAttributionValue(query.get(parameter));
    if (value) {
      utm[parameter] = value;
    }
  });

  const referrerHostname = getReferrerHostname(referrer, currentHostname);
  const touch: AttributionTouch = {
    channel: inferChannel(utm, referrerHostname),
    ...utm
  };

  if (referrerHostname) {
    touch.referrer_hostname = referrerHostname;
  }

  return {
    touch,
    hasAcquisitionSignal: Object.keys(utm).length > 0 || Boolean(referrerHostname)
  };
}

export function captureSessionAttribution({
  pathname,
  search = '',
  referrer,
  currentHostname,
  storage = getBrowserSessionStorage()
}: CaptureSessionAttributionInput = {}): SessionAttribution | undefined {
  const existing = readSessionAttribution(storage);

  // OAuth and payment providers append codes and transaction identifiers. A
  // callback must not become a new acquisition touch (or persist its query).
  if (isAttributionCallbackPath(pathname)) {
    return existing;
  }

  const { touch, hasAcquisitionSignal } = createTouch(search, referrer, currentHostname);
  if (existing && !hasAcquisitionSignal) {
    return existing;
  }

  const next: SessionAttribution = existing
    ? { firstTouch: existing.firstTouch, lastTouch: touch }
    : { firstTouch: touch, lastTouch: touch };

  persistSessionAttribution(next, storage);
  return next;
}

export const captureAttribution = captureSessionAttribution;
export const getAttribution = readSessionAttribution;
