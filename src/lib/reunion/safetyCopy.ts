/**
 * 재회운 리포트 · 삭제 불가 문구와 안전 착지점 (명세 §6-A, §6-F, §6-D).
 *
 * 여기 있는 문자열은 **디자인 정리 과정에서 빠지면 상품 전체가 안전계약 위반으로 되돌아간다.**
 * 렌더러와 테스트가 같은 상수를 참조한다. 컴포넌트에 문자열을 복사해 두지 말 것.
 */

/**
 * 판단 기한 문장 템플릿.
 * 어형이 조금만 틀어져도 `reportBuilder.ts:146` 의 정확 날짜 단정 패턴에 걸린다.
 * 변주를 만들지 말고 이 한 줄만 쓴다.
 */
export const REUNION_DEADLINE_TEMPLATE = '{date}까지 이 신호가 없으면 다시 판단하세요.' as const;

export function formatReunionDeadlineSentence(dateLabel: string): string {
  return REUNION_DEADLINE_TEMPLATE.replace('{date}', dateLabel);
}

export const REUNION_UNDELETABLE_COPY_IDS = [
  'readiness-not-probability',
  'timeline-not-probability',
  'timeline-not-promise',
  'partner-mind-locked',
  'deadline-owner',
  'safety-boundary',
  'legal-notice'
] as const;

export type ReunionUndeletableCopyId = (typeof REUNION_UNDELETABLE_COPY_IDS)[number];

/** CH05 c05-7 전 연령 고정 노출 3줄. 공포 연출을 하지 않는다. */
export const REUNION_SAFETY_BOUNDARY_LINES: readonly string[] = Object.freeze([
  '통제·모욕·위협이 반복됐다면, 이 리포트의 어떤 계산보다 그 사실이 먼저예요.',
  '다시 만나는 쪽이든 아닌 쪽이든, 안전한 거리가 확보된 뒤에 정하셔도 늦지 않아요.',
  '혼자 판단하기 어려우면 믿을 만한 사람에게 상황을 그대로 말해 두세요.'
]);

/**
 * `{name}` 슬롯이 남아 있는 문구는 렌더 직전에 `formatReunionUndeletableCopy` 로 치환한다.
 * 슬롯을 지운 채 상수를 고치면 테스트가 잡는다.
 */
export const REUNION_UNDELETABLE_COPY: Readonly<Record<ReunionUndeletableCopyId, string>> = Object.freeze({
  'readiness-not-probability': '확률이 아니라 조건 개수예요.',
  'timeline-not-probability':
    '재회 확률이 아니라 {name}님 명식의 월별 흐름이에요. 상대의 행동을 예측한 값이 아니에요.',
  'timeline-not-promise': '날짜를 약속하는 표가\n아니에요.',
  'partner-mind-locked': '여기는 저도 못 봐요.',
  'deadline-owner': '{name}님이 정한 점검일이에요.',
  'safety-boundary': REUNION_SAFETY_BOUNDARY_LINES.join('\n'),
  'legal-notice': [
    '재회 확률이나 상대의 속마음은 명리 계산으로 만들거나 확정하지 않습니다.',
    '연도·월·일은 명리 흐름을 살펴보는 참고 구간이며 연락 동의나 재회를 보장하지 않습니다.',
    '차단, 연락 거부, 안전 문제처럼 현실에서 확인된 경계가 명리 해석보다 우선합니다.'
  ].join('\n')
});

export function formatReunionUndeletableCopy(id: ReunionUndeletableCopyId, name: string): string {
  return REUNION_UNDELETABLE_COPY[id].replace(/\{name\}/gu, name);
}

/**
 * 학대 신호 라우팅 착지점 (§6-D).
 *
 * **상담 창구는 제품 결정이며 코드 결정이 아니다.** 운영자가 실제 운영 중인 공공 창구를
 * 확인해 이 값을 채워야 하고, `null` 인 동안에는 라우팅 기능을 출시하지 않는다.
 * 감지 로직만 있고 착지점이 비면 의미가 없기 때문에, 기본값을 지어내지 않고 null 로 둔다.
 */
export interface ReunionSupportContact {
  label: string;
  phone: string;
  hours: string;
  note: string;
}

export const REUNION_SUPPORT_CONTACT: ReunionSupportContact | null = null;

export function isReunionSupportRoutingReady(): boolean {
  return REUNION_SUPPORT_CONTACT !== null;
}

/**
 * 자유 서술에서 통제·모욕·위협 신호를 찾는다.
 * **미탐이 오탐보다 훨씬 치명적이므로 임계값을 낮게 잡아 오탐 쪽으로 기울인다.**
 * 이 함수는 판정이 아니라 '안전 장을 먼저 펼칠지'만 정한다. 독자에게 라벨을 붙이지 않는다.
 */
const HARM_SIGNAL_TERMS: readonly string[] = Object.freeze([
  '때렸',
  '때린',
  '폭행',
  '폭력',
  '맞았',
  '협박',
  '죽이겠',
  '죽인다',
  '감금',
  '스토킹',
  '따라다니',
  '욕설',
  '모욕',
  '무시하고 소리',
  '소리를 질',
  '물건을 던',
  '통제',
  '못 만나게',
  '휴대폰을 뺏',
  '돈을 뺏',
  '협박당',
  '무서웠',
  '무서워서',
  '겁이 나'
]);

export function findReunionHarmSignals(...texts: Array<string | null | undefined>): string[] {
  const joined = texts.filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n');
  if (!joined) return [];
  return HARM_SIGNAL_TERMS.filter((term) => joined.includes(term));
}
