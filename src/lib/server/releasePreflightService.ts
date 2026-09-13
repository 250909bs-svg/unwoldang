import { createHash } from 'node:crypto';
import type { IntakeFormData } from '../../api/mockData';
import type { CommercialReleaseAudit } from '../saju/v2/commercialAudit';
import type { ReleasePreflightResult } from '../releasePreflightContract';
import {
  prepareCommercialReportRequest,
  ReportRequestError,
  type PreparedCommercialReportRequest,
  type ReportRequestBody
} from './geminiReportService';

type PreflightPreparation = (
  body: ReportRequestBody,
  options: { allowUnstableDay?: boolean }
) => Promise<PreparedCommercialReportRequest>;

function canonicalize(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }

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

function fingerprintPayload(
  serviceId: 'general-signature',
  formData: Partial<IntakeFormData>,
  contractVersion: string | undefined
) {
  return {
    serviceId,
    contractVersion: contractVersion || null,
    user: {
      name: formData.name?.trim() || '',
      gender: formData.gender || null
    },
    birth: {
      calendar: formData.calendar || null,
      isLeapMonth: Boolean(formData.isLeapMonth),
      date: formData.birthDate || null,
      time: formData.isUnknownTime ? null : formData.birthTime || null,
      isUnknownTime: Boolean(formData.isUnknownTime),
      precision: formData.birthTimePrecision || null,
      dayBoundaryPolicy: formData.dayBoundaryPolicy || null,
      location: formData.birthLocation
        ? {
            label: formData.birthLocation.label || '',
            latitude: formData.birthLocation.latitude ?? null,
            longitude: formData.birthLocation.longitude ?? null,
            timezone: formData.birthLocation.timezone || null,
            utcOffsetMinutes: formData.birthLocation.utcOffsetMinutes ?? null,
            applySolarTimeCorrection: Boolean(formData.birthLocation.applySolarTimeCorrection)
          }
        : null,
      locationText: formData.location || '',
      timezone: formData.timezone || null,
      utcOffsetMinutes: formData.utcOffsetMinutes ?? null,
      latitude: formData.latitude ?? null,
      longitude: formData.longitude ?? null,
      applySolarTimeCorrection: Boolean(formData.applySolarTimeCorrection)
    },
    relationship: {
      status: formData.relationshipStatus || null,
      duration: formData.relationshipDuration || null,
      microChoice: formData.loveReaction || null,
      focus: formData.loveFocus || null
    },
    partner: formData.partner || null,
    questions: [formData.q1?.trim() || '', formData.q2?.trim() || '']
  };
}

export function buildReleasePreflightInputFingerprint(
  serviceId: 'general-signature',
  formData: Partial<IntakeFormData>,
  contractVersion?: string
) {
  return `uwi-${createHash('sha256')
    .update(canonicalize(fingerprintPayload(serviceId, formData, contractVersion)))
    .digest('hex')}`;
}

export function mapCommercialAuditToPreflight(
  audit: CommercialReleaseAudit,
  inputFingerprint: string
): ReleasePreflightResult {
  if (audit.decision === 'blocked') {
    return {
      serviceId: 'general-signature',
      status: 'blocked',
      reasons: [...audit.blockers],
      policyVersion: audit.version,
      inputFingerprint,
      calculationFingerprint: audit.reproducibilityFingerprint
    };
  }

  if (audit.decision === 'manual-review-required') {
    return {
      serviceId: 'general-signature',
      status: 'manual-review-required',
      reasons: [...audit.reviewFlags],
      policyVersion: audit.version,
      inputFingerprint,
      calculationFingerprint: audit.reproducibilityFingerprint
    };
  }

  return {
    serviceId: 'general-signature',
    status: 'auto-eligible',
    reasons: [],
    policyVersion: audit.version,
    inputFingerprint,
    calculationFingerprint: audit.reproducibilityFingerprint
  };
}

export async function evaluateGeneralSignatureReleasePreflight(
  body: ReportRequestBody,
  dependencies: { prepare?: PreflightPreparation } = {}
): Promise<ReleasePreflightResult> {
  if (
    body.serviceId !== 'general-signature' ||
    (body.productId !== undefined && body.productId !== 'general-signature') ||
    (body.payload?.serviceId !== undefined && body.payload.serviceId !== 'general-signature')
  ) {
    throw new ReportRequestError(409, '종합사주 preflight와 상품 ID가 일치하지 않습니다.');
  }

  const prepare = dependencies.prepare || prepareCommercialReportRequest;
  const prepared = await prepare(body, { allowUnstableDay: true });
  const inputFingerprint = buildReleasePreflightInputFingerprint(
    'general-signature',
    prepared.inputFormData,
    body.payload?.contractVersion
  );

  return mapCommercialAuditToPreflight(
    prepared.deterministicBasis.commercialV2.releaseAudit,
    inputFingerprint
  );
}
