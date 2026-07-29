import type { IntakeFormData } from '../../api/mockData';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildSajuReport } from '../saju/reportBuilder';
import { buildReunionAnswerFirst } from './answers';
import { buildReunionEvidence, compatibilityValue } from './evidence';
import { evaluateReunionSafety } from './safetyGate';
import { buildReunionMetrics } from './scoring';
import {
  buildReunionChoices,
  buildReunionContactWindows,
  buildReunionMessageReview,
  buildReunionPlans,
  buildReunionReplyTree
} from './strategy';
import {
  REUNION_REPORT_VERSION,
  REUNION_RULE_VERSION,
  reunionMetricIds,
  type ReunionEvidenceNode,
  type ReunionIntakeData,
  type ReunionMetric,
  type ReunionMetricId,
  type ReunionPlanPhase,
  type ReunionReport
} from './types';

const unique = <T,>(values: T[]) => [...new Set(values)];

function daysBetween(from: string, to: string) {
  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);
  if (!from || !to || !Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;
  return Math.max(0, Math.floor((toTime - fromTime) / 86_400_000));
}

function auditReport(report: Omit<ReunionReport, 'audit'>): ReunionReport['audit'] {
  const text = JSON.stringify(report);
  const bannedPatterns = [
    /100\s*%\s*재회/iu,
    /무조건\s*재회/iu,
    /반드시\s*연락/iu,
    /상대는\s*당신을\s*사랑/iu,
    /정확한\s*연락\s*날짜/iu
  ];
  const bannedClaimHits = bannedPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);
  const evidenceIds = new Set(report.evidence.map((item) => item.id));
  const referencedIds = report.metrics.flatMap((metric) => [
    ...metric.evidenceIds,
    ...metric.counterEvidenceIds
  ]);
  const checks = [
    {
      id: 'safety-override',
      label: '안전 게이트 우선',
      passed: report.safety.timingAllowed || report.contactWindows.length === 0,
      detail: '안전 제한 시 연락 창이 비어 있어야 합니다.'
    },
    {
      id: 'metric-separation',
      label: '분리 지표',
      passed: report.metrics.length >= 13,
      detail: report.metrics.length + '개 지표를 독립 계산했습니다.'
    },
    {
      id: 'evidence-integrity',
      label: '근거 참조 무결성',
      passed: referencedIds.every((id) => evidenceIds.has(id)),
      detail: '모든 지표의 근거 ID가 EvidenceGraph에 존재해야 합니다.'
    },
    {
      id: 'counter-evidence',
      label: '반대 근거',
      passed: report.metrics.every(
        (metric) => metric.evidenceIds.length > 0 && metric.counterEvidenceIds.length > 0
      ),
      detail: '모든 지표는 근거와 반대 근거를 함께 가져야 합니다.'
    },
    {
      id: 'ziwei-boundary',
      label: '자미두수 검증 경계',
      passed: report.components.some(
        (item) =>
          item.id === 'ZIWEI' &&
          item.status === 'UNVERIFIED' &&
          !item.usedForScoring
      ),
      detail: '미검증 자미두수는 점수에서 제외되어야 합니다.'
    },
    {
      id: 'claim-safety',
      label: '단정 문구 차단',
      passed: bannedClaimHits.length === 0,
      detail: '재회·연락·상대 내면을 보장하는 문구가 없어야 합니다.'
    }
  ];
  return { passed: checks.every((check) => check.passed), checks, bannedClaimHits };
}

const BLOCKED_METRIC_LABELS: Record<ReunionMetricId, string> = {
  'emotional-residue': '관계 흔적 지수',
  'incoming-contact': '상대 선연락 신호 지수',
  'outgoing-suitability': '내 연락 적합 지수',
  reply: '답장 전환 지수',
  meeting: '만남 전환 지수',
  'relationship-redefinition': '관계 재정의 지수',
  reunion: '재회 지수',
  'sustainability-30': '재회 후 30일 유지 지수',
  'sustainability-90': '재회 후 90일 유지 지수',
  'long-term': '장기 지속 지수',
  'recurrence-risk': '같은 이유 재발 위험 지수',
  'contact-harm-risk': '연락 위해 위험 지수',
  'reality-obstacles': '현실 장벽 지수',
  readiness: '재회 준비도'
};

const BLOCKED_EVIDENCE: ReunionEvidenceNode[] = [
  {
    id: 'safety:gate',
    source: 'SAFETY',
    direction: 'OPPOSES',
    label: '안전 게이트',
    detail: '필수 동의가 없거나 중대한 안전 신호가 확인되어 명리·궁합 계산을 시작하지 않았습니다.',
    confidence: 1,
    verified: true
  },
  {
    id: 'system:observable-limit',
    source: 'SYSTEM_LIMIT',
    direction: 'NEUTRAL',
    label: '미계산 경계',
    detail: '안전 게이트가 해제되기 전에는 사주 구조, 궁합, 연락 시기와 재회 가능성을 해석하지 않습니다.',
    confidence: 1,
    verified: true
  }
];

function buildBlockedMetrics(): ReunionMetric[] {
  return reunionMetricIds.map((id) => ({
    id,
    label: BLOCKED_METRIC_LABELS[id],
    score: null,
    state: 'WITHHELD_SAFETY',
    band: 'withheld',
    summary: '안전 게이트가 우선되어 이 지표를 계산하지 않았습니다.',
    evidenceIds: ['safety:gate'],
    counterEvidenceIds: ['system:observable-limit'],
    realityChecks: [
      '이 상태에서는 명리 신호나 상대의 속마음을 해석하지 않습니다.',
      '안전과 동의 조건이 충족되기 전에는 접촉 판단을 보류합니다.'
    ],
    actions: ['안전 게이트의 즉시 행동을 따르세요.'],
    prohibitedActions: ['반복 연락, 차단 우회, 제3자를 통한 접촉을 하지 마세요.'],
    changeConditions: ['안전 게이트의 차단 사유가 해소되고 필요한 동의가 다시 확인되었을 때']
  }));
}

function buildBlockedSafetyPlan(
  immediateActions: string[],
  reasonCodes: string[]
): { plan30: ReunionPlanPhase[]; plan90: ReunionPlanPhase[] } {
  return {
    plan30: [
      {
        range: '지금',
        goal: '접촉보다 안전과 동의 확인',
        actions: immediateActions.length > 0
          ? immediateActions
          : ['추가 접촉을 멈추고 신뢰할 수 있는 지원 인물과 상황을 확인하세요.'],
        evidenceToObserve: reasonCodes.length > 0
          ? reasonCodes.map((code) => '차단 사유 확인: ' + code)
          : ['안전·동의 조건이 충족되었는지 확인'],
        stopRules: [
          '상대의 거절·차단을 우회하지 않기',
          '위협이나 즉각적인 위험이 있으면 지역 긴급기관에 도움 요청하기'
        ]
      }
    ],
    plan90: []
  };
}

function buildBlockedReport(
  input: ReunionIntakeData,
  generatedAt: Date,
  analysisDate: string,
  safety: ReunionReport['safety']
): ReunionReport {
  const metrics = buildBlockedMetrics();
  const { plan30, plan90 } = buildBlockedSafetyPlan(
    safety.immediateActions,
    safety.reasonCodes
  );
  const base: Omit<ReunionReport, 'audit'> = {
    version: REUNION_REPORT_VERSION,
    ruleVersion: REUNION_RULE_VERSION,
    generatedAt: generatedAt.toISOString(),
    analysisDate,
    customerName: input.name.trim() || '고객',
    partnerName: input.partner?.name?.trim() || '상대방',
    headline: safety.title,
    directVerdict: safety.summary,
    safety,
    answerFirst: [
      {
        question: '지금 무엇을 우선해야 하나요?',
        answer: safety.summary,
        confidence: 'high',
        evidenceIds: ['safety:gate'],
        counterEvidenceIds: ['system:observable-limit'],
        nextAction: safety.immediateActions[0] || '안전과 동의 조건을 먼저 확인하세요.'
      }
    ],
    metrics,
    choices: buildReunionChoices('ANALYSIS_BLOCKED'),
    contactWindows: [],
    messageReview: buildReunionMessageReview(input, false),
    replyTree: [],
    plan30,
    plan90,
    evidence: BLOCKED_EVIDENCE,
    components: [
      {
        id: 'MANSE',
        label: '절기 만세력·명리 규칙',
        status: 'UNVERIFIED',
        version: 'not-run-safety-gate',
        note: '안전 게이트 차단으로 계산하지 않았습니다.',
        usedForScoring: false
      },
      {
        id: 'ZIWEI',
        label: '자미두수',
        status: 'UNVERIFIED',
        version: 'not-implemented',
        note: '검증된 계산기가 없고 안전 게이트가 차단되어 사용하지 않았습니다.',
        usedForScoring: false
      },
      {
        id: 'RELATIONSHIP',
        label: '관계·이별 사실',
        status: 'USER_REPORTED',
        version: input.reunion.schemaVersion,
        note: '안전 판단에 필요한 사용자 입력만 확인했으며 관계 분석은 수행하지 않았습니다.',
        usedForScoring: false
      },
      {
        id: 'SAFETY',
        label: '연락 안전 정책',
        status: 'POLICY_ENFORCED',
        version: REUNION_RULE_VERSION,
        note: '안전·동의 조건이 다른 모든 계산보다 우선 적용되었습니다.',
        usedForScoring: true
      },
      {
        id: 'SCORING',
        label: 'EvidenceGraph 지표',
        status: 'UNVERIFIED',
        version: 'not-run-safety-gate',
        note: '모든 지표를 안전 사유로 보류했습니다.',
        usedForScoring: false
      }
    ],
    birthChart: {
      self: {
        pillars: { year: '미계산', month: '미계산', day: '미계산', hour: null },
        dayMaster: '미계산',
        element: '미계산',
        precision: 'not-calculated-safety-gate'
      },
      partner: {
        available: false,
        precision: 'not-calculated-safety-gate'
      },
      compatibilitySummary: '안전 게이트가 우선되어 두 사람의 궁합을 계산하지 않았습니다.'
    },
    confidence: {
      score: 0.2,
      label: '제한',
      reasons: ['안전 게이트에 따라 예측·명리·궁합 분석 전체를 보류했습니다.']
    },
    limitations: [
      '이 보고서는 안전과 동의 조건만 안내하며 재회 가능성, 상대 감정, 연락 시기를 분석하지 않습니다.',
      '즉각적인 위험이 있으면 대한민국 112·119 또는 현재 지역의 긴급기관에 연락하세요.'
    ]
  };
  return { ...base, audit: auditReport(base) };
}

export function buildReunionReport(
  input: ReunionIntakeData,
  generatedAt = new Date()
): ReunionReport {
  const analysisDate = generatedAt.toISOString().slice(0, 10);
  const normalized: ReunionIntakeData = {
    ...input,
    reunion: {
      ...input.reunion,
      analysisDate,
      facts: {
        ...input.reunion.facts,
        daysSinceBreakup: daysBetween(input.reunion.facts.breakupDate, analysisDate),
        daysSinceLastContact: daysBetween(
          input.reunion.facts.lastContactDate,
          analysisDate
        )
      }
    }
  };
  const safety = evaluateReunionSafety(normalized.reunion);
  if (safety.status === 'ANALYSIS_BLOCKED') {
    return buildBlockedReport(normalized, generatedAt, analysisDate, safety);
  }
  const basis = buildDeterministicSajuBasis('love-reunion', normalized);
  const selfReport = buildSajuReport('love-reunion', normalized);
  const partnerForm: Partial<IntakeFormData> | null =
    normalized.reunion.partnerBirthKnown && normalized.partner?.birthDate
      ? {
          ...normalized.partner,
          relationshipStatus: 'breakup-reunion',
          relationshipDuration: '',
          location: '',
          q1: normalized.q1,
          q2: normalized.q2
        }
      : null;
  const partnerReport = partnerForm
    ? buildSajuReport('love-reunion', partnerForm)
    : null;
  const compatibility = basis.commercialV2.compatibility;
  const evidence = buildReunionEvidence(normalized, basis);
  const metrics = buildReunionMetrics(
    normalized,
    evidence,
    safety.status,
    compatibilityValue(compatibility?.overview.tendency)
  );
  const contactWindows = buildReunionContactWindows(
    normalized,
    selfReport.monthLuck,
    partnerReport?.monthLuck || null,
    safety
  );
  const selectedQuestions = unique([
    ...normalized.reunion.selectedQuestions,
    'reunion-index',
    'recurrence-risk'
  ]).slice(0, 3);
  const answerFirst = buildReunionAnswerFirst(
    selectedQuestions,
    metrics,
    contactWindows,
    safety.status
  );
  const metricMap = new Map(metrics.map((metric) => [metric.id, metric]));
  const { plan30, plan90 } = buildReunionPlans(safety.status);
  const confidenceReasons: string[] = [];
  let confidence = normalized.reunion.partnerBirthKnown && partnerReport ? 0.72 : 0.52;

  if (normalized.isUnknownTime) {
    confidence -= 0.1;
    confidenceReasons.push('본인 출생시간 미상 시나리오로 시주 판단을 제한했습니다.');
  }
  if (normalized.partner?.isUnknownTime) {
    confidence -= 0.1;
    confidenceReasons.push('상대 출생시간 미상으로 상대 시주 판단을 제한했습니다.');
  }
  if (!normalized.reunion.partnerBirthKnown || !partnerReport) {
    confidence -= 0.12;
    confidenceReasons.push('상대 출생정보가 없어 정적 궁합과 동시 월운을 제외했습니다.');
  }
  if (
    normalized.reunion.selfBirthAccuracy === 'approximate' ||
    normalized.reunion.selfBirthAccuracy === 'unknown'
  ) {
    confidence -= 0.08;
    confidenceReasons.push('본인 출생정보 정확도가 낮게 입력되었습니다.');
  }
  if (
    normalized.reunion.partnerBirthAccuracy === 'approximate' ||
    normalized.reunion.partnerBirthAccuracy === 'unknown'
  ) {
    confidence -= 0.08;
    confidenceReasons.push('상대 출생정보 정확도가 낮게 입력되었습니다.');
  }
  if (normalized.reunion.requesterRole !== 'self') {
    confidence -= 0.08;
    confidenceReasons.push('대리 입력이라 관계 사실 신뢰도를 낮췄습니다.');
  }
  confidence = Math.min(0.79, Math.max(0.2, confidence));
  confidenceReasons.push('외부 명리 전문가 감수 전 내부 규칙·회귀 검증 버전입니다.');
  confidenceReasons.push('자미두수는 미구현 상태라 계산과 점수에서 제외했습니다.');

  const headline =
    safety.status === 'CONTACT_ELIGIBLE'
      ? '다시 만날 수 있느냐보다, 다시 만나도 달라질 수 있느냐를 먼저 봤어요.'
      : safety.title;
  const directVerdict =
    safety.status === 'CONTACT_ELIGIBLE'
      ? '재회 지수 ' + metricMap.get('reunion')?.score +
        '/100보다 재발 위험 지수 ' +
        metricMap.get('recurrence-risk')?.score +
        '/100을 먼저 확인해야 합니다.'
      : safety.summary;
  const base: Omit<ReunionReport, 'audit'> = {
    version: REUNION_REPORT_VERSION,
    ruleVersion: REUNION_RULE_VERSION,
    generatedAt: generatedAt.toISOString(),
    analysisDate,
    customerName: normalized.name.trim() || '고객',
    partnerName: normalized.partner?.name?.trim() || '그 사람',
    headline,
    directVerdict,
    safety,
    answerFirst,
    metrics,
    choices: buildReunionChoices(safety.status),
    contactWindows,
    messageReview: buildReunionMessageReview(
      normalized,
      safety.messageScriptAllowed
    ),
    replyTree: safety.messageScriptAllowed ? buildReunionReplyTree() : [],
    plan30,
    plan90,
    evidence,
    components: [
      {
        id: 'MANSE',
        label: '절기 만세력·명리 규칙',
        status: 'VERIFIED_INTERNAL',
        version: basis.commercialV2.engineVersion,
        note: basis.commercialV2.validationStatus,
        usedForScoring: true
      },
      {
        id: 'ZIWEI',
        label: '자미두수',
        status: 'UNVERIFIED',
        version: 'not-implemented',
        note: '검증 엔진과 골든 fixture가 없어 표시·점수·시기에서 제외했습니다.',
        usedForScoring: false
      },
      {
        id: 'RELATIONSHIP',
        label: '관계·이별 사실',
        status: 'USER_REPORTED',
        version: normalized.reunion.schemaVersion,
        note: '사용자가 입력한 사실이며 상대의 내면을 의미하지 않습니다.',
        usedForScoring: true
      },
      {
        id: 'SAFETY',
        label: '연락 안전 정책',
        status: 'POLICY_ENFORCED',
        version: REUNION_RULE_VERSION,
        note: '차단·거부·폭력·위협·통제 신호가 모든 명리 신호보다 우선합니다.',
        usedForScoring: true
      },
      {
        id: 'SCORING',
        label: 'EvidenceGraph 지표',
        status: 'VERIFIED_INTERNAL',
        version: REUNION_REPORT_VERSION,
        note: '지표는 의사결정 비교값이며 예측 확률이 아닙니다.',
        usedForScoring: true
      }
    ],
    birthChart: {
      self: {
        pillars: basis.pillars,
        dayMaster: basis.dayMaster.stem,
        element: basis.dayMaster.element,
        precision: basis.commercialV2.calendar.precision
      },
      partner: {
        available: Boolean(compatibility),
        precision: basis.commercialV2.partner?.calendar.precision || 'not-provided'
      },
      compatibilitySummary:
        compatibility?.overview.statement ||
        '상대 출생정보가 없어 두 사람 정적 궁합은 계산하지 않았습니다.'
    },
    confidence: {
      score: Number(confidence.toFixed(2)),
      label: confidence >= 0.7 ? '높음' : confidence >= 0.5 ? '중간' : '제한',
      reasons: confidenceReasons
    },
    limitations: [
      '재회, 연락, 상대의 감정 또는 특정 날짜의 결과를 보장하지 않습니다.',
      '명리 지표보다 상대의 직접적인 말, 경계, 반복 행동과 안전이 우선합니다.',
      '현재 궁합 엔진은 정적 원국 관계이며 대운·세운 동시성의 완전한 교차 엔진은 아닙니다.',
      '월운 창은 절기 단위의 넓은 구간이며 일진 추천 엔진이 없어 특정 날짜를 제시하지 않습니다.',
      '자미두수와 실제 인간 전문가 검수 워크플로는 아직 구현되지 않았습니다.'
    ]
  };
  return { ...base, audit: auditReport(base) };
}

export function findReunionMetric(report: ReunionReport, id: ReunionMetricId) {
  return report.metrics.find((metric) => metric.id === id);
}
