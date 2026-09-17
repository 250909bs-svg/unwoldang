/**
 * 재회운 리포트 · 장별 ◆근거 선별 (명세 §3-1, §3-5, §2-4).
 *
 * 컷 대사는 결정론 카피(`src/lib/reunion/chapters.ts`)가 만들고, 이 파일은 **엔진이 이미
 * 계산해 둔 산문**을 장마다 골라 근거 아코디언에 내려보낸다. 문장을 새로 쓰지 않고
 * 고르기만 한다 — 화면에서 문자열을 지어내면 근거 추적성이 끊긴다.
 *
 * 두 가지 제약을 여기서 건다:
 *   1) **2층 분리** — 명리 용어가 섞인 산문은 컷 대사가 아니라 근거 아코디언에만 들어간다.
 *   2) **나이 노출 금지** — `currentDayun.range` 는 `30세 ~ 39세` 문자열이라 그대로 쓰면
 *      밴드 금지 규칙(나이·세대 언급 일체)과 정면 충돌한다. 연도 구간으로 바꾸고,
 *      바꾸지 못하면 나이를 통과시키는 대신 그 항목을 버린다.
 *
 * 순수 함수다. `new Date()` 를 부르지 않는다.
 */

import { containsAgeNotation, toDayunYearRange } from '../../lib/reunion';
import type { ReunionChapterId } from '../../lib/reunion';
import type { ReportSection, SajuReportData } from '../../lib/saju/report';

export interface ReunionEvidenceEntry {
  id: string;
  /** 아코디언 한 줄 제목. */
  label: string;
  /** 엔진 산문 그대로. 여기서 문장을 고쳐 쓰지 않는다. */
  body: string;
}

export interface ReunionChapterEvidence {
  /** 아코디언 `<summary>` 에 실리는 제목. */
  title: string;
  /** 왜 이 자료가 이 장에 붙는지 한 줄. */
  note: string;
  entries: readonly ReunionEvidenceEntry[];
}

export type ReunionEvidenceMap = Readonly<Record<ReunionChapterId, ReunionChapterEvidence>>;

const findSection = (report: SajuReportData, id: string): ReportSection | undefined =>
  report.sections?.find((section) => section.id === id);

/**
 * 엔진 내부 줄. `reportPresentation.ts:23 INTERNAL_DETAIL_LINE` 과 같은 목록이되
 * `재회 적용:` 이 하나 더 붙어 있다.
 * 재회운은 `finalizeCustomerReport` 를 타지 않는 경로가 있어(`Report.tsx` 의 reunion 분기)
 * 이 줄들이 그대로 남아 온다. 화면에서 한 번 더 건다.
 *
 * `재회 적용:` 은 `Report.tsx:6131` 이 `monthLuck[].score` 를 **절대 임계값 75/55** 로
 * 다시 갈라 만든 문구다. CH04 차트는 같은 12개 점수를 **33/67 퍼센타일**로 가르므로,
 * 두 문장을 한 장에 함께 실으면 같은 달이 서로 다른 기준으로 두 번 분류된다.
 * 분류 문구를 떼고 엔진의 원 서술(`summary`/`주의`)만 남긴다.
 */
const INTERNAL_LINE = /^(?:규칙|근거 ID|내부 근거|재현 지문|재회 적용)\s*:/u;

/**
 * 고객 화면에 도달하면 안 되는 내부 식별자 → 한국어.
 * `reportPresentation.ts:68-80 customerTendency` 와 같은 방향이되,
 * 그 함수가 다루지 않는 `mixed`·`day-master` 류까지 덮는다.
 */
const IDENTIFIER_REWRITES: ReadonlyArray<readonly [RegExp, string]> = Object.freeze([
  [/\bday-master\b/giu, '일간'],
  [/\bspouse-palace\b/giu, '배우자궁'],
  [/\belement-exchange\b/giu, '오행 교환'],
  [/\brelation-pattern\b/giu, '관계 패턴'],
  [/\bmixed\b/giu, '결합과 마찰이 함께'],
  [/\bsupportive\b/giu, '조화를 돕는 흐름'],
  [/\btension\b/giu, '조정이 필요한 흐름'],
  [/\bconditional\b/giu, '조건을 함께 봐야 하는 흐름'],
  [/\binsufficient\b/giu, '판단 보류'],
  [/\bneutral\b/giu, '중립적인 흐름']
] as const);

const clean = (value: string | undefined | null): string => {
  const kept = (value || '')
    .split(/\n+/u)
    .filter((line) => line.trim() && !INTERNAL_LINE.test(line.trim()))
    .join(' ');
  return IDENTIFIER_REWRITES.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    kept
  )
    .replace(/\s+/gu, ' ')
    .trim();
};

/**
 * 남은 라틴 문자 식별자. `personA`/`personB` 누출(`v2/compatibility/engine.ts:477-497`)이
 * 대표적이다. 화면에서 문장을 고쳐 쓰면 근거 추적성이 끊기므로 **고치지 않고 버린다.**
 */
const LEAKED_IDENTIFIER = /person[AB]|[a-z]{3,}-[a-z]{3,}|\b[a-z]{5,}\b/u;

/**
 * 나이 표기가 남은 문장도 버린다.
 * 조용히 통과시키는 것이 이 검사의 유일한 실패 방식이므로 다듬지 않고 제외한다.
 */
const keepable = (entry: ReunionEvidenceEntry): boolean =>
  entry.body.length > 0 &&
  !containsAgeNotation(entry.body) &&
  !containsAgeNotation(entry.label) &&
  !LEAKED_IDENTIFIER.test(entry.body) &&
  !LEAKED_IDENTIFIER.test(entry.label);

function fromDetails(
  section: ReportSection | undefined,
  prefix: string,
  limit: number,
  offset = 0
): ReunionEvidenceEntry[] {
  return (section?.details || [])
    .slice(offset, offset + limit)
    .map((detail, index) => ({
      id: `${prefix}-detail-${offset + index}`,
      label: clean(detail.summary),
      body: clean(detail.content)
    }))
    .filter(keepable);
}

function fromCards(
  section: ReportSection | undefined,
  prefix: string,
  limit: number,
  offset = 0
): ReunionEvidenceEntry[] {
  return (section?.cards || [])
    .slice(offset, offset + limit)
    .map((card, index) => ({
      id: `${prefix}-card-${offset + index}`,
      label: clean(card.title),
      body: clean(card.body)
    }))
    .filter(keepable);
}

/**
 * 제목으로 카드를 골라 온다. CH03 처럼 **계산에 실제로 쓰인 카드 하나**만 근거로 실어야 할 때
 * 쓴다. 섹션 전체를 붙이면 계산에 쓰이지 않은 자료가 '이 숫자를 센 근거'로 표시된다.
 */
function fromCardsMatching(
  section: ReportSection | undefined,
  prefix: string,
  matches: (title: string) => boolean
): ReunionEvidenceEntry[] {
  return (section?.cards || [])
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => matches(card.title || ''))
    .map(({ card, index }) => ({
      id: `${prefix}-card-${index}`,
      label: clean(card.title),
      body: clean(card.body)
    }))
    .filter(keepable);
}

function fromParagraphs(
  section: ReportSection | undefined,
  prefix: string,
  label: string,
  limit: number,
  offset = 0
): ReunionEvidenceEntry[] {
  return (section?.paragraphs || [])
    .slice(offset, offset + limit)
    .map((paragraph, index) => ({
      id: `${prefix}-para-${offset + index}`,
      label,
      body: clean(paragraph)
    }))
    .filter(keepable);
}

/**
 * `乙巳 대운 · 2023 ~ 2033`.
 * 상세페이지 패널 14 의 `○○ 대운 · ○○○○~○○○○` 모형과 같은 형식이다.
 *
 * 연도는 **엔진이 계산한 대운 경계**(`FortuneWindow.startsAt`/`endsAt`)에서만 뽑는다.
 * 생년 + 시작 나이로 되짚으면 입운이 소수 나이에서 시작하기 때문에 구간이 어긋난다.
 * 경계가 없으면 간지만 남긴다 — 계산되지 않은 연도에 ◆ 를 붙이지 않는다.
 */
export function formatReunionDayunLabel(report: Pick<SajuReportData, 'currentDayun'>): string {
  const name = clean(report.currentDayun?.name);
  if (!name) return '자료 없음';
  const years = toDayunYearRange(report.currentDayun?.startsAt, report.currentDayun?.endsAt);
  return years ? `${name} 대운 · ${years}` : `${name} 대운`;
}

const EMPTY: ReunionChapterEvidence = Object.freeze({ title: '', note: '', entries: [] });

/**
 * 장별 근거. 항목 수 상한은 분량 예산이다 —
 * 엔진이 내는 산문은 2만 자가 넘고, 전부 붙이면 리포트가 읽히지 않는다.
 */
export function buildReunionChapterEvidence(report: SajuReportData): ReunionEvidenceMap {
  /**
   * **실측 목록.** love-reunion 리포트가 뷰에 도달할 때 남아 있는 섹션은 여섯 개뿐이다 —
   * `Report.tsx:6096 buildReunionProductReport` 가 `sections` 를 통째로 갈아 끼우고,
   * 그 뒤 `preserveEngineEvidence` 가 `-v2` 엔진 섹션 네 개를 되살린다.
   * `love` / `ten` / `element` / `month` / `year` 섹션은 이 상품에서는 **오지 않는다.**
   * (`getSection(report,'love')` 이 compactSections 에서 떨어져 나간다.)
   */
  const audit = findSection(report, 'calculation-audit-v2');
  const expert = findSection(report, 'expert-evidence-v2');
  const compatibility = findSection(report, 'compatibility-evidence-v2');
  const temporal = findSection(report, 'temporal-evidence-v2');
  /* `reunion-core` 는 일부러 쓰지 않는다 — `Report.tsx` 안의 고정 산문이라 개인 계산이 아니다. */
  const reunionTimeline = findSection(report, 'reunion-timeline');

  const auditBullets = (audit?.bullets || []).slice(0, 6).map(clean).filter(Boolean);

  const summaryEntries: ReunionEvidenceEntry[] = [
    ...(report.summary?.analysis || []).slice(0, 2).map((line, index) => ({
      id: `summary-analysis-${index}`,
      label: '계산이 남긴 요약',
      body: clean(line)
    })),
    ...(report.summary?.advice || []).slice(0, 2).map((line, index) => ({
      id: `summary-advice-${index}`,
      label: '엔진이 권한 순서',
      body: clean(line)
    })),
    ...(report.keyTakeaways || []).slice(0, 2).map((card, index) => ({
      id: `takeaway-${index}`,
      label: clean(card.title),
      body: clean(card.body)
    }))
  ].filter(keepable);

  return Object.freeze({
    prologue: {
      title: '이 리포트가 무엇을 계산했는지',
      note: '여기부터는 제가 계산한 것(◆)이에요. 알려주신 것(◇)과 섞지 않아요.',
      entries: [
        ...fromParagraphs(audit, 'audit', '계산 기준', 2),
        ...(auditBullets.length > 0
          ? [
              {
                id: 'audit-bullets',
                label: '계산에 쓴 기준',
                body: auditBullets.join(' / ')
              }
            ]
          : [])
      ].filter(keepable)
    },
    'breakup-reason': {
      title: '이 장의 계산 근거',
      note: '용어는 여기에만 둬요. 앞의 대사와 한 문장에 섞지 않아요.',
      entries: [
        ...fromParagraphs(expert, 'expert', '명식 판정 기준', 1),
        ...fromCards(expert, 'expert', 2),
        ...fromDetails(expert, 'expert', 2)
      ]
    },
    'partner-state': {
      title: '두 명식이 맞물리는 방식',
      note: '상대의 마음이 아니라 두 명식의 구조에 대한 계산이에요.',
      entries: [
        ...fromDetails(compatibility, 'compat', 3),
        ...fromParagraphs(compatibility, 'compat', '궁합 결론', 2, 1)
      ]
    },
    /* 다섯 칸 중 **계산으로 채운 두 칸**의 입력만 싣는다.
       `reunion-core` 카드 네 장은 `Report.tsx:6105-6124` 에 하드코딩된 고정 산문이라
       모든 독자에게 글자 단위로 같고, 조건 개수 계산(`readiness.ts`)이 읽지도 않는다.
       계산에 쓰이지 않은 문구를 '이 숫자를 센 근거'로 붙이면 허위 출처 표기가 된다. */
    'contact-readiness': {
      title: '조건 칸을 계산한 근거',
      note: '다섯 칸 중 계산으로 채운 두 칸의 근거예요. 나머지 세 칸은 {name}님이 알려주신 내용에서 셌어요.',
      entries: [
        ...fromCardsMatching(
          compatibility,
          'compatExpression',
          (title) => title.includes('표현') || title.includes('의사소통')
        ),
        /* 월운 층 = `month-window` 칸이 읽는 자료. 'other-door' 는 앞의 두 층을 쓴다. */
        ...fromDetails(temporal, 'temporalNow', 1, 2)
      ]
    },
    'twelve-months': {
      title: '월별 흐름의 근거',
      note: '{name}님 명식의 월별 흐름이에요. 상대의 행동을 예측한 값이 아니에요.',
      entries: fromDetails(reunionTimeline, 'rtl', 2)
    },
    'repeat-risk': {
      title: '되돌아오는 지점의 근거',
      note: '지난번과 이번을 가르는 조건을 이 자료에서 읽었어요.',
      entries: [
        ...fromDetails(compatibility, 'compatLate', 2, 3),
        ...fromDetails(expert, 'expertLate', 1, 2),
        ...fromParagraphs(expert, 'expertLate', '명식 판정 기준', 1, 2)
      ]
    },
    /* CH05 와 **같은 항목 수**로 맞춘다. 두 장은 시각적 대칭 쌍이고,
       분량 차이 자체가 한쪽을 권유하는 신호가 된다(§1). 컷 수·총 높이는 데이터 계층이
       이미 같게 고정했으므로, 화면이 근거 개수로 그 대칭을 깨면 안 된다. */
    'other-door': {
      title: '앞으로의 구간에 쓴 근거',
      note: '누가 나타나는 시점이 아니라 {name}님 쪽 여력이 바뀌는 지점이에요.',
      entries: fromDetails(temporal, 'temporalLate', 2, 0)
    },
    letter: {
      title: '집계에 쓴 근거',
      note: '이 장의 숫자는 예측이 아니라 앞 여섯 장의 집계예요.',
      entries: summaryEntries
    }
  } satisfies Record<ReunionChapterId, ReunionChapterEvidence>);
}

export const EMPTY_REUNION_CHAPTER_EVIDENCE = EMPTY;
