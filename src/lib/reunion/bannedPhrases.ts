/**
 * 재회운 리포트 · 금지 표현 테이블 (명세 §6-E).
 *
 * 이 파일은 **순수 데이터 + 순수 검사 함수**다. 두 곳에 같은 표를 건다:
 *   (1) 제미나이 프롬프트 직렬화 — 모델에게 쓰지 말 것을 먼저 알린다
 *   (2) 템플릿 출력 검사 — 결정론 카피가 스스로 위반하지 않았는지 본다
 *
 * `reportBuilder.ts:130-150` 의 `findLoveReunionSafetyViolations` 를 **대체하지 않는다.**
 * 그쪽은 병합된 리포트 전체에 걸리는 하드 가드이고, 이쪽은 재회 카피 계층의 선검사다.
 * 둘 다 살아 있어야 한다.
 */

import type { ReunionAgeBand } from './ageBand';
import { getReunionBandProfile } from './bandCopy';

export interface ReunionBannedPhraseRule {
  id: string;
  /** 왜 금지인지. 검사 실패 메시지와 프롬프트 직렬화에 함께 실린다. */
  reason: string;
  /** 부분 문자열로 검사할 표현. */
  phrases?: readonly string[];
  /** 문자열로 못 잡는 형태를 잡는 정규식. */
  patterns?: readonly RegExp[];
}

/**
 * 전 연령 공통 금지.
 *
 * 주의: `patterns` 의 정규식은 전역 플래그를 쓰지 않는다(`lastIndex` 상태가 남아
 * 같은 정규식을 두 번 쓰면 결과가 달라진다).
 */
export const REUNION_COMMON_BANNED_RULES: readonly ReunionBannedPhraseRule[] = Object.freeze([
  {
    id: 'identity-branding',
    reason: '인격 낙인. 존재 규정이 아니라 이 관계에서의 행동 서술로 바꾼다.',
    phrases: ['외로운 사주', '정 줘도 소용없다', '기질이 예민한 사람', '팔자가'],
    patterns: [
      /[가-힣]{2,10}\s*사주(?:다|입니다|예요|이에요)/u,
      /(?:당신|고객님|[가-힣]{1,6}님)(?:은|는)\s*[^.!?\n]{0,16}(?:한|인)\s*사람(?:이다|입니다|이에요|예요)/u
    ]
  },
  {
    id: 'upsell',
    reason: '부적·굿·추가 상담·추가 결제 유도. 즉시 사기로 분류된다.',
    phrases: ['부적', '굿을', '개운', '추가 상담', '더 자세한 상담', '다음 리포트에서', '심화 리포트를']
  },
  {
    id: 'probability',
    reason: '재회를 확률로 단정한다. 합성 지표도 이름만 바꾼 확률이다.',
    /*
     * `재회 확률` 을 통짜로 막으면 이 상품의 핵심 카피인
     * `재회 확률이 아니라 …` 까지 걸린다. 부정문은 통과시키고 **단정문만** 잡는다.
     * `reportBuilder.ts:140-141` 의 하드 가드와 같은 모양이다.
     */
    phrases: ['성공률', '회복 지수', '관계 회복 여건 지수', '재회 지수'],
    patterns: [
      /재회\s*(?:확률|가능성)\s*(?::|은|는|이|가)?\s*(?:\d|매우\s*)?(?:높|낮|크|작|충분|희박|\d)/u,
      /\d+(?:\.\d+)?\s*%/u
    ]
  },
  {
    id: 'single-date-prophecy',
    reason: '단일 날짜 예언. 시기는 조건과 함께만 쓴다.',
    patterns: [
      /\d{1,2}월\s*\d{1,2}일[^.!?\n]{0,20}(?:재회|연락|만나)/u,
      /\d{4}년\s*\d{1,2}월[^.!?\n]{0,20}(?:연락이\s*온|재회(?:한|해|합니다))/u
    ]
  },
  {
    id: 'partner-mind',
    reason: '상대의 속마음 단정. CH02 전체가 이 제약을 상품화한 것이다.',
    patterns: [
      /(?:상대방?|그 사람)(?:은|는|이|가)\s*[^.!?\n]{0,24}(?:그리워|미련이|후회하고|사랑하고|마음이 남)/u
    ]
  },
  {
    id: 'deferral-selling',
    reason: '시기 밀기. 다음 결제를 해야 안다는 암시.',
    phrases: ['다음에 알려', '더 결제하시면', '유료로 전환하시면 알 수']
  },
  {
    id: 'scolding',
    reason: '훈계형. 계량 서술로 전환한다.',
    phrases: ['매달리지 마세요', '집착하지 마세요', '자존심을 지키세요', '잊으세요', '정신 차리']
  },
  {
    id: 'surveillance',
    reason: '감시 유도(§6-B). 새로 관찰할 대상을 만들어 주지 않는다.',
    phrases: [
      'SNS',
      '스토리',
      '프로필 사진',
      '온라인 상태',
      '접속 시간',
      '차단이 풀',
      '차단을 확인',
      '공통 지인',
      '친구에게 물어',
      '주변에 물어'
    ]
  },
  {
    id: 'partner-nickname',
    reason: "상대 호칭은 전 연령 '그 사람' 으로 통일한다.",
    phrases: ['전남친', '전여친', '남친', '여친', '전 남자친구', '전 여자친구']
  },
  {
    id: 'age-mention',
    reason: '나이·세대 언급 일체 금지(§2-4).',
    phrases: ['또래', '세대', '나이대', '연령대'],
    patterns: [/\d{1,3}\s*세(?![기대])/u, /\d{2}대(?:\s|,|\.|$)/u]
  },
  {
    id: 'banmal',
    reason: '반말 추궁. 이별 직후 독자에게 2차 가해다.',
    phrases: ['했잖아', '하지 마라', '그러니까 네가', '너는 지금']
  },
  {
    id: 'third-party-brand',
    reason: '타사 브랜드 조어를 쓰지 않는다.',
    phrases: ['타이트사주', '청월당']
  }
]);

export interface ReunionBannedPhraseHit {
  ruleId: string;
  reason: string;
  /** 실제로 걸린 조각. */
  match: string;
}

function ruleHits(rule: ReunionBannedPhraseRule, text: string): ReunionBannedPhraseHit[] {
  const hits: ReunionBannedPhraseHit[] = [];
  rule.phrases?.forEach((phrase) => {
    if (phrase && text.includes(phrase)) hits.push({ ruleId: rule.id, reason: rule.reason, match: phrase });
  });
  rule.patterns?.forEach((pattern) => {
    const found = pattern.exec(text);
    if (found) hits.push({ ruleId: rule.id, reason: rule.reason, match: found[0] });
  });
  return hits;
}

/** 공통 규칙 + 해당 밴드의 추가 금지어를 합친 규칙 목록. */
export function getReunionBannedRules(band?: ReunionAgeBand): readonly ReunionBannedPhraseRule[] {
  if (!band) return REUNION_COMMON_BANNED_RULES;
  const extra = getReunionBandProfile(band).banned;
  if (extra.length === 0) return REUNION_COMMON_BANNED_RULES;
  return [
    ...REUNION_COMMON_BANNED_RULES,
    {
      id: `band:${band}`,
      reason: '이 밴드에서 추가로 금지된 표현입니다.',
      phrases: extra
    }
  ];
}

/** 프롬프트 직렬화·테스트용 평면 목록(중복 제거, 정렬 없음 — 선언 순서가 곧 우선순위다). */
export function getReunionBannedPhrases(band?: ReunionAgeBand): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  getReunionBannedRules(band).forEach((rule) => {
    rule.phrases?.forEach((phrase) => {
      if (phrase && !seen.has(phrase)) {
        seen.add(phrase);
        out.push(phrase);
      }
    });
  });
  return out;
}

/** 템플릿 출력 검사. 위반이 없으면 빈 배열. */
export function findReunionBannedPhrases(text: string, band?: ReunionAgeBand): ReunionBannedPhraseHit[] {
  if (typeof text !== 'string' || !text) return [];
  return getReunionBannedRules(band).flatMap((rule) => ruleHits(rule, text));
}

export function assertNoReunionBannedPhrases(text: string, band?: ReunionAgeBand, where = '재회 카피') {
  const hits = findReunionBannedPhrases(text, band);
  if (hits.length > 0) {
    const detail = hits.map((hit) => `${hit.match}(${hit.ruleId})`).join(', ');
    throw new Error(`${where}에 금지 표현이 있습니다: ${detail}`);
  }
}

/** 제미나이 프롬프트에 그대로 박는 한 덩어리. 규칙 문구와 사유를 함께 넘긴다. */
export function serializeReunionBannedPhrases(band?: ReunionAgeBand): string {
  return getReunionBannedRules(band)
    .map((rule) => `- ${rule.reason} 금지: ${(rule.phrases || []).join(' / ') || '(패턴 검사)'}`)
    .join('\n');
}
