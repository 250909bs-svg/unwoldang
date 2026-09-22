/**
 * 한국어 조사 붙이기.
 *
 * `이(가)`, `을(를)` 로 도망가면 화면에 괄호가 남는다. 조사는 앞 글자의 받침으로
 * 결정되고, 한글 음절은 U+AC00 부터 종성 28개가 한 벌로 반복하므로 나머지 연산 하나로
 * 받침 유무를 알 수 있다.
 *
 * 한자·영문·숫자가 끝에 오면 받침을 알 수 없다. 그때는 받침이 없는 쪽으로 붙인다 —
 * 사주 화면에서 끝에 오는 것은 대개 한글 음차이고, 틀렸을 때 덜 어색한 쪽이다.
 */

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const JONGSEONG_COUNT = 28;

/** 마지막 글자에 받침이 있는가. 한글 음절이 아니면 null(알 수 없음). */
export function hasFinalConsonant(word: string): boolean | null {
  const last = word.trim().at(-1);
  if (!last) return null;

  const code = last.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return null;

  return (code - HANGUL_START) % JONGSEONG_COUNT !== 0;
}

function attach(word: string, withFinal: string, withoutFinal: string) {
  return `${word}${hasFinalConsonant(word) ? withFinal : withoutFinal}`;
}

/** 은/는 */
export function withTopicParticle(word: string) {
  return attach(word, '은', '는');
}

/** 이/가 */
export function withSubjectParticle(word: string) {
  return attach(word, '이', '가');
}

/** 을/를 */
export function withObjectParticle(word: string) {
  return attach(word, '을', '를');
}

/** 과/와 */
export function withConjunctionParticle(word: string) {
  return attach(word, '과', '와');
}

/** 으로/로 — 받침이 ㄹ 이면 '로' 다. */
export function withDirectionParticle(word: string) {
  const last = word.trim().at(-1);
  const code = last ? last.charCodeAt(0) : 0;

  if (code >= HANGUL_START && code <= HANGUL_END) {
    const jongseong = (code - HANGUL_START) % JONGSEONG_COUNT;
    // 8 = ㄹ. 'ㄹ' 받침은 '으로' 가 아니라 '로' 를 받는다(물로, 불로).
    if (jongseong === 8) return `${word}로`;
  }

  return attach(word, '으로', '로');
}
