import type { ReportSection, SajuReportData } from '../report';
import { scoreReportQuality } from '../reportQuality';

export const COMMERCIAL_REPORT_GUARD_VERSION = '2.1.0';

export interface ReportEvidenceReference {
  raw: string;
  ids: string[];
}

function evidenceReferencePattern() {
  return /\[근거:([^\]\r\n]*)\]/g;
}

/**
 * Parses the only evidence citation syntax accepted in generated report copy.
 * Keeping this parser beside the immutable-fact guard prevents prompt and
 * runtime validation from drifting to different citation formats.
 */
export function parseReportEvidenceReferences(value: string): ReportEvidenceReference[] {
  return [...value.matchAll(evidenceReferencePattern())].map((match) => ({
    raw: match[0],
    ids: match[1]
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  }));
}

/**
 * 인용 형식이 깨졌는가.
 *
 * `'[근거:'` 만 보던 것을 **남은 대괄호 전체**로 넓혔다. 이전에는 짝이 안 맞는 닫는
 * 괄호(`'…입니다 근거:ID]'` · `'[근거:ID'` 뒤 여는 괄호만 남은 형태)가 검사를 통과해
 * 고객 문장에 그대로 남았다. 정상 인용은 정규식이 전부 제거하므로,
 * 제거 후 대괄호가 남아 있다는 것은 형식이 깨졌다는 뜻이다.
 */
export function hasMalformedReportEvidenceReference(value: string) {
  const rest = value.replace(evidenceReferencePattern(), '');
  return rest.includes('[근거:') || rest.includes('[') || rest.includes(']');
}

export function stripReportEvidenceReferences(value: string) {
  return value.replace(evidenceReferencePattern(), '').trim();
}

const ENGINE_SECTION_IDS = new Set([
  'calculation-audit-v2',
  'expert-evidence-v2',
  'temporal-evidence-v2',
  'compatibility-evidence-v2'
]);

export interface ReportFactViolation {
  path: string;
  expected: unknown;
  received: unknown;
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pushViolation(
  violations: ReportFactViolation[],
  path: string,
  expected: unknown,
  received: unknown
) {
  if (!sameValue(expected, received)) {
    violations.push({ path, expected, received });
  }
}

/**
 * Detects attempts to mutate chart facts that are owned by the deterministic
 * engine. Text generators may rewrite interpretation copy, but these fields
 * must remain reproducible for the same engine version and input.
 */
export function findImmutableReportFactViolations(
  base: SajuReportData,
  candidate: SajuReportData
): ReportFactViolation[] {
  const violations: ReportFactViolation[] = [];
  const immutableTopLevel = [
    'serviceId',
    'kind',
    'title',
    'subtitle',
    'badge',
    'serialNumber',
    'createdAt',
    'birthLabel',
    'questionPreview',
    'customerName',
    'zodiac',
    'dayMaster',
    'dayMasterElement',
    'strengthLabel',
    'helpfulElements',
    'cautiousElements',
    'gyeokguk',
    'pillars',
    'fiveElements',
    'tenGods',
    'visibleTenGods',
    'tenGodBasisNote',
    'metaGrid',
    'legalNotice',
    'engineMeta'
  ] as const;

  immutableTopLevel.forEach((key) => {
    pushViolation(violations, key, base[key], candidate[key]);
  });

  pushViolation(violations, 'currentDayun.name', base.currentDayun.name, candidate.currentDayun.name);
  pushViolation(violations, 'currentDayun.range', base.currentDayun.range, candidate.currentDayun.range);
  pushViolation(violations, 'nextDayun.name', base.nextDayun.name, candidate.nextDayun.name);
  pushViolation(violations, 'nextDayun.range', base.nextDayun.range, candidate.nextDayun.range);

  base.yearLuck.forEach((item, index) => {
    const received = candidate.yearLuck[index];
    pushViolation(violations, `yearLuck.${index}.year`, item.year, received?.year);
    pushViolation(violations, `yearLuck.${index}.ganzhi`, item.ganzhi, received?.ganzhi);
    pushViolation(violations, `yearLuck.${index}.score`, item.score, received?.score);
  });

  base.monthLuck.forEach((item, index) => {
    const received = candidate.monthLuck[index];
    pushViolation(violations, `monthLuck.${index}.year`, item.year, received?.year);
    pushViolation(violations, `monthLuck.${index}.month`, item.month, received?.month);
    pushViolation(violations, `monthLuck.${index}.ganzhi`, item.ganzhi, received?.ganzhi);
    pushViolation(violations, `monthLuck.${index}.score`, item.score, received?.score);
  });

  base.questionAnswers.forEach((item, index) => {
    const received = candidate.questionAnswers.find((entry) => entry.question === item.question);
    pushViolation(
      violations,
      `questionAnswers.${index}.question`,
      item.question,
      received?.question
    );
  });

  base.sections.forEach((section, index) => {
    const received = candidate.sections.find((entry) => entry.id === section.id);
    pushViolation(violations, `sections.${index}.id`, section.id, received?.id);
    pushViolation(violations, `sections.${index}.table`, section.table, received?.table);
    if (ENGINE_SECTION_IDS.has(section.id)) {
      pushViolation(violations, `sections.${index}.engineEvidence`, section, received);
    }
  });

  pushViolation(
    violations,
    'actionPlan.luckyDays.day',
    base.actionPlan.luckyDays.map((item) => item.day),
    candidate.actionPlan.luckyDays.map((item) => item.day)
  );
  pushViolation(
    violations,
    'actionPlan.unluckyDays.day',
    base.actionPlan.unluckyDays.map((item) => item.day),
    candidate.actionPlan.unluckyDays.map((item) => item.day)
  );

  return violations;
}

function lockSections(base: ReportSection[], candidate: ReportSection[]) {
  return base.map((baseSection) => {
    const generated = candidate.find((section) => section.id === baseSection.id);

    if (!generated) {
      return baseSection;
    }

    if (ENGINE_SECTION_IDS.has(baseSection.id)) {
      return baseSection;
    }

    return {
      ...generated,
      id: baseSection.id,
      title: baseSection.title,
      subtitle: baseSection.subtitle,
      table: baseSection.table
    };
  });
}

function lockActionDays(
  baseDays: SajuReportData['actionPlan']['luckyDays'],
  generatedDays: SajuReportData['actionPlan']['luckyDays']
) {
  return baseDays.map((baseDay) => ({
    day: baseDay.day,
    reason: generatedDays.find((item) => item.day === baseDay.day)?.reason?.trim() || baseDay.reason
  }));
}

/**
 * Restores all immutable calculation facts after an AI or product-specific
 * text transformation and recalculates the quality audit on the final copy.
 */
export function lockCommercialReportFacts(
  base: SajuReportData,
  candidate: SajuReportData
): SajuReportData {
  const guarded: SajuReportData = {
    ...candidate,
    serviceId: base.serviceId,
    kind: base.kind,
    title: base.title,
    subtitle: base.subtitle,
    badge: base.badge,
    serialNumber: base.serialNumber,
    createdAt: base.createdAt,
    birthLabel: base.birthLabel,
    questionPreview: base.questionPreview,
    customerName: base.customerName,
    zodiac: base.zodiac,
    dayMaster: base.dayMaster,
    dayMasterElement: base.dayMasterElement,
    strengthLabel: base.strengthLabel,
    helpfulElements: [...base.helpfulElements],
    cautiousElements: [...base.cautiousElements],
    gyeokguk: base.gyeokguk,
    pillars: { ...base.pillars },
    fiveElements: base.fiveElements.map((item) => ({ ...item })),
    tenGods: base.tenGods.map((item) => ({ ...item })),
    visibleTenGods: base.visibleTenGods.map((item) => ({ ...item })),
    tenGodBasisNote: base.tenGodBasisNote,
    metaGrid: base.metaGrid.map((item) => ({ ...item })),
    legalNotice: [...base.legalNotice],
    /*
     * 재회운 컷 페이로드는 판정·집계·날짜·컷 구조를 전부 담고 있어 **무조건 base 로 복원한다**
     * (명세 §5). 컷 대사만 lock 이후에 `reviewReunionCopy` 가 컷 단위로 검증해 덮어쓴다.
     * 여기서 복원하지 않으면 병합 draft 가 게이트 판정이나 조건 개수를 바꿀 수 있다.
     */
    reunion: base.reunion,
    /*
     * 재회운 heroNote 는 **리포트 최상단의 유일한 경계 선언**이므로 base 로 복원한다.
     *
     * `applyLoveReunionSafetyContract` 가 고정하는 문장인데 이 목록에 없어서
     * (`legalNotice` 는 있었다) `mergeGeminiDraft` 의 `draft.heroNote || base.heroNote` 가
     * 모델 값으로 덮고 화면(`Report.tsx` 의 `{report.heroNote}`)까지 그대로 갔다.
     * `geminiProseGuard.isPermanentlyLockedProse` 가 1차로 막고 여기가 2차다 —
     * 산문 가드를 우회하는 경로가 생겨도 이 줄이 남는다.
     * 다른 상품의 heroNote 는 모델이 쓸 수 있으므로 그대로 통과시킨다.
     */
    heroNote: base.serviceId === 'love-reunion' ? base.heroNote : candidate.heroNote,
    engineMeta: base.engineMeta
      ? {
          ...base.engineMeta,
          trueSolarTime: { ...base.engineMeta.trueSolarTime },
          evidenceCoverage: { ...base.engineMeta.evidenceCoverage },
          releaseBlockers: [...base.engineMeta.releaseBlockers],
          reviewFlags: [...base.engineMeta.reviewFlags],
          uncertainty: [...base.engineMeta.uncertainty]
        }
      : undefined,
    currentDayun: {
      ...candidate.currentDayun,
      name: base.currentDayun.name,
      range: base.currentDayun.range
    },
    nextDayun: {
      ...candidate.nextDayun,
      name: base.nextDayun.name,
      range: base.nextDayun.range
    },
    yearLuck: base.yearLuck.map((baseItem) => ({
      ...(candidate.yearLuck.find((item) => item.year === baseItem.year) || baseItem),
      year: baseItem.year,
      ganzhi: baseItem.ganzhi,
      score: baseItem.score
    })),
    monthLuck: base.monthLuck.map((baseItem) => ({
      ...(candidate.monthLuck.find((item) => item.year === baseItem.year && item.month === baseItem.month) ||
        baseItem),
      year: baseItem.year,
      month: baseItem.month,
      ganzhi: baseItem.ganzhi,
      score: baseItem.score
    })),
    questionAnswers: base.questionAnswers.map((baseItem) => ({
      ...(candidate.questionAnswers.find((item) => item.question === baseItem.question) ||
        baseItem),
      question: baseItem.question
    })),
    sections: lockSections(base.sections, candidate.sections),
    actionPlan: {
      ...candidate.actionPlan,
      luckyDays: lockActionDays(base.actionPlan.luckyDays, candidate.actionPlan.luckyDays),
      unluckyDays: lockActionDays(base.actionPlan.unluckyDays, candidate.actionPlan.unluckyDays)
    },
    qualityAudit: base.qualityAudit
  };

  return {
    ...guarded,
    qualityAudit: scoreReportQuality(guarded)
  };
}
