const COMPOUND_KOREAN_SURNAMES = [
  '남궁',
  '황보',
  '제갈',
  '사공',
  '선우',
  '서문',
  '독고',
  '동방',
  '어금',
  '망절'
] as const;

export function getReportCallName(rawName?: string | null, fallback = '고객') {
  const normalized = rawName?.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return fallback;
  }

  const compact = normalized.replace(/\s+/g, '');

  if (/^[가-힣]+$/.test(compact)) {
    const compoundSurname = COMPOUND_KOREAN_SURNAMES.find(
      (surname) => compact.startsWith(surname) && compact.length > surname.length
    );

    if (compoundSurname) {
      return compact.slice(compoundSurname.length) || compact;
    }

    return compact.length >= 2 ? compact.slice(1) : compact;
  }

  const [, ...rest] = normalized.split(' ');

  return rest.join(' ') || normalized;
}
