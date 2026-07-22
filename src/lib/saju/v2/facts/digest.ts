const DIGEST_SEEDS = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35] as const;

export function canonicalizeSajuFactsValue(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value) as string;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('facts digest는 유한한 숫자만 허용합니다.');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value) as string;
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeSajuFactsValue).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, item]) =>
      `${JSON.stringify(key)}:${canonicalizeSajuFactsValue(item)}`
    ).join(',')}}`;
  }

  throw new Error('facts digest가 지원하지 않는 값입니다.');
}

function fnv1a(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Browser-safe synchronous digest aligned with the existing commercial-audit FNV utility. */
export function digestSajuFactsValue(value: unknown) {
  const canonical = canonicalizeSajuFactsValue(value);
  return `uwf-${DIGEST_SEEDS.map((seed) => fnv1a(canonical, seed)).join('')}`;
}
