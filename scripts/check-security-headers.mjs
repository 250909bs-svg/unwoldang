import { readFile } from 'node:fs/promises';

const configUrl = new URL('../vercel.json', import.meta.url);

function assert(condition, message) {
  if (!condition) {
    throw new Error('Security header contract failed: ' + message);
  }
}

function toHeaderMap(rule) {
  return new Map(
    (rule?.headers || []).map(({ key, value }) => [String(key).toLowerCase(), String(value)])
  );
}

function findRule(config, source) {
  return config.headers?.find((rule) => rule.source === source);
}

function parseCsp(value) {
  return new Map(
    value
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [directive, ...sources] = entry.split(/\s+/);
        return [directive, sources];
      })
  );
}

const config = JSON.parse(await readFile(configUrl, 'utf8'));
const globalHeaders = toHeaderMap(findRule(config, '/(.*)'));

assert(
  globalHeaders.get('x-content-type-options')?.toLowerCase() === 'nosniff',
  'nosniff is required'
);
assert(
  globalHeaders.get('x-frame-options')?.toUpperCase() === 'DENY',
  'clickjacking protection is required'
);
assert(
  globalHeaders.get('referrer-policy')?.toLowerCase() === 'strict-origin-when-cross-origin',
  'the referrer policy must not expose full cross-origin URLs'
);

const permissionsPolicy = globalHeaders.get('permissions-policy') || '';
for (const feature of ['camera', 'microphone', 'geolocation']) {
  const deniedFeature = new RegExp('(?:^|,\\s*)' + feature + '=\\(\\)(?:,|$)');
  assert(deniedFeature.test(permissionsPolicy), 'Permissions-Policy must disable ' + feature);
}

const cspValue = globalHeaders.get('content-security-policy');
assert(cspValue, 'Content-Security-Policy is required');
const csp = parseCsp(cspValue);

assert(csp.get('default-src')?.includes("'self'"), "default-src must include 'self'");
assert(csp.get('base-uri')?.includes("'self'"), "base-uri must include 'self'");
assert(
  csp.get('frame-ancestors')?.length === 1 && csp.get('frame-ancestors')?.[0] === "'none'",
  "frame-ancestors must be 'none'"
);
assert(
  csp.get('object-src')?.length === 1 && csp.get('object-src')?.[0] === "'none'",
  "object-src must be 'none'"
);
assert(
  !csp.get('script-src')?.includes("'unsafe-eval'"),
  "script-src must not allow 'unsafe-eval'"
);

const sensitiveRoutes = [
  '/admin/:path*',
  '/my/:path*',
  '/login',
  '/form/:path*',
  '/checkout',
  '/loading',
  '/report/:path*',
  '/auth/:path*',
  '/payment/:path*'
];

for (const source of sensitiveRoutes) {
  const headers = toHeaderMap(findRule(config, source));
  assert(
    headers.get('cache-control')?.toLowerCase().includes('no-store'),
    source + ' must be no-store'
  );
  assert(
    headers.get('x-robots-tag')?.toLowerCase().includes('noindex'),
    source + ' must be noindex'
  );
}

console.log('Security header contract passed.');
