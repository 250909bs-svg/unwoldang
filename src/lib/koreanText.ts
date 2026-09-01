export type KoreanParticle = '은/는' | '이/가' | '을/를' | '과/와' | '으로/로';

function lastHangulSyllable(value: string) {
  return Array.from(value).reverse().find((character) => /[가-힣]/.test(character));
}

export function getFinalConsonantIndex(value: string) {
  const syllable = lastHangulSyllable(value);
  if (!syllable) return 0;
  return (syllable.charCodeAt(0) - 0xac00) % 28;
}

export function hasBatchim(value: string) {
  return getFinalConsonantIndex(value) > 0;
}

export function withKoreanParticle(value: string, particle: KoreanParticle) {
  const finalConsonant = getFinalConsonantIndex(value);
  const hasFinal = finalConsonant > 0;

  switch (particle) {
    case '은/는': return `${value}${hasFinal ? '은' : '는'}`;
    case '이/가': return `${value}${hasFinal ? '이' : '가'}`;
    case '을/를': return `${value}${hasFinal ? '을' : '를'}`;
    case '과/와': return `${value}${hasFinal ? '과' : '와'}`;
    case '으로/로': return `${value}${!hasFinal || finalConsonant === 8 ? '로' : '으로'}`;
  }
}

const INTERNAL_LABELS: ReadonlyArray<[RegExp, string]> = [
  [/\bnot-configured\b/gi, '외부 대조 미연결'],
  [/\bsupported\b/gi, '근거가 충분합니다'],
  [/\bconditional\b/gi, '조건을 함께 봐야 합니다'],
  [/\binsufficient\b/gi, '현재 정보로는 판단을 유보합니다'],
  [/\bbalanced\b/gi, '비교적 균형적인 편입니다'],
  [/\bweak\b/gi, '약한 편입니다'],
  [/\bstrong\b/gi, '강한 편입니다'],
  [/\bcold\b/gi, '추운 편'],
  [/\bhot\b/gi, '더운 편'],
  [/\bdry\b/gi, '건조한 편'],
  [/\bwet\b/gi, '습한 편'],
  [/\beokbu\b/gi, '억부 관점'],
  [/\btonggwan\b/gi, '통관 관점'],
  [/\bjohu\b/gi, '조후 관점'],
  [/\bbyeongyak\b/gi, '병약 관점'],
  [/\blatent-tension\b/gi, '잠재적 조정 필요'],
  [/\bintegration\b/gi, '조화·결합 흐름'],
  [/\bactivation\b/gi, '활성화 흐름'],
  [/\bMRE-V2-[A-Z0-9-]+\b/g, '내부 검증 규칙'],
  [/\bunwoldang-myeongri-v[\w.-]+\b/gi, '운월당 정밀 명리 엔진']
];

export function normalizeCustomerFacingText(input: string) {
  const token = '([가-힣A-Za-z0-9·]+)';
  let text = input
    .replace(new RegExp(`${token}은\\(는\\)`, 'g'), (_, word: string) => withKoreanParticle(word, '은/는'))
    .replace(new RegExp(`${token}이\\(가\\)`, 'g'), (_, word: string) => withKoreanParticle(word, '이/가'))
    .replace(new RegExp(`${token}을\\(를\\)`, 'g'), (_, word: string) => withKoreanParticle(word, '을/를'))
    .replace(new RegExp(`${token}과\\(와\\)`, 'g'), (_, word: string) => withKoreanParticle(word, '과/와'))
    .replace(/님가/g, '님이')
    .replace(/미상로/g, '미상으로')
    .replace(/편인와/g, '편인과')
    .replace(/겁재은/g, '겁재는')
    .replace(/식신와/g, '식신과')
    .replace(/정인가/g, '정인이')
    .replace(/사은 사건/g, '사는 사건')
    .replace(/태은 사건/g, '태는 사건')
    .replace(/관계의 역할 배치을/g, '관계의 역할 배치를')
    .replace(/판단 순서으로/g, '판단 순서로')
    .replace(/대운 진입 전 대운/g, '첫 대운 진입 전')
    .replace(/고려하면로 보이므로/g, '고려하는 비교로 보이므로')
    .replace(/\[object Object\]/g, '')
    .replace(/\bundefined\b/gi, '')
    .replace(/\bnull\b/gi, '');

  INTERNAL_LABELS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?。！？])/g, '$1')
    .trim();
}

export function normalizeCustomerFacingTextTree<T>(value: T): T {
  if (typeof value === 'string') return normalizeCustomerFacingText(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeCustomerFacingTextTree(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, normalizeCustomerFacingTextTree(item)])
    ) as T;
  }
  return value;
}
