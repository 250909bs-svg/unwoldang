import type { AnalysisRequestPayload, PastLifeAnalysisContext } from '../../lib/analysisPayload';
import type { SajuReportData } from '../../lib/saju/report';
import { productIds, type ProductId } from '../../products/types';

export const REPORT_REQUEST_SCHEMA_VERSION = 'report-request-v1' as const;
export const REPORT_RESPONSE_SCHEMA_VERSION = 'report-response-v1' as const;
export const REPORT_GENERATION_META_SCHEMA_VERSION = 'report-generation-meta-v1' as const;

export const reportErrorCodes = [
  'REPORT_REQUEST_INVALID',
  'REPORT_RESPONSE_INVALID',
  'REPORT_AUTH_REQUIRED',
  'REPORT_ENTITLEMENT_INVALID',
  'REPORT_INPUT_CONFLICT',
  'REPORT_GENERATION_IN_PROGRESS',
  'REPORT_LEASE_INVALID',
  'REPORT_LEASE_LOST',
  'REPORT_RATE_LIMITED',
  'REPORT_PROVIDER_UNAVAILABLE',
  'REPORT_STORAGE_UNAVAILABLE',
  'REPORT_TIMEOUT',
  'REPORT_NETWORK_ERROR',
  'REPORT_CACHE_INTEGRITY_FAILED',
  'REPORT_FACT_GUARD_REJECTED',
  'REPORT_DEGRADED_FALLBACK',
  'REPORT_UNKNOWN_ERROR'
] as const;

export type ReportErrorCode = (typeof reportErrorCodes)[number];
export type ReportProvider = 'gemini' | 'deterministic-fallback' | 'unknown';

export type ReportGenerationMetaV1 = {
  schemaVersion: typeof REPORT_GENERATION_META_SCHEMA_VERSION;
  provider: string;
  model: string | null;
  latencyMs: number | null;
  attemptCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostMicros: number | null;
  currency: 'USD';
  fallback: boolean;
  fallbackReason?: string;
  cacheStatus: string;
  errorCode?: ReportErrorCode;
  inputSchemaVersion: typeof REPORT_REQUEST_SCHEMA_VERSION;
  responseSchemaVersion: typeof REPORT_RESPONSE_SCHEMA_VERSION;
  engineVersion?: string;
  adapterVersion?: string;
};

export type ReportRequestV1 = {
  schemaVersion: typeof REPORT_REQUEST_SCHEMA_VERSION;
  serviceId: ProductId;
  orderId?: string;
  payload: AnalysisRequestPayload;
  reportMode: string;
  promptVersion: string;
};

export type ReportResponseV1 = {
  schemaVersion: typeof REPORT_RESPONSE_SCHEMA_VERSION;
  report: SajuReportData;
  provider: ReportProvider;
  reportMode?: string;
  promptVersion?: string;
  generationMeta: ReportGenerationMetaV1;
};

export class ReportContractError extends Error {
  readonly code: 'REPORT_REQUEST_INVALID' | 'REPORT_RESPONSE_INVALID';
  readonly retryable = false;

  constructor(code: 'REPORT_REQUEST_INVALID' | 'REPORT_RESPONSE_INVALID', message: string) {
    super(message);
    this.name = 'ReportContractError';
    this.code = code;
  }
}

export class ReportGenerationError extends Error {
  readonly code: ReportErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(input: {
    code: ReportErrorCode;
    message: string;
    retryable: boolean;
    status?: number;
    retryAfterMs?: number;
  }) {
    super(input.message);
    this.name = 'ReportGenerationError';
    this.code = input.code;
    this.retryable = input.retryable;
    this.status = input.status;
    this.retryAfterMs = input.retryAfterMs;
  }
}

type UnknownRecord = Record<string, unknown>;

const REQUEST_KEYS = ['schemaVersion', 'serviceId', 'orderId', 'payload', 'reportMode', 'promptVersion'] as const;
const PAYLOAD_KEYS = [
  'serviceId',
  'serviceLabel',
  'timezone',
  'user',
  'birth',
  'partner',
  'relationship',
  'pastLifeContext',
  'questions'
] as const;
const META_KEYS = [
  'schemaVersion',
  'provider',
  'model',
  'latencyMs',
  'attemptCount',
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'estimatedCostMicros',
  'currency',
  'fallback',
  'fallbackReason',
  'cacheStatus',
  'errorCode',
  'inputSchemaVersion',
  'responseSchemaVersion',
  'engineVersion',
  'adapterVersion'
] as const;
const RESPONSE_KEYS = [
  'schemaVersion',
  'report',
  'provider',
  'reportMode',
  'promptVersion',
  'generationMeta'
] as const;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function contractFailure(kind: 'request' | 'response', path: string, detail: string): never {
  throw new ReportContractError(
    kind === 'request' ? 'REPORT_REQUEST_INVALID' : 'REPORT_RESPONSE_INVALID',
    `Invalid report ${kind} at ${path}: ${detail}`
  );
}

function readRecord(value: unknown, kind: 'request' | 'response', path: string): UnknownRecord {
  if (!isRecord(value)) {
    return contractFailure(kind, path, 'expected an object');
  }
  return value;
}

function assertAllowedKeys(
  value: UnknownRecord,
  allowed: readonly string[],
  kind: 'request' | 'response',
  path: string
) {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) {
    contractFailure(kind, `${path}.${unexpected}`, 'field is not allowed by this schema version');
  }
}

function readString(
  value: unknown,
  kind: 'request' | 'response',
  path: string,
  options: { allowEmpty?: boolean; maxLength?: number } = {}
) {
  if (typeof value !== 'string') {
    return contractFailure(kind, path, 'expected a string');
  }
  const normalized = value.trim();
  if (!options.allowEmpty && !normalized) {
    return contractFailure(kind, path, 'must not be empty');
  }
  if (value.length > (options.maxLength ?? 12_000)) {
    return contractFailure(kind, path, 'string is too long');
  }
  return value;
}

function readOptionalString(value: unknown, kind: 'request' | 'response', path: string) {
  return value === undefined ? undefined : readString(value, kind, path);
}

function readSafeIdentifier(value: unknown, path: string, nullable: true): string | null;
function readSafeIdentifier(value: unknown, path: string, nullable?: false): string;
function readSafeIdentifier(value: unknown, path: string, nullable = false) {
  if (nullable && value === null) return null;
  const identifier = readString(value, 'response', path, { maxLength: 160 });
  if (!SAFE_IDENTIFIER.test(identifier)) {
    return contractFailure('response', path, 'expected a privacy-safe identifier');
  }
  return identifier;
}

function readBoolean(value: unknown, kind: 'request' | 'response', path: string) {
  if (typeof value !== 'boolean') {
    return contractFailure(kind, path, 'expected a boolean');
  }
  return value;
}

function readNullableMetric(value: unknown, path: string) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return contractFailure('response', path, 'expected a non-negative integer or null');
  }
  return value;
}

function readFiniteNumber(value: unknown, path: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return contractFailure('request', path, 'expected a finite number');
  }
  return value;
}

function readOptionalFiniteNumber(value: unknown, path: string) {
  return value === undefined ? undefined : readFiniteNumber(value, path);
}

function readLiteral<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  kind: 'request' | 'response',
  path: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return contractFailure(kind, path, `expected one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function parseLocation(value: unknown, path: string) {
  if (value === null || value === undefined) return value ?? null;
  const location = readRecord(value, 'request', path);
  assertAllowedKeys(
    location,
    ['label', 'latitude', 'longitude', 'timezone', 'utcOffsetMinutes', 'applySolarTimeCorrection'],
    'request',
    path
  );
  return {
    label: readString(location.label, 'request', `${path}.label`, { allowEmpty: true, maxLength: 120 }),
    latitude: readOptionalFiniteNumber(location.latitude, `${path}.latitude`),
    longitude: readOptionalFiniteNumber(location.longitude, `${path}.longitude`),
    timezone: location.timezone === undefined
      ? undefined
      : readString(location.timezone, 'request', `${path}.timezone`, { maxLength: 80 }),
    utcOffsetMinutes: readOptionalFiniteNumber(location.utcOffsetMinutes, `${path}.utcOffsetMinutes`),
    applySolarTimeCorrection: location.applySolarTimeCorrection === undefined
      ? undefined
      : readBoolean(location.applySolarTimeCorrection, 'request', `${path}.applySolarTimeCorrection`)
  };
}

function parsePartner(value: unknown) {
  if (value === null) return null;
  const partner = readRecord(value, 'request', 'payload.partner');
  assertAllowedKeys(
    partner,
    [
      'name',
      'gender',
      'calendar',
      'isLeapMonth',
      'birthDate',
      'birthTime',
      'isUnknownTime',
      'birthTimePrecision',
      'dayBoundaryPolicy',
      'birthLocation'
    ],
    'request',
    'payload.partner'
  );
  return {
    name: readString(partner.name, 'request', 'payload.partner.name', { allowEmpty: true, maxLength: 50 }),
    gender: readLiteral(partner.gender, ['male', 'female'], 'request', 'payload.partner.gender'),
    calendar: readLiteral(partner.calendar, ['solar', 'lunar'], 'request', 'payload.partner.calendar'),
    isLeapMonth: readBoolean(partner.isLeapMonth, 'request', 'payload.partner.isLeapMonth'),
    birthDate: readString(partner.birthDate, 'request', 'payload.partner.birthDate', { allowEmpty: true, maxLength: 10 }),
    birthTime: readString(partner.birthTime, 'request', 'payload.partner.birthTime', { allowEmpty: true, maxLength: 5 }),
    isUnknownTime: readBoolean(partner.isUnknownTime, 'request', 'payload.partner.isUnknownTime'),
    birthTimePrecision: partner.birthTimePrecision === undefined
      ? undefined
      : readLiteral(partner.birthTimePrecision, ['exact', 'branch-range', 'unknown'], 'request', 'payload.partner.birthTimePrecision'),
    dayBoundaryPolicy: partner.dayBoundaryPolicy === undefined
      ? undefined
      : readLiteral(partner.dayBoundaryPolicy, ['midnight', 'late-zi'], 'request', 'payload.partner.dayBoundaryPolicy'),
    birthLocation: partner.birthLocation === undefined
      ? undefined
      : parseLocation(partner.birthLocation, 'payload.partner.birthLocation') || undefined
  };
}

function parsePastLifeContext(value: unknown): PastLifeAnalysisContext | null {
  if (value === null) return null;
  const context = readRecord(value, 'request', 'payload.pastLifeContext');
  const keys = ['topic', 'repeatedScene', 'frequentEmotion', 'hiddenDesire', 'chosenSymbol', 'readingTone'] as const;
  assertAllowedKeys(context, keys, 'request', 'payload.pastLifeContext');
  return Object.fromEntries(
    keys.map((key) => [key, readString(context[key], 'request', `payload.pastLifeContext.${key}`, {
      allowEmpty: true,
      maxLength: 500
    })])
  ) as unknown as PastLifeAnalysisContext;
}

function parseAnalysisPayload(value: unknown, serviceId: ProductId): AnalysisRequestPayload {
  const payload = readRecord(value, 'request', 'payload');
  assertAllowedKeys(payload, PAYLOAD_KEYS, 'request', 'payload');
  const payloadServiceId = readLiteral(payload.serviceId, productIds, 'request', 'payload.serviceId');
  if (payloadServiceId !== serviceId) {
    contractFailure('request', 'payload.serviceId', 'must match the top-level serviceId');
  }

  const user = readRecord(payload.user, 'request', 'payload.user');
  assertAllowedKeys(user, ['name', 'gender'], 'request', 'payload.user');
  const birth = readRecord(payload.birth, 'request', 'payload.birth');
  assertAllowedKeys(
    birth,
    ['calendar', 'isLeapMonth', 'date', 'time', 'isUnknownTime', 'precision', 'dayBoundaryPolicy', 'location'],
    'request',
    'payload.birth'
  );
  const relationship = readRecord(payload.relationship, 'request', 'payload.relationship');
  assertAllowedKeys(
    relationship,
    ['status', 'duration', 'microChoice', 'focus', 'summary'],
    'request',
    'payload.relationship'
  );
  if (!Array.isArray(payload.questions)) {
    contractFailure('request', 'payload.questions', 'expected an array');
  }

  const nullableString = (item: unknown, path: string) => item === null
    ? null
    : readString(item, 'request', path, { allowEmpty: true, maxLength: 500 });

  return {
    serviceId: payloadServiceId,
    serviceLabel: readString(payload.serviceLabel, 'request', 'payload.serviceLabel', { maxLength: 120 }),
    timezone: readString(payload.timezone, 'request', 'payload.timezone', { maxLength: 80 }),
    user: {
      name: readString(user.name, 'request', 'payload.user.name', { allowEmpty: true, maxLength: 50 }),
      gender: readLiteral(user.gender, ['male', 'female'], 'request', 'payload.user.gender')
    },
    birth: {
      calendar: readLiteral(birth.calendar, ['solar', 'lunar'], 'request', 'payload.birth.calendar'),
      isLeapMonth: readBoolean(birth.isLeapMonth, 'request', 'payload.birth.isLeapMonth'),
      date: readString(birth.date, 'request', 'payload.birth.date', { allowEmpty: true, maxLength: 10 }),
      time: birth.time === null
        ? null
        : readString(birth.time, 'request', 'payload.birth.time', { allowEmpty: true, maxLength: 5 }),
      isUnknownTime: readBoolean(birth.isUnknownTime, 'request', 'payload.birth.isUnknownTime'),
      precision: readLiteral(birth.precision, ['exact', 'branch-range', 'unknown'], 'request', 'payload.birth.precision'),
      dayBoundaryPolicy: readLiteral(birth.dayBoundaryPolicy, ['midnight', 'late-zi'], 'request', 'payload.birth.dayBoundaryPolicy'),
      location: parseLocation(birth.location, 'payload.birth.location')
    },
    partner: parsePartner(payload.partner),
    relationship: {
      status: nullableString(relationship.status, 'payload.relationship.status') as AnalysisRequestPayload['relationship']['status'],
      duration: nullableString(relationship.duration, 'payload.relationship.duration') as AnalysisRequestPayload['relationship']['duration'],
      microChoice: nullableString(relationship.microChoice, 'payload.relationship.microChoice') as AnalysisRequestPayload['relationship']['microChoice'],
      focus: nullableString(relationship.focus, 'payload.relationship.focus') as AnalysisRequestPayload['relationship']['focus'],
      summary: readString(relationship.summary, 'request', 'payload.relationship.summary', { allowEmpty: true, maxLength: 500 })
    },
    pastLifeContext: parsePastLifeContext(payload.pastLifeContext),
    questions: payload.questions.map((question, index) => (
      readString(question, 'request', `payload.questions.${index}`, { maxLength: 500 })
    ))
  };
}

export function parseReportRequestV1(value: unknown): ReportRequestV1 {
  const request = readRecord(value, 'request', 'request');
  assertAllowedKeys(request, REQUEST_KEYS, 'request', 'request');
  if (request.schemaVersion !== REPORT_REQUEST_SCHEMA_VERSION) {
    contractFailure('request', 'request.schemaVersion', `expected ${REPORT_REQUEST_SCHEMA_VERSION}`);
  }
  const serviceId = readLiteral(request.serviceId, productIds, 'request', 'request.serviceId');
  return {
    schemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
    serviceId,
    orderId: readOptionalString(request.orderId, 'request', 'request.orderId'),
    payload: parseAnalysisPayload(request.payload, serviceId),
    reportMode: readString(request.reportMode, 'request', 'request.reportMode', { maxLength: 120 }),
    promptVersion: readString(request.promptVersion, 'request', 'request.promptVersion', { maxLength: 120 })
  };
}

export function parseReportGenerationMetaV1(value: unknown): ReportGenerationMetaV1 {
  const meta = readRecord(value, 'response', 'generationMeta');
  assertAllowedKeys(meta, META_KEYS, 'response', 'generationMeta');
  if (meta.schemaVersion !== REPORT_GENERATION_META_SCHEMA_VERSION) {
    contractFailure('response', 'generationMeta.schemaVersion', `expected ${REPORT_GENERATION_META_SCHEMA_VERSION}`);
  }
  if (meta.currency !== 'USD') {
    contractFailure('response', 'generationMeta.currency', 'expected USD');
  }
  if (meta.inputSchemaVersion !== REPORT_REQUEST_SCHEMA_VERSION) {
    contractFailure('response', 'generationMeta.inputSchemaVersion', `expected ${REPORT_REQUEST_SCHEMA_VERSION}`);
  }
  if (meta.responseSchemaVersion !== REPORT_RESPONSE_SCHEMA_VERSION) {
    contractFailure('response', 'generationMeta.responseSchemaVersion', `expected ${REPORT_RESPONSE_SCHEMA_VERSION}`);
  }
  const errorCode = meta.errorCode === undefined
    ? undefined
    : readLiteral(meta.errorCode, reportErrorCodes, 'response', 'generationMeta.errorCode');

  return {
    schemaVersion: REPORT_GENERATION_META_SCHEMA_VERSION,
    provider: readSafeIdentifier(meta.provider, 'generationMeta.provider'),
    model: readSafeIdentifier(meta.model, 'generationMeta.model', true),
    latencyMs: readNullableMetric(meta.latencyMs, 'generationMeta.latencyMs'),
    attemptCount: readNullableMetric(meta.attemptCount, 'generationMeta.attemptCount') ?? 0,
    inputTokens: readNullableMetric(meta.inputTokens, 'generationMeta.inputTokens'),
    outputTokens: readNullableMetric(meta.outputTokens, 'generationMeta.outputTokens'),
    totalTokens: readNullableMetric(meta.totalTokens, 'generationMeta.totalTokens'),
    estimatedCostMicros: readNullableMetric(meta.estimatedCostMicros, 'generationMeta.estimatedCostMicros'),
    currency: 'USD',
    fallback: readBoolean(meta.fallback, 'response', 'generationMeta.fallback'),
    fallbackReason: meta.fallbackReason === undefined
      ? undefined
      : readSafeIdentifier(meta.fallbackReason, 'generationMeta.fallbackReason'),
    cacheStatus: readSafeIdentifier(meta.cacheStatus, 'generationMeta.cacheStatus'),
    errorCode,
    inputSchemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
    responseSchemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
    engineVersion: meta.engineVersion === undefined
      ? undefined
      : readSafeIdentifier(meta.engineVersion, 'generationMeta.engineVersion'),
    adapterVersion: meta.adapterVersion === undefined
      ? undefined
      : readSafeIdentifier(meta.adapterVersion, 'generationMeta.adapterVersion')
  };
}

function validateResponseStringArray(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    contractFailure('response', path, 'expected an array');
  }
  value.forEach((item, index) => {
    readString(item, 'response', `${path}.${index}`);
  });
}

function parseReportData(value: unknown, strict: boolean): SajuReportData {
  const report = readRecord(value, 'response', 'report');
  readString(report.title, 'response', 'report.title', { maxLength: 500 });
  const sections = report.sections;
  if (!Array.isArray(sections)) {
    contractFailure('response', 'report.sections', 'expected an array');
  }
  if (!report.summary || (strict && !isRecord(report.summary))) {
    contractFailure('response', 'report.summary', strict ? 'expected an object' : 'is required');
  }
  if (strict) {
    const summary = report.summary as UnknownRecord;
    readString(summary.title, 'response', 'report.summary.title', { maxLength: 500 });
    validateResponseStringArray(summary.analysis, 'report.summary.analysis');
    validateResponseStringArray(summary.advice, 'report.summary.advice');
    sections.forEach((value, index) => {
      const path = `report.sections.${index}`;
      const section = readRecord(value, 'response', path);
      readString(section.id, 'response', `${path}.id`, { maxLength: 160 });
      readString(section.title, 'response', `${path}.title`, { maxLength: 500 });
      for (const field of ['paragraphs', 'bullets'] as const) {
        if (section[field] !== undefined) {
          validateResponseStringArray(section[field], `${path}.${field}`);
        }
      }
    });
  }
  return report as unknown as SajuReportData;
}

function normalizeProvider(value: unknown): ReportProvider {
  return value === 'gemini' || value === 'deterministic-fallback' ? value : 'unknown';
}

export function createLegacyGenerationMeta(input: {
  provider?: unknown;
  latencyMs?: number | null;
  attemptCount?: number;
} = {}): ReportGenerationMetaV1 {
  const provider = normalizeProvider(input.provider);
  const fallback = provider !== 'gemini';
  return {
    schemaVersion: REPORT_GENERATION_META_SCHEMA_VERSION,
    provider,
    model: null,
    latencyMs: input.latencyMs ?? null,
    attemptCount: input.attemptCount ?? 1,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    estimatedCostMicros: null,
    currency: 'USD',
    fallback,
    ...(fallback ? {
      fallbackReason: provider === 'deterministic-fallback'
        ? 'deterministic-fallback'
        : 'legacy-provider-missing'
    } : {}),
    cacheStatus: 'unknown',
    inputSchemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
    responseSchemaVersion: REPORT_RESPONSE_SCHEMA_VERSION
  };
}

export function parseReportResponseV1(value: unknown): ReportResponseV1 {
  const root = readRecord(value, 'response', 'response');

  if (root.schemaVersion === REPORT_RESPONSE_SCHEMA_VERSION) {
    assertAllowedKeys(root, RESPONSE_KEYS, 'response', 'response');
    const generationMeta = parseReportGenerationMetaV1(root.generationMeta);
    const provider = normalizeProvider(root.provider ?? generationMeta.provider);
    if (root.provider !== undefined && generationMeta.provider !== root.provider) {
      contractFailure('response', 'response.provider', 'must match generationMeta.provider');
    }
    return {
      schemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
      report: parseReportData(root.report, true),
      provider,
      reportMode: readOptionalString(root.reportMode, 'response', 'response.reportMode'),
      promptVersion: readOptionalString(root.promptVersion, 'response', 'response.promptVersion'),
      generationMeta
    };
  }

  const isLegacyEnvelope = Object.prototype.hasOwnProperty.call(root, 'report');
  const legacyProvider = isLegacyEnvelope ? root.provider : undefined;
  return {
    schemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
    report: parseReportData(isLegacyEnvelope ? root.report : root, false),
    provider: normalizeProvider(legacyProvider),
    reportMode: isLegacyEnvelope ? readOptionalString(root.reportMode, 'response', 'response.reportMode') : undefined,
    promptVersion: isLegacyEnvelope ? readOptionalString(root.promptVersion, 'response', 'response.promptVersion') : undefined,
    generationMeta: createLegacyGenerationMeta({ provider: legacyProvider })
  };
}

export function isReportErrorCode(value: unknown): value is ReportErrorCode {
  return typeof value === 'string' && reportErrorCodes.includes(value as ReportErrorCode);
}
