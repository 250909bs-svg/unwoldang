/**
 * 재회운 리포트 · 명리 용어 번역 사전과 말풍선 규격 (명세 §3-5, §4-5).
 *
 * **2층 분리 규칙(코드로 강제):**
 *   컷 대사(bubbles/narration)는 명리 용어 0개, 결과만 25자 이내.
 *   용어는 `evidenceBadge` 에만 `[용어] + 한 줄 번역` 형태로 쓴다.
 *   한 문장에 둘을 섞지 않는다.
 *
 * 제미나이에게 자유 번역을 맡기지 않는다. 이 표가 유일한 번역이다.
 */

export const REUNION_TERM_GLOSSARY = Object.freeze({
  편관: '경쟁과 압박 상황에서 먼저 긴장하는 자리',
  정관: '규칙과 책임을 먼저 보는 자리',
  식신: '표현하고 돌보는 자리',
  상관: '직설과 이탈이 먼저 나오는 자리',
  편재: '흐르는 돈과 넓은 관계의 자리',
  정재: '고정된 것을 지키는 자리',
  비견: '내 기준을 먼저 세우는 자리',
  겁재: '경쟁과 나눔이 함께 오는 자리',
  편인: '되짚고 반추하는 자리',
  정인: '기대고 회복하는 자리',
  제왕: '정점',
  귀인: '끌어주는 사람',
  충: '속도가 다를 때 생기는 마찰',
  합: '붙어 있으려는 힘'
} as const);

export type ReunionGlossaryTerm = keyof typeof REUNION_TERM_GLOSSARY;

export const REUNION_TERM_KEYS = Object.freeze(
  Object.keys(REUNION_TERM_GLOSSARY) as ReunionGlossaryTerm[]
);

export function isReunionGlossaryTerm(value: string): value is ReunionGlossaryTerm {
  return Object.prototype.hasOwnProperty.call(REUNION_TERM_GLOSSARY, value);
}

export function translateReunionTerm(term: string): string | null {
  return isReunionGlossaryTerm(term) ? REUNION_TERM_GLOSSARY[term] : null;
}

/**
 * 컷 대사에서 금지되는 명리 용어 목록.
 * 사전 키에 더해 대사에 새어 나오면 안 되는 계산 용어를 포함한다.
 */
export const REUNION_MYEONGRI_TERMS: readonly string[] = Object.freeze([
  ...REUNION_TERM_KEYS,
  '일간',
  '월령',
  '용신',
  '격국',
  '지장간',
  '십성',
  '대운',
  '세운',
  '월운',
  '원국',
  '신강',
  '신약',
  '오행',
  '천간',
  '지지',
  '형',
  '파',
  '해'
]);

/**
 * 컷 대사에 섞인 명리 용어를 찾는다.
 * '충'·'합'·'형'·'파'·'해' 는 일상어에도 나오는 한 글자라 단독 토큰일 때만 잡는다
 * ('조합', '이해', '설명해' 같은 말이 걸리면 검사 자체가 쓸모없어진다).
 */
const SINGLE_CHAR_TERMS = new Set(['충', '합', '형', '파', '해']);

export function findMyeongriTerms(text: string): string[] {
  if (typeof text !== 'string' || !text) return [];
  const hits: string[] = [];
  REUNION_MYEONGRI_TERMS.forEach((term) => {
    if (SINGLE_CHAR_TERMS.has(term)) {
      if (new RegExp(`(?:^|[\\s'"\\[(])${term}(?:$|[\\s'"\\]).,·])`, 'u').test(text)) hits.push(term);
      return;
    }
    if (text.includes(term)) hits.push(term);
  });
  return hits;
}

/** 시안 2.png 실측치(총 25~27자, 3줄, 줄당 8~10자)를 상수로 박은 값. */
export const REUNION_BUBBLE_SPEC = Object.freeze({
  maxChars: 26,
  maxLines: 4,
  maxCharsPerLine: 11,
  maxBubblesPerCut: 2
});

/** 나레이션 규격. 2~3줄, 줄당 8~11자. */
export const REUNION_NARRATION_SPEC = Object.freeze({
  maxChars: 40,
  maxLines: 4,
  maxCharsPerLine: 11
});

export interface ReunionTextSpec {
  maxChars: number;
  maxLines: number;
  maxCharsPerLine: number;
}

export interface ReunionTextViolation {
  rule: 'maxChars' | 'maxLines' | 'maxCharsPerLine' | 'myeongri-term' | 'missing-linebreak';
  detail: string;
}

/**
 * 말풍선·나레이션 규격 검사. 위반 시 **자르지 않고 그 컷을 거부**하는 것이 계약이다
 * (문장 중간 절단은 말풍선에서 치명적이다).
 *
 * 줄바꿈은 `\n` 으로 데이터에 직접 들어온다. 자동 wrap 에 맡기지 않는다.
 */
export function findReunionTextViolations(
  text: string,
  spec: ReunionTextSpec = REUNION_BUBBLE_SPEC,
  options: { allowMyeongriTerms?: boolean } = {}
): ReunionTextViolation[] {
  const violations: ReunionTextViolation[] = [];
  if (typeof text !== 'string') return [{ rule: 'maxChars', detail: '문자열이 아닙니다.' }];

  const lines = text.split('\n');
  const charCount = text.replace(/\n/gu, '').length;

  if (charCount > spec.maxChars) {
    violations.push({ rule: 'maxChars', detail: `${charCount}자 (최대 ${spec.maxChars}자)` });
  }
  if (lines.length > spec.maxLines) {
    violations.push({ rule: 'maxLines', detail: `${lines.length}줄 (최대 ${spec.maxLines}줄)` });
  }
  lines.forEach((line, index) => {
    if (line.length > spec.maxCharsPerLine) {
      violations.push({
        rule: 'maxCharsPerLine',
        detail: `${index + 1}번째 줄 ${line.length}자 (최대 ${spec.maxCharsPerLine}자)`
      });
    }
  });
  if (lines.length === 1 && charCount > spec.maxCharsPerLine) {
    violations.push({ rule: 'missing-linebreak', detail: '줄바꿈이 없는데 한 줄 한도를 넘었습니다.' });
  }
  if (!options.allowMyeongriTerms) {
    const terms = findMyeongriTerms(text);
    if (terms.length > 0) {
      violations.push({ rule: 'myeongri-term', detail: `컷 대사에 명리 용어: ${terms.join(', ')}` });
    }
  }
  return violations;
}
