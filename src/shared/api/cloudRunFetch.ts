const REQUEST_ID_HEADER = 'X-Request-ID';
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeRequestId(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return REQUEST_ID_PATTERN.test(normalized) ? normalized : undefined;
}

export function createRequestId() {
  const generated = globalThis.crypto?.randomUUID?.();

  if (generated) {
    return generated;
  }

  const bytes = new Uint8Array(16);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    throw new Error('Secure request ID generation is unavailable.');
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16),
    hex.slice(16, 20), hex.slice(20)
  ].join('-');
}

/**
 * Fetch facade for calls to our Cloud Run API only. It intentionally does not
 * replace global fetch so third-party and asset requests do not receive an
 * internal correlation header.
 */
export function fetchCloudRunApi(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const requestId = normalizeRequestId(headers.get(REQUEST_ID_HEADER)) || createRequestId();

  headers.set(REQUEST_ID_HEADER, requestId);

  return fetch(input, {
    ...init,
    headers
  });
}

export { REQUEST_ID_HEADER };
