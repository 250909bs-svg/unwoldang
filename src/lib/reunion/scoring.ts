import type {
  ReunionEvidenceNode,
  ReunionIntakeData,
  ReunionMetric,
  ReunionMetricId,
  SafetyGateStatus
} from './types';

const LABELS: Record<ReunionMetricId, string> = {
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

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));
const unique = <T,>(values: T[]) => [...new Set(values)];
function weightedAverage(parts: Array<{ value: number | null; weight: number }>) {
  const available = parts.filter(
    (part): part is { value: number; weight: number } => part.value !== null
  );
  const totalWeight = available.reduce((sum, part) => sum + part.weight, 0);
  return totalWeight === 0
    ? 0
    : available.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight;
}

function daysBetween(from: string, to: string) {
  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);
  if (!from || !to || !Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;
  return Math.max(0, Math.floor((toTime - fromTime) / 86_400_000));
}

export function calculateReunionReadiness(input: ReunionIntakeData) {
  const value = input.reunion.readiness;
  return clamp(
    10 +
      Number(value.accountabilityTaken) * 20 +
      Number(value.breakupCauseChanged) * 25 +
      Number(value.canAcceptNoReply) * 20 +
      Number(value.canRespectBoundary) * 20 +
      Number(value.supportAvailable) * 5
  );
}

export function calculateRealityObstacles(input: ReunionIntakeData) {
  const facts = input.reunion.facts;
  const count = [
    facts.familyObstacle,
    facts.workObstacle,
    facts.moneyObstacle,
    facts.trustObstacle,
    facts.valuesObstacle,
    facts.marriageObstacle,
    facts.childrenObstacle
  ].filter(Boolean).length;
  const distance =
    facts.distance === 'overseas' ? 22 : facts.distance === 'domestic-distance' ? 12 : 0;
  const newRelationship =
    facts.newRelationship === 'partner' || facts.newRelationship === 'both' ? 35 : 0;
  return clamp(8 + count * 9 + distance + newRelationship);
}

export function calculateRecurrenceRisk(input: ReunionIntakeData) {
  const facts = input.reunion.facts;
  const highImpact = facts.breakupReasons.filter((reason) =>
    ['trust', 'infidelity', 'values', 'marriage', 'children'].includes(reason)
  ).length;
  return clamp(
    18 +
      Number(facts.repeatedCause) * 25 +
      Math.min(facts.pastReunionCount, 3) * 9 +
      highImpact * 8 +
      Number(!input.reunion.readiness.breakupCauseChanged) * 18
  );
}

function band(score: number | null): ReunionMetric['band'] {
  if (score === null) return 'withheld';
  if (score < 25) return 'very-low';
  if (score < 40) return 'low';
  if (score < 50) return 'guarded';
  if (score < 65) return 'balanced';
  if (score < 80) return 'high';
  return 'very-high';
}

function summary(id: ReunionMetricId, score: number) {
  const high = score >= 65;
  const low = score < 45;
  if (id === 'recurrence-risk') {
    return high
      ? '같은 이별 원인이 다시 작동할 위험이 높습니다.'
      : low
        ? '입력된 사실상 같은 원인이 반복될 위험은 비교적 낮습니다.'
        : '재발 요인이 일부 남아 있어 변화의 증거를 확인해야 합니다.';
  }
  if (id === 'contact-harm-risk') {
    return high
      ? '연락이 상대 경계 또는 본인의 회복을 해칠 위험이 큽니다.'
      : low
        ? '현재 확인된 연락 위해 신호는 낮지만 경계는 계속 우선합니다.'
        : '연락 목적과 빈도를 통제하지 않으면 위해가 커질 수 있습니다.';
  }
  if (id === 'reality-obstacles') {
    return high
      ? '거리·신뢰·가족·일 등 현실 장벽이 여러 겹입니다.'
      : low
        ? '입력된 사실상 큰 현실 장벽은 많지 않습니다.'
        : '한두 가지 현실 장벽을 해결해야 판단이 선명해집니다.';
  }
  if (id === 'readiness') {
    return high
      ? '거절을 수용하고 경계를 지킬 준비가 비교적 갖춰져 있습니다.'
      : low
        ? '재회보다 감정 안정과 책임 정리가 먼저입니다.'
        : '마음은 준비됐지만 행동 규칙을 더 정리해야 합니다.';
  }
  if (id === 'emotional-residue') {
    return high
      ? '관계 기간과 접촉 기록에 남은 흔적이 큰 편입니다.'
      : low
        ? '현재 기록만으로 관계의 흔적이 이어진다고 보기 어렵습니다.'
        : '흔적은 남아 있지만 현재 행동 단서가 엇갈립니다.';
  }
  if (id === 'incoming-contact') {
    return high
      ? '최근 연락 패턴에는 상대가 먼저 움직일 수 있는 행동 단서가 있습니다.'
      : low
        ? '현재 기록은 상대의 선연락을 기대할 근거가 약합니다.'
        : '선연락 여부를 가를 행동 단서가 충분하지 않습니다.';
  }
  if (id === 'outgoing-suitability') {
    return high
      ? '경계를 지키면 한 번의 짧은 연락을 검토할 수 있습니다.'
      : low
        ? '지금 연락하면 같은 갈등을 되살릴 위험이 더 큽니다.'
        : '연락 전에 목적과 멈춤 조건을 더 분명히 해야 합니다.';
  }
  if (id === 'reply') {
    return high
      ? '최근 행동 단서는 짧은 대화가 열릴 여지를 남깁니다.'
      : low
        ? '현재 행동 단서만 보면 답장을 기대한 연락은 권하지 않습니다.'
        : '답장 여부보다 메시지의 부담을 줄이는 것이 먼저입니다.';
  }
  if (id === 'meeting') {
    return high
      ? '대화가 회복될 경우 짧은 만남을 제안할 기반이 있습니다.'
      : low
        ? '지금은 만남을 제안할 현실 기반이 부족합니다.'
        : '만남보다 두세 번의 안정적인 대화가 먼저입니다.';
  }
  if (id === 'relationship-redefinition') {
    return high
      ? '예전 관계 복원이 아니라 새 규칙을 합의할 여지가 있습니다.'
      : low
        ? '현재 조건으로는 과거 관계가 반복될 위험이 큽니다.'
        : '재회 의지보다 관계 규칙을 바꿀 증거가 더 필요합니다.';
  }
  if (id === 'reunion') {
    return high
      ? '명리 구조와 실제 행동상 재회를 검토할 조건이 비교적 갖춰져 있습니다.'
      : low
        ? '현재는 재회 성사보다 경계와 이별 원인 해결이 먼저입니다.'
        : '이어질 단서와 멈춰야 할 단서가 함께 있습니다.';
  }
  if (id === 'sustainability-30') {
    return high
      ? '초기 30일을 버틸 기본 합의와 준비가 비교적 갖춰져 있습니다.'
      : low
        ? '재회해도 첫 30일 안에 같은 문제가 재점화될 위험이 큽니다.'
        : '재회 직후 갈등 규칙을 먼저 정해야 합니다.';
  }
  if (id === 'sustainability-90') {
    return high
      ? '90일 동안 변화를 행동으로 확인할 기반이 있습니다.'
      : low
        ? '장기 변화의 증거가 없어 90일 유지 판단은 보수적입니다.'
        : '감정만으로 90일을 넘기기 어려워 점검 기준이 필요합니다.';
  }
  return high
    ? '관계 구조와 현실 조건에 장기 조율의 자원이 있습니다.'
    : low
      ? '현재 현실 장벽과 반복 원인이 장기 지속에 큰 부담입니다.'
      : '장기 지속은 생활·신뢰 조건 합의에 달려 있습니다.';
}

export function buildReunionMetrics(
  input: ReunionIntakeData,
  evidence: ReunionEvidenceNode[],
  safetyStatus: SafetyGateStatus,
  compatibilityScore: number
): ReunionMetric[] {
  const facts = input.reunion.facts;
  const compatibility = evidence.some(
    (item) => item.id === 'saju:compatibility-overview' && item.verified
  ) ? compatibilityScore : null;
  const ready = calculateReunionReadiness(input);
  const recurrence = calculateRecurrenceRisk(input);
  const obstacles = calculateRealityObstacles(input);
  const mood =
    facts.lastContactMood === 'warm'
      ? 16
      : facts.lastContactMood === 'neutral'
        ? 5
        : facts.lastContactMood === 'cold'
          ? -13
          : facts.lastContactMood === 'conflict'
            ? -22
            : -3;
  const frequency =
    facts.contactFrequency === 'weekly'
      ? 12
      : facts.contactFrequency === 'frequent'
        ? 8
        : facts.contactFrequency === 'rare'
          ? 1
          : -12;
  const contactDays =
    facts.daysSinceLastContact ??
    daysBetween(facts.lastContactDate, input.reunion.analysisDate);
  const recency =
    contactDays === null
      ? -3
      : contactDays < 7
        ? facts.lastContactMood === 'conflict' ? -12 : 8
        : contactDays <= 60
          ? 7
          : contactDays > 180 ? -8 : 0;
  const relationshipMonths =
    facts.relationshipLengthMonths ??
    (facts.relationshipStartDate && facts.breakupDate
      ? Math.max(
          1,
          Math.round(
            (daysBetween(facts.relationshipStartDate, facts.breakupDate) || 0) / 30.44
          )
        )
      : 0);
  const residue = clamp(
    35 + Math.min(relationshipMonths, 48) * 0.6 + frequency + mood * 0.45
  );
  const incoming = clamp(44 + frequency + mood + recency - obstacles * 0.18);
  const outgoing = clamp(
    ready * 0.55 + (100 - recurrence) * 0.22 +
      (100 - obstacles) * 0.15 + mood * 0.35
  );
  const reply = clamp(weightedAverage([
    { value: incoming, weight: 0.44 },
    { value: outgoing, weight: 0.32 },
    { value: compatibility, weight: 0.24 }
  ]));
  const meeting = clamp(weightedAverage([
    { value: reply, weight: 0.52 },
    { value: compatibility, weight: 0.25 },
    { value: 100 - obstacles, weight: 0.23 }
  ]));
  const redefine = clamp(weightedAverage([
    { value: ready, weight: 0.35 },
    { value: compatibility, weight: 0.3 },
    { value: 100 - recurrence, weight: 0.35 }
  ]));
  const reunion = clamp(weightedAverage([
    { value: reply, weight: 0.22 },
    { value: meeting, weight: 0.22 },
    { value: redefine, weight: 0.3 },
    { value: compatibility, weight: 0.26 }
  ]));
  const sustain30 = clamp(
    reunion * 0.25 + ready * 0.35 + (100 - recurrence) * 0.25 + (100 - obstacles) * 0.15
  );
  const sustain90 = clamp(weightedAverage([
    { value: sustain30, weight: 0.42 },
    { value: compatibility, weight: 0.2 },
    { value: 100 - recurrence, weight: 0.38 }
  ]));
  const longTerm = clamp(weightedAverage([
    { value: sustain90, weight: 0.38 },
    { value: compatibility, weight: 0.28 },
    { value: 100 - obstacles, weight: 0.18 },
    { value: ready, weight: 0.16 }
  ]));
  const calculatedHarm = clamp(
    15 +
      Number(facts.lastContactMood === 'conflict') * 25 +
      Number((contactDays ?? 99) < 7) * 12 +
      Number(facts.newRelationship === 'partner' || facts.newRelationship === 'both') * 35 +
      (100 - ready) * 0.22
  );
  const harm = safetyStatus === 'CONTACT_PROHIBITED' ? 100 : calculatedHarm;
  const scores: Record<ReunionMetricId, number> = {
    'emotional-residue': residue,
    'incoming-contact': incoming,
    'outgoing-suitability': outgoing,
    reply,
    meeting,
    'relationship-redefinition': redefine,
    reunion,
    'sustainability-30': sustain30,
    'sustainability-90': sustain90,
    'long-term': longTerm,
    'recurrence-risk': recurrence,
    'contact-harm-risk': harm,
    'reality-obstacles': obstacles,
    readiness: ready
  };
  const relevantEvidenceIds: Record<ReunionMetricId, string[]> = {
    'emotional-residue': ['relationship:reported-facts', 'behavior:last-contact'],
    'incoming-contact': ['relationship:reported-facts', 'behavior:last-contact', 'relationship:obstacles'],
    'outgoing-suitability': ['behavior:readiness', 'relationship:recurrence', 'relationship:obstacles', 'behavior:last-contact'],
    reply: ['behavior:last-contact', 'behavior:readiness', 'relationship:obstacles', 'saju:dating-communication'],
    meeting: ['behavior:last-contact', 'relationship:obstacles', 'saju:dating-attraction'],
    'relationship-redefinition': ['behavior:readiness', 'relationship:recurrence', 'saju:dating-communication', 'saju:dating-continuity'],
    reunion: ['behavior:readiness', 'relationship:recurrence', 'relationship:obstacles', 'saju:compatibility-overview', 'saju:dating-continuity'],
    'sustainability-30': ['behavior:readiness', 'relationship:recurrence', 'relationship:obstacles'],
    'sustainability-90': ['behavior:readiness', 'relationship:recurrence', 'relationship:obstacles', 'saju:dating-continuity'],
    'long-term': ['behavior:readiness', 'relationship:recurrence', 'relationship:obstacles', 'saju:compatibility-overview', 'saju:dating-continuity'],
    'recurrence-risk': ['relationship:reported-facts', 'relationship:recurrence', 'behavior:readiness'],
    'contact-harm-risk': ['safety:gate', 'relationship:reported-facts', 'behavior:last-contact', 'behavior:readiness'],
    'reality-obstacles': ['relationship:reported-facts', 'relationship:obstacles'],
    readiness: ['behavior:readiness']
  };
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const relationshipOutcomeIds: ReunionMetricId[] = [
    'emotional-residue',
    'incoming-contact',
    'outgoing-suitability',
    'reply',
    'meeting',
    'relationship-redefinition',
    'reunion',
    'sustainability-30',
    'sustainability-90',
    'long-term'
  ];
  const contactOutcomeIds: ReunionMetricId[] = [
    'incoming-contact',
    'outgoing-suitability',
    'reply',
    'meeting'
  ];
  const withheld: ReunionMetricId[] =
    safetyStatus === 'ANALYSIS_BLOCKED'
      ? Object.keys(scores) as ReunionMetricId[]
      : safetyStatus === 'CONTACT_PROHIBITED'
        ? relationshipOutcomeIds
        : safetyStatus === 'PREPARATION_REQUIRED'
          ? contactOutcomeIds
          : [];

  return (Object.keys(scores) as ReunionMetricId[]).map((id) => {
    const isWithheld = withheld.includes(id);
    const isRisk =
      id === 'recurrence-risk' || id === 'contact-harm-risk' || id === 'reality-obstacles';
    const score = isWithheld ? null : scores[id];
    const relatedEvidence = relevantEvidenceIds[id]
      .map((evidenceId) => evidenceById.get(evidenceId))
      .filter((item): item is ReunionEvidenceNode => Boolean(item));
    const primaryEvidence = relatedEvidence.filter((item) =>
      item.direction === 'NEUTRAL' ||
      (isRisk ? item.direction === 'OPPOSES' : item.direction === 'SUPPORTS')
    );
    const counterEvidence = relatedEvidence.filter((item) =>
      isRisk ? item.direction === 'SUPPORTS' : item.direction === 'OPPOSES'
    );
    return {
      id,
      label: LABELS[id],
      score,
      state: isWithheld ? 'WITHHELD_SAFETY' : 'AVAILABLE',
      band: band(score),
      summary: isWithheld
        ? '안전 게이트가 우선되어 이 지표와 관련 행동 제안을 제공하지 않습니다.'
        : summary(id, scores[id]),
      evidenceIds: unique(
        (primaryEvidence.length ? primaryEvidence : relatedEvidence).map((item) => item.id)
      ),
      counterEvidenceIds: unique([
        ...counterEvidence.map((item) => item.id),
        'system:observable-limit',
        ...(compatibility === null &&
        relevantEvidenceIds[id].some((evidenceId) => evidenceId.startsWith('saju:')) &&
        evidenceById.has('saju:partner-missing')
          ? ['saju:partner-missing']
          : [])
      ]),
      realityChecks: [
        '이 수치는 실제 성사율이 아니라 입력 사실과 내부 규칙을 비교하는 의사결정 지수입니다.',
        '상대의 직접 표현과 반복 행동이 명리 해석보다 우선합니다.'
      ],
      actions: isWithheld
        ? ['접촉을 멈추고 안전 게이트의 즉시 행동을 따르세요.']
        : id === 'recurrence-risk'
          ? ['이별 원인 한 가지를 30일 동안 확인 가능한 행동으로 바꾸세요.']
          : ['다음 판단 전 상대의 말보다 반복 행동 한 가지를 기록하세요.'],
      prohibitedActions: [
        '답을 얻기 위해 반복 연락하거나 차단을 우회하지 않기',
        '이 지수를 상대 속마음 또는 재회 보장으로 해석하지 않기'
      ],
      changeConditions: [
        '상대가 자발적으로 대화를 다시 열었을 때',
        '이별 원인을 바꾼 행동이 최소 30일 유지되었을 때'
      ]
    };
  });
}
