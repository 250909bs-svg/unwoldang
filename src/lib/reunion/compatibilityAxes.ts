/**
 * 재회운 리포트 · 궁합 4축 판독 (명세 §0-a, §3-2-1).
 *
 * 원천은 `reportBuilder.ts:3057-3084` 이 이미 직렬화해 둔 `compatibility-evidence-v2` 섹션이다.
 *   - `cards[]`  : dimension 4개 `{ title: label, body: statement, tone, badge: "${tendency} · ${confidenceLabel}" }`
 *   - `details[]`: fact 목록
 *   - `paragraphs[]`: overview / dayMaster / spousePalace / elementExchange 결론 4줄
 *
 * `basis.commercialV2.compatibility` 는 클라이언트에 오지 않는다. `SajuReportData` 에
 * `basis`/`commercialV2` 필드가 없기 때문이다. 이 섹션이 유일한 경로다.
 *
 * `crossRelations` 14건과 `elementExchange` 원자료도 클라이언트에 오지 않는다 —
 * '붉은 실 4가닥', '마찰 다이어그램 상위 3건' 류 컷은 근거가 없으므로 만들지 않는다.
 */

import type { SajuReportData } from '../saju/report';
import type { ReunionAxisDirection, ReunionCompatibilityAxis } from './reportTypes';

export const REUNION_COMPATIBILITY_SECTION_ID = 'compatibility-evidence-v2';

/** 영문 식별자를 그대로 화면에 쓰지 않는다. */
export const REUNION_AXIS_DIRECTION_LABELS: Readonly<Record<ReunionAxisDirection, string>> = Object.freeze({
  supportive: '순함',
  conditional: '조건부',
  tension: '부딪힘',
  insufficient: '근거부족'
});

export const REUNION_AXIS_DIRECTION_ICONS: Readonly<Record<ReunionAxisDirection, '↗' | '→' | '↘' | '?'>> =
  Object.freeze({
    supportive: '↗',
    conditional: '→',
    tension: '↘',
    insufficient: '?'
  });

const DIRECTION_VALUES: readonly ReunionAxisDirection[] = ['supportive', 'conditional', 'tension', 'insufficient'];

export interface ParsedCompatibilityBadge {
  direction: ReunionAxisDirection;
  /** '근거 강함' / '근거 보통' / '근거 제한' / '판정 유보'. 관계 점수가 아니다. */
  confidenceLabel: string;
}

/**
 * **실측 정정:** 고객 화면에 도달하는 배지는 `"supportive · 근거 강함"` 형태가 아니다.
 * `reportBuilder.ts:3073` 이 그 형태로 만들지만, 리포트가 나가기 전에
 * `reportPresentation.ts:68-80 customerTendency` 와 `koreanText.ts` 의 내부 라벨 치환이
 * 영문 식별자를 한국어 문구로 바꾸고 `· 근거 강함/보통/제한` 꼬리를 떼어 낸다.
 * 실제로 받는 값은 `"조정이 필요한 흐름"`, `"조건을 함께 봐야 합니다"` 같은 한 덩어리다.
 *
 * 영문 형태만 파싱하면 **모든 축이 '근거부족'으로 착지해** CH02 전체가 빈 판정이 된다.
 * 두 형태를 모두 받는다. 어느 쪽도 아니면 `insufficient` 로 착지한다 — 모르면 모른다고 그린다.
 */
const KOREAN_DIRECTION_PHRASES: ReadonlyArray<readonly [string, ReunionAxisDirection]> = Object.freeze([
  ['조화를 돕는 흐름', 'supportive'],
  ['조정이 필요한 흐름', 'tension'],
  ['잠재적 조정 필요', 'tension'],
  ['마찰 가능성', 'tension'],
  ['조건을 함께 봐야 하는 흐름', 'conditional'],
  ['조건을 함께 봐야 합니다', 'conditional'],
  ['중립적인 흐름', 'conditional'],
  ['조화·결합 흐름', 'supportive'],
  ['활성화 흐름', 'supportive'],
  ['변화를 만드는 흐름', 'conditional'],
  ['현재 정보로는 판단을 유보합니다', 'insufficient'],
  ['판단을 유보', 'insufficient']
] as const);

const CONFIDENCE_TAIL = /근거\s*(?:강함|보통|제한)|판정\s*유보|근거가\s*충분합니다/u;

export function parseCompatibilityBadge(badge: string | undefined): ParsedCompatibilityBadge {
  const fallback: ParsedCompatibilityBadge = { direction: 'insufficient', confidenceLabel: '판정 유보' };
  if (typeof badge !== 'string') return fallback;

  const parts = badge.split('·').map((part) => part.trim());
  const englishDirection = DIRECTION_VALUES.find((value) => value === parts[0]);
  if (englishDirection) {
    const confidenceLabel = parts.slice(1).join(' · ').trim();
    return { direction: englishDirection, confidenceLabel: confidenceLabel || fallback.confidenceLabel };
  }

  const matched = KOREAN_DIRECTION_PHRASES.find(([phrase]) => badge.includes(phrase));
  if (!matched) return fallback;

  /* 번역 단계에서 신뢰도 꼬리가 이미 잘려 나간 경우가 대부분이다.
     없는 신뢰도를 '판정 유보'로 채우면 방향과 어긋나는 거짓 라벨이 되므로 빈 문자열로 둔다. */
  const confidencePart = parts.slice(1).find((part) => CONFIDENCE_TAIL.test(part));
  return { direction: matched[1], confidenceLabel: confidencePart ? confidencePart.trim() : '' };
}

function findCompatibilitySection(report: Pick<SajuReportData, 'sections'> | null | undefined) {
  return report?.sections?.find((section) => section.id === REUNION_COMPATIBILITY_SECTION_ID) || null;
}

/**
 * 상대 출생시간을 받지 않아 진태양시 보정이 본인에게만 적용된다(§6-H).
 * 이 비대칭은 감추지 않고 CH02 각주로 표기한다.
 */
export const REUNION_PRECISION_ASYMMETRY_NOTE =
  '상대의 출생지는 받지 않아 시간 보정이 {name}님 쪽에만 적용됐어요. 두 사람의 정밀도가 같지 않아요.';

/**
 * 궁합 4축. 섹션이 없으면 빈 배열을 돌려준다 —
 * 이때 CH02·CH05 는 장이 사라지는 게 아니라 `reducedReason` 을 채워 축소 렌더한다.
 */
export function buildReunionCompatibilityAxes(
  report: Pick<SajuReportData, 'sections'> | null | undefined
): ReunionCompatibilityAxis[] {
  const section = findCompatibilitySection(report);
  if (!section?.cards?.length) return [];

  return section.cards.map((card, index) => {
    const { direction, confidenceLabel } = parseCompatibilityBadge(card.badge);
    const statement = (card.body || '').trim();
    const missing = direction === 'insufficient' || !statement;

    return {
      id: `axis-${index}`,
      label: (card.title || '').trim() || `축 ${index + 1}`,
      direction: missing ? 'insufficient' : direction,
      directionLabel: REUNION_AXIS_DIRECTION_LABELS[missing ? 'insufficient' : direction],
      directionIcon: REUNION_AXIS_DIRECTION_ICONS[missing ? 'insufficient' : direction],
      statement,
      evidenceConfidenceLabel: confidenceLabel,
      withheldReason: missing ? '시간 정보가 없어 이 축은 판단을 보류해요' : null
    };
  });
}

/** 궁합 결론 4줄(overview / 일간 / 배우자궁 / 오행 교환). */
export function getReunionCompatibilityConclusions(
  report: Pick<SajuReportData, 'sections'> | null | undefined
): readonly string[] {
  const section = findCompatibilitySection(report);
  return (section?.paragraphs || []).map((line) => line.trim()).filter(Boolean);
}

/** 궁합 fact 목록. `details` 는 지금까지 버려지던 자료다. */
export function getReunionCompatibilityFacts(
  report: Pick<SajuReportData, 'sections'> | null | undefined
): readonly { summary: string; content: string }[] {
  const section = findCompatibilitySection(report);
  return (section?.details || []).map((detail) => ({
    summary: detail.summary,
    content: detail.content
  }));
}

/** '관계 지속과 회복' 축. CH05 반복 지점 표의 근거. */
export function findReunionContinuityAxis(axes: readonly ReunionCompatibilityAxis[]) {
  return axes.find((axis) => axis.label.includes('지속')) || axes[axes.length - 1] || null;
}

/** '표현과 의사소통' 축. CH03 readiness 의 `expression-axis` 조건 근거. */
export function findReunionExpressionAxis(axes: readonly ReunionCompatibilityAxis[]) {
  return axes.find((axis) => axis.label.includes('표현') || axis.label.includes('의사소통')) || null;
}

export function hasCompatibilityEvidence(report: Pick<SajuReportData, 'sections'> | null | undefined): boolean {
  return buildReunionCompatibilityAxes(report).some((axis) => axis.direction !== 'insufficient');
}

/** 근거가 없어 축소 렌더할 때의 사유. 감추면 '내용이 빈약하다'로 읽힌다. */
export const REUNION_REDUCED_COMPATIBILITY_REASON =
  '상대의 생년월일이나 태어난 시간이 확정되지 않아 이 장은 근거가 부족해 짧게 씁니다.';
