import { describe, expect, it, vi } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import {
  buildCommercialReleaseAudit,
  type CommercialReleaseAudit,
  type CommercialReleaseAuditInput
} from '../saju/v2/commercialAudit';
import {
  prepareCommercialReportRequest,
  type PreparedCommercialReportRequest,
  type ReportRequestBody
} from './geminiReportService';
import {
  buildReleasePreflightInputFingerprint,
  evaluateGeneralSignatureReleasePreflight
} from './releasePreflightService';

const formData: Partial<IntakeFormData> = {
  name: '차민호',
  gender: 'male',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight',
  relationshipStatus: 'dating',
  relationshipDuration: 'under3',
  location: '',
  q1: '사업을 시작해도 될까요?',
  q2: '사업 매출이 늘어도 돈이 남지 않는데 어떤 지출을 줄여야 하나요?'
};

const requestBody: ReportRequestBody = {
  serviceId: 'general-signature',
  payload: {
    contractVersion: 'intake-contract-v1',
    serviceId: 'general-signature',
    user: { name: '차민호', gender: 'male' },
    birth: {
      calendar: 'solar',
      isLeapMonth: false,
      date: '1992-09-09',
      time: '10:24',
      isUnknownTime: false,
      precision: 'exact',
      dayBoundaryPolicy: 'midnight',
      location: null,
      locationText: ''
    },
    relationship: { status: 'dating', duration: 'under3' },
    questions: [
      '사업을 시작해도 될까요?',
      '사업 매출이 늘어도 돈이 남지 않는데 어떤 지출을 줄여야 하나요?'
    ]
  }
};

function makeAuditInput(overrides: Partial<CommercialReleaseAuditInput> = {}): CommercialReleaseAuditInput {
  return {
    serviceId: 'general-signature',
    engineVersion: 'engine-v1',
    calendarVersion: 'calendar-v1',
    interpretationVersion: 'interpretation-v1',
    birthDate: '1992-09-09',
    birthTime: '10:24',
    calendar: 'solar',
    timezoneId: 'Asia/Seoul',
    utcOffsetMinutes: 540,
    dayBoundaryPolicy: 'civil-midnight',
    precision: 'exact-minute',
    stableSelection: 'primary',
    scenarioPillars: [{ id: 'exact', day: '무자' }],
    pillars: { year: '임신', month: '기유', day: '무자', hour: '정사' },
    trueSolarTime: { requested: false, applied: false },
    externalDayComparable: true,
    interpretationResolved: true,
    helpfulElementSource: 'expert-consensus',
    evidenceCount: 24,
    ...overrides
  };
}

function makePrepared(
  audit: CommercialReleaseAudit,
  inputFormData: Partial<IntakeFormData> = formData
): PreparedCommercialReportRequest {
  return {
    serviceId: 'general-signature',
    inputFormData,
    formData: inputFormData,
    verification: {
      provider: 'KASI',
      enabled: false,
      status: 'disabled',
      originalCalendar: 'solar',
      originalBirthDate: '1992-09-09',
      originalIsLeapMonth: false,
      normalizedCalendar: 'solar',
      normalizedSolarDate: '1992-09-09',
      lunarCalendarVerification: { enabled: false, status: 'disabled', message: 'disabled' },
      solarTermVerification: { enabled: false, status: 'disabled', message: 'disabled' }
    },
    deterministicBasis: {
      commercialV2: { releaseAudit: audit }
    } as PreparedCommercialReportRequest['deterministicBasis']
  };
}

function evaluatorFor(audit: CommercialReleaseAudit) {
  const prepare = vi.fn(async () => makePrepared(audit));
  return { prepare, dependencies: { prepare } };
}

describe('general-signature release preflight', () => {
  it.each([
    ['eligible', 'auto-eligible'],
    ['manual-review-required', 'manual-review-required'],
    ['blocked', 'blocked']
  ] as const)('maps the canonical %s audit decision to %s', async (decision, expectedStatus) => {
    const audit = decision === 'manual-review-required'
      ? buildCommercialReleaseAudit(makeAuditInput({ precision: 'legacy-range' }))
      : decision === 'blocked'
        ? buildCommercialReleaseAudit(makeAuditInput({ stableSelection: 'unstable-day' }))
        : buildCommercialReleaseAudit(makeAuditInput());
    const { prepare, dependencies } = evaluatorFor(audit);

    const result = await evaluateGeneralSignatureReleasePreflight(requestBody, dependencies);

    expect(result.status).toBe(expectedStatus);
    expect(result.policyVersion).toBe(audit.version);
    expect(result.calculationFingerprint).toBe(audit.reproducibilityFingerprint);
    expect(result.inputFingerprint).toMatch(/^uwi-[a-f0-9]{64}$/);
    expect(prepare).toHaveBeenCalledWith(requestBody, { allowUnstableDay: true });
  });

  it('ignores forged client eligibility and calculation fields', async () => {
    const audit = buildCommercialReleaseAudit(makeAuditInput({ precision: 'unknown' }));
    const { dependencies } = evaluatorFor(audit);
    const forged = {
      ...requestBody,
      status: 'auto-eligible',
      manualReview: false,
      blocked: false,
      price: 0,
      calculationResult: { pillars: 'forged' }
    } as ReportRequestBody;

    await expect(evaluateGeneralSignatureReleasePreflight(forged, dependencies))
      .resolves.toMatchObject({ status: 'manual-review-required' });
  });

  it.each([
    { serviceId: 'love-reading' as const },
    { serviceId: 'general-signature' as const, productId: 'love-reading' },
    {
      serviceId: 'general-signature' as const,
      payload: { ...requestBody.payload, serviceId: 'love-reading' as const }
    }
  ])('rejects a product mismatch before deterministic preparation: %#', async (mismatch) => {
    const prepare = vi.fn(async () => makePrepared(buildCommercialReleaseAudit(makeAuditInput())));

    await expect(evaluateGeneralSignatureReleasePreflight(
      { ...requestBody, ...mismatch },
      { prepare }
    )).rejects.toMatchObject({ status: 409 });
    expect(prepare).not.toHaveBeenCalled();
  });

  it('binds fingerprints to calendar, leap month and time precision', () => {
    const base = buildReleasePreflightInputFingerprint('general-signature', formData, 'v1');
    const lunar = buildReleasePreflightInputFingerprint(
      'general-signature',
      { ...formData, calendar: 'lunar' },
      'v1'
    );
    const leap = buildReleasePreflightInputFingerprint(
      'general-signature',
      { ...formData, calendar: 'lunar', isLeapMonth: true },
      'v1'
    );
    const range = buildReleasePreflightInputFingerprint(
      'general-signature',
      { ...formData, birthTimePrecision: 'branch-range' },
      'v1'
    );

    expect(new Set([base, lunar, leap, range]).size).toBe(4);
  });

  it('invalidates the calculation fingerprint when the calendar policy version changes', () => {
    const previous = buildCommercialReleaseAudit(
      makeAuditInput({ calendarVersion: 'calendar-v2.0.0' })
    );
    const current = buildCommercialReleaseAudit(
      makeAuditInput({ calendarVersion: 'calendar-v2.1.0' })
    );

    expect(previous.decision).toBe(current.decision);
    expect(previous.reproducibilityFingerprint).not.toBe(current.reproducibilityFingerprint);
  });

  it('keeps the verified 1992-09-09 10:24 FACT on the shared preparation path', async () => {
    const prepared = await prepareCommercialReportRequest(requestBody);

    expect(prepared.deterministicBasis.input).toMatchObject({
      gender: 'male',
      birthDate: '1992-09-09',
      birthTime: '10:24'
    });
    expect(prepared.deterministicBasis.pillars).toEqual({
      year: '임신',
      month: '기유',
      day: '무자',
      hour: '정사'
    });
  });

  it('returns the real engine blocked decision for unknown time crossing late-zi', async () => {
    const blockedRequest: ReportRequestBody = {
      ...requestBody,
      payload: {
        ...requestBody.payload,
        birth: {
          ...requestBody.payload?.birth,
          time: null,
          isUnknownTime: true,
          precision: 'unknown',
          dayBoundaryPolicy: 'late-zi'
        }
      }
    };

    const result = await evaluateGeneralSignatureReleasePreflight(blockedRequest);

    expect(result.status).toBe('blocked');
    expect(result.reasons.join(' ')).toContain('일주가 달라');
  });

  it('returns the real engine manual decision for stable unknown time', async () => {
    const manualRequest: ReportRequestBody = {
      ...requestBody,
      payload: {
        ...requestBody.payload,
        birth: {
          ...requestBody.payload?.birth,
          time: null,
          isUnknownTime: true,
          precision: 'unknown',
          dayBoundaryPolicy: 'midnight'
        }
      }
    };

    const result = await evaluateGeneralSignatureReleasePreflight(manualRequest);

    expect(result.status).toBe('manual-review-required');
    expect(result.reasons.join(' ')).toContain('출생시간이 범위 또는 미상');
  });
});
