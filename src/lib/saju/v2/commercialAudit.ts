import type { KasiCalendarVerification } from '../../server/kasiCalendarService';

export const COMMERCIAL_RELEASE_AUDIT_VERSION = 'commercial-release-audit-v1.0.0' as const;

export type CommercialReleaseDecision =
  | 'eligible'
  | 'manual-review-required'
  | 'blocked';

export type ExternalCalendarStatus =
  | 'matched'
  | 'mismatched'
  | 'verified-date-only'
  | 'not-comparable-policy'
  | 'not-configured'
  | 'failed';

export interface CommercialReleaseAuditInput {
  serviceId: string;
  engineVersion: string;
  calendarVersion: string;
  interpretationVersion: string;
  birthDate: string;
  birthTime: string | null;
  calendar: 'solar' | 'lunar';
  timezoneId: string;
  utcOffsetMinutes: number;
  dayBoundaryPolicy: string;
  precision: 'exact-minute' | 'legacy-range' | 'unknown';
  stableSelection: 'primary' | 'range-midpoint' | 'stable-without-hour' | 'unstable-day';
  scenarioPillars: unknown[];
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string | null;
  };
  trueSolarTime: {
    requested: boolean;
    applied: boolean;
  };
  externalDayComparable: boolean;
  calendarVerification?: KasiCalendarVerification;
  interpretationResolved: boolean;
  helpfulElementSource: 'expert-consensus' | 'legacy-fallback';
  evidenceCount: number;
}

export interface ExternalCalendarAudit {
  provider: 'KASI';
  status: ExternalCalendarStatus;
  internalDayGanzhi: string;
  providerDayGanzhi: string | null;
  message: string;
}

export interface CommercialReleaseAudit {
  version: typeof COMMERCIAL_RELEASE_AUDIT_VERSION;
  decision: CommercialReleaseDecision;
  reproducibilityFingerprint: string;
  evidenceCoverage: {
    score: number;
    passed: number;
    total: number;
  };
  externalCalendar: ExternalCalendarAudit;
  blockers: string[];
  reviewFlags: string[];
  infoFlags: string[];
  passedChecks: string[];
  claimPolicy: 'reproducible-calculation-not-predictive-accuracy';
}

const STEM_HANJA: Record<string, string> = {
  갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊',
  기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸'
};

const BRANCH_HANJA: Record<string, string> = {
  자: '子', 축: '丑', 인: '寅', 묘: '卯', 진: '辰', 사: '巳',
  오: '午', 미: '未', 신: '申', 유: '酉', 술: '戌', 해: '亥'
};

function toHanjaGanzhi(ganzhi: string) {
  const [stem, branch] = Array.from(ganzhi);
  return `${STEM_HANJA[stem] || stem}${BRANCH_HANJA[branch] || branch}`;
}

function auditExternalCalendar(input: CommercialReleaseAuditInput): ExternalCalendarAudit {
  const verification = input.calendarVerification;
  const internalDayGanzhi = input.pillars.day;
  const providerDayGanzhi = verification?.lunar?.dayGanji?.trim() || null;

  if (!verification || verification.status === 'disabled') {
    return {
      provider: 'KASI',
      status: 'not-configured',
      internalDayGanzhi,
      providerDayGanzhi,
      message: '외부 한국 역법 교차 검증이 구성되지 않았습니다.'
    };
  }

  if (verification.status === 'failed') {
    return {
      provider: 'KASI',
      status: 'failed',
      internalDayGanzhi,
      providerDayGanzhi,
      message: verification.message || 'KASI 교차 검증에 실패했습니다.'
    };
  }

  if (!input.externalDayComparable) {
    return {
      provider: 'KASI',
      status: 'not-comparable-policy',
      internalDayGanzhi,
      providerDayGanzhi,
      message: '진태양시 또는 자시 경계 정책으로 유효 일자가 이동해 민간력 일진과 직접 비교하지 않았습니다.'
    };
  }

  if (!providerDayGanzhi) {
    return {
      provider: 'KASI',
      status: 'verified-date-only',
      internalDayGanzhi,
      providerDayGanzhi: null,
      message: '양력·음력 날짜는 검증됐지만 제공자 응답에 일진이 없어 일주 대조는 생략했습니다.'
    };
  }

  const hanja = toHanjaGanzhi(internalDayGanzhi);
  const matched = providerDayGanzhi.includes(internalDayGanzhi) || providerDayGanzhi.includes(hanja);
  return {
    provider: 'KASI',
    status: matched ? 'matched' : 'mismatched',
    internalDayGanzhi,
    providerDayGanzhi,
    message: matched
      ? '내부 일주와 KASI 일진이 일치합니다.'
      : `내부 일주(${internalDayGanzhi}/${hanja})와 KASI 일진(${providerDayGanzhi})이 일치하지 않습니다.`
  };
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
    .join(',')}}`;
}

function fnv1a(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function fingerprint(input: CommercialReleaseAuditInput) {
  const payload = canonicalize({
    serviceId: input.serviceId,
    versions: [input.engineVersion, input.calendarVersion, input.interpretationVersion],
    birth: {
      date: input.birthDate,
      time: input.birthTime,
      calendar: input.calendar,
      timezoneId: input.timezoneId,
      utcOffsetMinutes: input.utcOffsetMinutes
    },
    policy: {
      dayBoundaryPolicy: input.dayBoundaryPolicy,
      precision: input.precision,
      trueSolarTime: input.trueSolarTime
    },
    pillars: input.pillars,
    scenarios: input.scenarioPillars
  });

  return `uw-${fnv1a(payload, 0x811c9dc5)}${fnv1a(payload, 0x9e3779b9)}`;
}

export function buildCommercialReleaseAudit(
  input: CommercialReleaseAuditInput
): CommercialReleaseAudit {
  const blockers: string[] = [];
  const reviewFlags: string[] = [];
  const infoFlags: string[] = [];
  const passedChecks: string[] = [];
  const externalCalendar = auditExternalCalendar(input);
  const checks: boolean[] = [];
  const check = (passed: boolean, label: string) => {
    checks.push(passed);
    if (passed) passedChecks.push(label);
  };

  check(input.stableSelection !== 'unstable-day', '출생시간 시나리오에서 일주가 불변입니다.');
  if (input.stableSelection === 'unstable-day') {
    blockers.push('출생시간 시나리오에 따라 일주가 달라 단일 명식을 확정할 수 없습니다.');
  }

  check(input.precision === 'exact-minute', '출생시간이 분 단위로 입력되었습니다.');
  if (input.precision !== 'exact-minute') {
    reviewFlags.push('출생시간이 범위 또는 미상이므로 시주 의존 결론을 수동 검토해야 합니다.');
  }

  const correctionSatisfied = !input.trueSolarTime.requested || input.trueSolarTime.applied;
  check(correctionSatisfied, '요청된 진태양시 보정이 적용되었습니다.');
  if (!correctionSatisfied) {
    reviewFlags.push('진태양시 보정을 요청했지만 검증된 경도가 없어 적용하지 못했습니다.');
  }

  check(input.interpretationResolved, '전문 해석 합의가 미해결 상태가 아닙니다.');
  if (!input.interpretationResolved) {
    reviewFlags.push('용신 관점 간 충돌 또는 근거 부족으로 전문 해석 합의가 유보되었습니다.');
  }

  check(input.helpfulElementSource === 'expert-consensus', '도움 오행이 다중 관점 합의에서 선택되었습니다.');
  if (input.helpfulElementSource !== 'expert-consensus') {
    reviewFlags.push('도움 오행이 레거시 강약 규칙으로 대체되어 전문가 검토가 필요합니다.');
  }

  const externalVerified = ['matched', 'verified-date-only', 'not-comparable-policy']
    .includes(externalCalendar.status);
  check(externalVerified, '외부 한국 역법 검증이 완료되었습니다.');
  if (externalCalendar.status === 'mismatched') {
    blockers.push(externalCalendar.message);
  } else if (!externalVerified) {
    infoFlags.push(externalCalendar.message);
  }

  check(input.evidenceCount > 0, '해석 근거 레코드가 존재합니다.');
  if (input.evidenceCount <= 0) {
    blockers.push('해석 근거 레코드가 없어 유료 리포트를 발행할 수 없습니다.');
  }

  check(Boolean(input.timezoneId) && Number.isFinite(input.utcOffsetMinutes), '시간대와 출생 당시 UTC 오프셋이 고정되었습니다.');

  const passed = checks.filter(Boolean).length;
  const decision: CommercialReleaseDecision = blockers.length > 0
    ? 'blocked'
    : reviewFlags.length > 0
      ? 'manual-review-required'
      : 'eligible';

  return {
    version: COMMERCIAL_RELEASE_AUDIT_VERSION,
    decision,
    reproducibilityFingerprint: fingerprint(input),
    evidenceCoverage: {
      score: Number((passed / checks.length).toFixed(3)),
      passed,
      total: checks.length
    },
    externalCalendar,
    blockers,
    reviewFlags,
    infoFlags,
    passedChecks,
    claimPolicy: 'reproducible-calculation-not-predictive-accuracy'
  };
}
