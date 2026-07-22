import { COMMERCIAL_RELEASE_AUDIT_VERSION } from '../commercialAudit';
import { digestSajuFactsValue } from './digest';
import { SAJU_FACTS_SCHEMA_VERSION, type SajuFactsV1 } from './types';

type UnknownRecord = Record<string, unknown>;

const NATAL_STATUSES = ['stable', 'ambiguous', 'degraded'] as const;
const NATAL_SELECTIONS = [
  'primary',
  'range-midpoint',
  'stable-without-hour',
  'unstable-day'
] as const;
const TIME_PRECISIONS = ['exact-minute', 'legacy-range', 'unknown'] as const;
const DAYUN_STATUSES = ['stable', 'scenario-dependent', 'unavailable'] as const;
const DAYUN_REPRESENTATIVE_KINDS = ['exact', 'range-midpoint', 'none'] as const;
const RELEASE_DECISIONS = ['eligible', 'manual-review-required', 'blocked'] as const;
const EXTERNAL_CALENDAR_STATUSES = [
  'matched',
  'mismatched',
  'verified-date-only',
  'not-comparable-policy',
  'not-configured',
  'failed'
] as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isInteger = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const isIsoDateTime = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === 'string' && values.includes(value as T);

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error('saju-facts-v1 검증 실패: ' + message);
  }
}

function hasExactKeys(
  value: UnknownRecord,
  required: readonly string[],
  optional: readonly string[] = []
) {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key));
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
  return isInteger(value) && value >= minimum && value <= maximum;
}

function isCivilDate(value: unknown): value is UnknownRecord {
  if (!isRecord(value) || !hasExactKeys(value, ['year', 'month', 'day'])) return false;
  if (!isIntegerBetween(value.year, 1, 9999) ||
    !isIntegerBetween(value.month, 1, 12) ||
    !isIntegerBetween(value.day, 1, 31)) {
    return false;
  }
  const leapYear = value.year % 4 === 0 && (value.year % 100 !== 0 || value.year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return value.day <= daysInMonth[value.month - 1];
}

function isCivilDateTime(value: unknown): value is UnknownRecord {
  return isRecord(value) &&
    hasExactKeys(value, ['year', 'month', 'day', 'hour', 'minute']) &&
    isCivilDate({ year: value.year, month: value.month, day: value.day }) &&
    isIntegerBetween(value.hour, 0, 23) &&
    isIntegerBetween(value.minute, 0, 59);
}

function isGz(value: unknown) {
  return isRecord(value) &&
    hasExactKeys(value, ['tg', 'dz']) &&
    isIntegerBetween(value.tg, 0, 9) &&
    isIntegerBetween(value.dz, 0, 11);
}

function isBazi(value: unknown) {
  if (!isRecord(value) || !hasExactKeys(value, [
    'y_gz',
    'm_gz',
    'd_gz',
    'h_gz',
    'solar',
    'lunar_in',
    'start_age',
    'forward',
    'calculationBasis'
  ], ['start_age_exact', 'dayun_start_iso'])) {
    return false;
  }
  return isGz(value.y_gz) &&
    isGz(value.m_gz) &&
    isGz(value.d_gz) &&
    (value.h_gz === null || isGz(value.h_gz)) &&
    Array.isArray(value.solar) &&
    value.solar.length === 3 &&
    isCivilDate({ year: value.solar[0], month: value.solar[1], day: value.solar[2] }) &&
    (value.lunar_in === null || typeof value.lunar_in === 'string') &&
    isFiniteNumber(value.start_age) &&
    value.start_age >= 0 &&
    (value.start_age_exact === undefined ||
      isFiniteNumber(value.start_age_exact) && value.start_age_exact >= 0) &&
    (value.dayun_start_iso === undefined || isIsoDateTime(value.dayun_start_iso)) &&
    typeof value.forward === 'boolean' &&
    isRecord(value.calculationBasis) &&
    hasExactKeys(value.calculationBasis, ['ipchun', 'isAfterIpchun']) &&
    isIsoDateTime(value.calculationBasis.ipchun) &&
    typeof value.calculationBasis.isAfterIpchun === 'boolean';
}

function isDayunRow(value: unknown) {
  if (!isRecord(value) || !hasExactKeys(value, [
    'period',
    'age',
    'year',
    'ganzhi',
    'tenGod',
    'luckStrength'
  ], ['startAgeExact', 'startAgeLabel', 'startsAt', 'endsAt'])) {
    return false;
  }
  return isInteger(value.period) &&
    typeof value.age === 'string' &&
    isInteger(value.year) &&
    typeof value.ganzhi === 'string' &&
    typeof value.tenGod === 'string' &&
    isFiniteNumber(value.luckStrength) &&
    (value.startAgeExact === undefined ||
      isFiniteNumber(value.startAgeExact) && value.startAgeExact >= 0) &&
    (value.startAgeLabel === undefined || typeof value.startAgeLabel === 'string') &&
    (value.startsAt === undefined || isIsoDateTime(value.startsAt)) &&
    (value.endsAt === undefined || isIsoDateTime(value.endsAt));
}

function isBirthTimeRange(value: unknown) {
  return isRecord(value) &&
    hasExactKeys(value, ['startHour', 'startMinute', 'endHour', 'endMinute', 'crossesMidnight']) &&
    isIntegerBetween(value.startHour, 0, 23) &&
    isIntegerBetween(value.startMinute, 0, 59) &&
    isIntegerBetween(value.endHour, 0, 23) &&
    isIntegerBetween(value.endMinute, 0, 59) &&
    typeof value.crossesMidnight === 'boolean';
}

function isTraceTimezone(value: unknown) {
  return isRecord(value) &&
    hasExactKeys(value, ['id', 'utcOffsetMinutes', 'source']) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    isIntegerBetween(value.utcOffsetMinutes, -840, 840) &&
    isOneOf(value.source, ['korea-default', 'explicit'] as const);
}

function isSolarTimeCorrection(value: unknown) {
  return isRecord(value) &&
    hasExactKeys(value, [
      'requested',
      'applied',
      'reason',
      'longitude',
      'standardMeridianLongitude',
      'longitudeCorrectionMinutes',
      'equationOfTimeMinutes',
      'totalCorrectionMinutes',
      'appliedCorrectionMinutes',
      'inputCivilDateTime',
      'apparentSolarDateTime',
      'civilDateShift'
    ]) &&
    typeof value.requested === 'boolean' &&
    typeof value.applied === 'boolean' &&
    isOneOf(value.reason, ['applied', 'disabled', 'missing-verified-longitude'] as const) &&
    (value.longitude === null || isFiniteNumber(value.longitude)) &&
    isFiniteNumber(value.standardMeridianLongitude) &&
    isFiniteNumber(value.longitudeCorrectionMinutes) &&
    isFiniteNumber(value.equationOfTimeMinutes) &&
    isFiniteNumber(value.totalCorrectionMinutes) &&
    isFiniteNumber(value.appliedCorrectionMinutes) &&
    isCivilDateTime(value.inputCivilDateTime) &&
    isCivilDateTime(value.apparentSolarDateTime) &&
    isInteger(value.civilDateShift);
}

function isDayBoundary(value: unknown) {
  return isRecord(value) &&
    hasExactKeys(value, [
      'policy',
      'threshold',
      'triggered',
      'shiftDays',
      'apparentSolarDate',
      'effectivePillarDate',
      'reason'
    ]) &&
    isOneOf(value.policy, ['civil-midnight', 'late-zi-next-day'] as const) &&
    isOneOf(value.threshold, ['00:00', '23:00'] as const) &&
    typeof value.triggered === 'boolean' &&
    (value.shiftDays === 0 || value.shiftDays === 1) &&
    isCivilDate(value.apparentSolarDate) &&
    isCivilDate(value.effectivePillarDate) &&
    isOneOf(value.reason, ['civil-midnight', 'late-zi-triggered', 'before-late-zi'] as const);
}

function isCalculationTrace(value: unknown) {
  return isRecord(value) &&
    hasExactKeys(value, [
      'scenarioId',
      'inputCalendar',
      'inputDate',
      'normalizedSolarDate',
      'inputTimePrecision',
      'inputCivilDateTime',
      'timezone',
      'instantInKst',
      'solarTimeCorrection',
      'dayBoundary',
      'warnings'
    ]) &&
    typeof value.scenarioId === 'string' &&
    isOneOf(value.inputCalendar, ['solar', 'lunar'] as const) &&
    isCivilDate(value.inputDate) &&
    isCivilDate(value.normalizedSolarDate) &&
    isOneOf(value.inputTimePrecision, TIME_PRECISIONS) &&
    isCivilDateTime(value.inputCivilDateTime) &&
    isTraceTimezone(value.timezone) &&
    isCivilDateTime(value.instantInKst) &&
    isSolarTimeCorrection(value.solarTimeCorrection) &&
    isDayBoundary(value.dayBoundary) &&
    isStringArray(value.warnings);
}

function isScenario(value: unknown) {
  if (!isRecord(value) ||
    !hasExactKeys(value, ['scenario', 'bazi', 'trace']) ||
    !isRecord(value.scenario) ||
    !hasExactKeys(value.scenario, [
      'id',
      'label',
      'branchIndex',
      'hour',
      'minute',
      'sourcePrecision',
      'sourceDayOffset'
    ]) ||
    !isBazi(value.bazi) ||
    !isCalculationTrace(value.trace)) {
    return false;
  }
  const scenario = value.scenario;
  const trace = value.trace as UnknownRecord;
  return typeof scenario.id === 'string' &&
    scenario.id.length > 0 &&
    typeof scenario.label === 'string' &&
    (scenario.branchIndex === null || isIntegerBetween(scenario.branchIndex, 0, 11)) &&
    isIntegerBetween(scenario.hour, 0, 23) &&
    isIntegerBetween(scenario.minute, 0, 59) &&
    isOneOf(scenario.sourcePrecision, TIME_PRECISIONS) &&
    isInteger(scenario.sourceDayOffset) &&
    trace.scenarioId === scenario.id;
}

function isCurrentDayun(value: unknown) {
  if (!isRecord(value) ||
    !hasExactKeys(value, ['phase', 'currentIndex', 'current', 'next']) ||
    !isOneOf(value.phase, ['pre-dayun', 'active'] as const) ||
    !(value.current === null || isDayunRow(value.current)) ||
    !(value.next === null || isDayunRow(value.next))) {
    return false;
  }
  return value.phase === 'pre-dayun'
    ? value.currentIndex === null && value.current === null
    : isInteger(value.currentIndex) && value.currentIndex >= 0 && value.current !== null;
}

function isExternalCalendarAudit(value: unknown) {
  return isRecord(value) &&
    hasExactKeys(value, [
      'provider',
      'status',
      'internalDayGanzhi',
      'providerDayGanzhi',
      'message'
    ]) &&
    value.provider === 'KASI' &&
    isOneOf(value.status, EXTERNAL_CALENDAR_STATUSES) &&
    typeof value.internalDayGanzhi === 'string' &&
    (value.providerDayGanzhi === null || typeof value.providerDayGanzhi === 'string') &&
    typeof value.message === 'string';
}

function isCommercialReleaseAudit(value: unknown) {
  return isRecord(value) &&
    hasExactKeys(value, [
      'version',
      'decision',
      'reproducibilityFingerprint',
      'evidenceCoverage',
      'externalCalendar',
      'blockers',
      'reviewFlags',
      'passedChecks',
      'claimPolicy'
    ]) &&
    value.version === COMMERCIAL_RELEASE_AUDIT_VERSION &&
    isOneOf(value.decision, RELEASE_DECISIONS) &&
    typeof value.reproducibilityFingerprint === 'string' &&
    isRecord(value.evidenceCoverage) &&
    hasExactKeys(value.evidenceCoverage, ['score', 'passed', 'total']) &&
    isFiniteNumber(value.evidenceCoverage.score) &&
    value.evidenceCoverage.score >= 0 &&
    value.evidenceCoverage.score <= 1 &&
    isInteger(value.evidenceCoverage.passed) &&
    value.evidenceCoverage.passed >= 0 &&
    isInteger(value.evidenceCoverage.total) &&
    value.evidenceCoverage.total > 0 &&
    value.evidenceCoverage.passed <= value.evidenceCoverage.total &&
    isExternalCalendarAudit(value.externalCalendar) &&
    isStringArray(value.blockers) &&
    isStringArray(value.reviewFlags) &&
    isStringArray(value.passedChecks) &&
    value.claimPolicy === 'reproducible-calculation-not-predictive-accuracy';
}

function validateInput(input: unknown): asserts input is UnknownRecord {
  invariant(isRecord(input) && hasExactKeys(input, [
    'gender',
    'calendar',
    'isLeapMonth',
    'date',
    'time',
    'timezone',
    'location',
    'policies'
  ]), 'input이 올바르지 않습니다.');
  invariant(isOneOf(input.gender, ['male', 'female'] as const),
    'input.gender가 올바르지 않습니다.');
  invariant(isOneOf(input.calendar, ['solar', 'lunar'] as const),
    'input.calendar가 올바르지 않습니다.');
  invariant(typeof input.isLeapMonth === 'boolean' && isCivilDate(input.date),
    'input 날짜가 올바르지 않습니다.');

  const time = input.time;
  invariant(isRecord(time) && hasExactKeys(time, [
    'precision',
    'hour',
    'minute',
    'representativeDayOffset',
    'range'
  ]) &&
    isOneOf(time.precision, TIME_PRECISIONS) &&
    isInteger(time.representativeDayOffset), 'input.time이 올바르지 않습니다.');
  if (time.precision === 'unknown') {
    invariant(time.hour === null && time.minute === null && time.range === null,
      'unknown time은 시간을 지정할 수 없습니다.');
  } else {
    invariant(isIntegerBetween(time.hour, 0, 23) && isIntegerBetween(time.minute, 0, 59),
      'input.time 시간값이 올바르지 않습니다.');
    invariant(time.precision === 'legacy-range'
      ? isBirthTimeRange(time.range)
      : time.range === null, 'input.time.range가 precision과 일치하지 않습니다.');
  }

  invariant(isRecord(input.timezone) &&
    hasExactKeys(input.timezone, ['id', 'utcOffsetMinutes']) &&
    typeof input.timezone.id === 'string' &&
    input.timezone.id.length > 0 &&
    isIntegerBetween(input.timezone.utcOffsetMinutes, -840, 840),
  'input.timezone이 올바르지 않습니다.');
  invariant(isRecord(input.location) &&
    hasExactKeys(input.location, ['longitude', 'source']) &&
    isOneOf(input.location.source, ['verified-coordinates', 'unavailable'] as const) &&
    (input.location.longitude === null ||
      isFiniteNumber(input.location.longitude) &&
      input.location.longitude >= -180 &&
      input.location.longitude <= 180) &&
    (input.location.source === 'verified-coordinates'
      ? input.location.longitude !== null
      : input.location.longitude === null), 'input.location이 올바르지 않습니다.');
  invariant(isRecord(input.policies) &&
    hasExactKeys(input.policies, ['dayBoundary', 'trueSolarTime']) &&
    isOneOf(input.policies.dayBoundary, ['civil-midnight', 'late-zi-next-day'] as const) &&
    isRecord(input.policies.trueSolarTime) &&
    hasExactKeys(input.policies.trueSolarTime, ['enabled', 'includeEquationOfTime']) &&
    typeof input.policies.trueSolarTime.enabled === 'boolean' &&
    typeof input.policies.trueSolarTime.includeEquationOfTime === 'boolean',
  'input.policies가 올바르지 않습니다.');
}

export function parseSajuFactsV1(value: unknown): SajuFactsV1 {
  invariant(isRecord(value), '객체가 아닙니다.');
  if (value.schemaVersion !== SAJU_FACTS_SCHEMA_VERSION) {
    throw new Error('지원하지 않는 사주 facts 버전입니다: ' + String(value.schemaVersion));
  }
  invariant(hasExactKeys(value, [
    'schemaVersion',
    'engineVersions',
    'asOf',
    'input',
    'natal',
    'dayun',
    'seun',
    'currentFlow',
    'release',
    'digests'
  ]), 'facts에 알 수 없거나 누락된 필드가 있습니다.');

  const engineVersions = value.engineVersions;
  invariant(isRecord(engineVersions) && hasExactKeys(engineVersions, [
    'myeongri',
    'calendar',
    'interpretation',
    'interaction',
    'compatibility',
    'releaseAudit'
  ]), 'engineVersions가 올바르지 않습니다.');
  for (const key of ['myeongri', 'calendar', 'interpretation', 'releaseAudit']) {
    invariant(typeof engineVersions[key] === 'string' && engineVersions[key].length > 0,
      'engineVersions.' + key + '가 올바르지 않습니다.');
  }
  invariant(engineVersions.interaction === null || typeof engineVersions.interaction === 'string',
    'engineVersions.interaction이 올바르지 않습니다.');
  invariant(engineVersions.compatibility === null || typeof engineVersions.compatibility === 'string',
    'engineVersions.compatibility가 올바르지 않습니다.');
  invariant(isIsoDateTime(value.asOf), 'asOf가 올바르지 않습니다.');

  validateInput(value.input);
  const input = value.input;

  const natal = value.natal;
  invariant(isRecord(natal) && hasExactKeys(natal, [
    'status',
    'selection',
    'selected',
    'scenarios',
    'invariantPillars'
  ]), 'natal이 올바르지 않습니다.');
  invariant(isOneOf(natal.status, NATAL_STATUSES), 'natal.status가 올바르지 않습니다.');
  invariant(isOneOf(natal.selection, NATAL_SELECTIONS), 'natal.selection이 올바르지 않습니다.');
  invariant(natal.selected === null || isBazi(natal.selected),
    'natal.selected가 올바르지 않습니다.');
  invariant(Array.isArray(natal.scenarios) &&
    natal.scenarios.length > 0 &&
    natal.scenarios.every(isScenario), 'natal.scenarios가 올바르지 않습니다.');
  invariant(isRecord(natal.invariantPillars) &&
    hasExactKeys(natal.invariantPillars, ['year', 'month', 'day']) &&
    typeof natal.invariantPillars.year === 'boolean' &&
    typeof natal.invariantPillars.month === 'boolean' &&
    typeof natal.invariantPillars.day === 'boolean',
  'natal.invariantPillars가 올바르지 않습니다.');
  const natalScenarioIds = new Set(natal.scenarios.map((item) =>
    ((item as UnknownRecord).scenario as UnknownRecord).id as string
  ));
  invariant(natalScenarioIds.size === natal.scenarios.length,
    'natal scenario id가 중복됩니다.');
  invariant(natal.scenarios.every((item) => {
    const trace = (item as UnknownRecord).trace as UnknownRecord;
    return trace.inputCalendar === input.calendar &&
      trace.inputTimePrecision === (input.time as UnknownRecord).precision;
  }), 'natal trace가 입력 계약과 일치하지 않습니다.');

  const dayun = value.dayun;
  invariant(isRecord(dayun) && hasExactKeys(dayun, [
    'status',
    'representativeKind',
    'representative',
    'scenarios',
    'current'
  ]), 'dayun이 올바르지 않습니다.');
  invariant(isOneOf(dayun.status, DAYUN_STATUSES) &&
    isOneOf(dayun.representativeKind, DAYUN_REPRESENTATIVE_KINDS),
  'dayun 상태가 올바르지 않습니다.');
  invariant(dayun.representative === null ||
    Array.isArray(dayun.representative) && dayun.representative.every(isDayunRow),
  'dayun 대표값이 올바르지 않습니다.');
  invariant(Array.isArray(dayun.scenarios) && dayun.scenarios.every((item) =>
    isRecord(item) &&
    hasExactKeys(item, ['scenarioId', 'rows']) &&
    typeof item.scenarioId === 'string' &&
    natalScenarioIds.has(item.scenarioId) &&
    Array.isArray(item.rows) &&
    item.rows.every(isDayunRow)
  ), 'dayun 시나리오가 올바르지 않습니다.');
  invariant(dayun.current === null || isCurrentDayun(dayun.current),
    'dayun.current가 올바르지 않습니다.');
  invariant(dayun.representativeKind === 'none'
    ? dayun.representative === null && dayun.current === null
    : Array.isArray(dayun.representative),
  'dayun representativeKind가 대표값과 일치하지 않습니다.');
  invariant(dayun.status !== 'unavailable' ||
    dayun.representativeKind === 'none' &&
      dayun.representative === null &&
      dayun.current === null,
  'unavailable dayun은 대표값이 없어야 합니다.');
  if (isRecord(dayun.current) &&
    dayun.current.phase === 'active' &&
    Array.isArray(dayun.representative)) {
    invariant((dayun.current.currentIndex as number) < dayun.representative.length,
      'dayun.currentIndex가 대표값 범위를 벗어납니다.');
  }

  invariant(Array.isArray(value.seun) && value.seun.every((item) =>
    isRecord(item) &&
    hasExactKeys(item, ['year', 'ganzhi', 'note']) &&
    isInteger(item.year) &&
    typeof item.ganzhi === 'string' &&
    typeof item.note === 'string'
  ), 'seun이 올바르지 않습니다.');

  const currentFlow = value.currentFlow;
  invariant(isRecord(currentFlow) && hasExactKeys(currentFlow, [
    'asOf',
    'timezone',
    'referenceClock',
    'referenceClockKst',
    'seunStartYear',
    'pillars'
  ]) &&
    currentFlow.asOf === value.asOf &&
    typeof currentFlow.timezone === 'string' &&
    currentFlow.timezone.length > 0 &&
    isCivilDateTime(currentFlow.referenceClock) &&
    isCivilDateTime(currentFlow.referenceClockKst) &&
    isInteger(currentFlow.seunStartYear) &&
    isRecord(currentFlow.pillars) &&
    hasExactKeys(currentFlow.pillars, ['year', 'month', 'day', 'hour']) &&
    isGz(currentFlow.pillars.year) &&
    isGz(currentFlow.pillars.month) &&
    isGz(currentFlow.pillars.day) &&
    (currentFlow.pillars.hour === null || isGz(currentFlow.pillars.hour)),
  'currentFlow가 올바르지 않습니다.');

  const release = value.release;
  invariant(isRecord(release) &&
    hasExactKeys(release, ['decision', 'audit', 'uncertainty']) &&
    isOneOf(release.decision, RELEASE_DECISIONS) &&
    isCommercialReleaseAudit(release.audit) &&
    (release.audit as UnknownRecord).decision === release.decision &&
    isStringArray(release.uncertainty), 'release가 올바르지 않습니다.');

  const digests = value.digests;
  invariant(isRecord(digests) &&
    hasExactKeys(digests, ['input', 'facts', 'algorithm']) &&
    digests.algorithm === 'fnv1a-128-v1' &&
    typeof digests.input === 'string' &&
    /^uwf-[0-9a-f]{32}$/.test(digests.input) &&
    typeof digests.facts === 'string' &&
    /^uwf-[0-9a-f]{32}$/.test(digests.facts),
  'digests가 올바르지 않습니다.');

  const facts = value as unknown as SajuFactsV1;
  const expectedInput = digestSajuFactsValue({
    schemaVersion: facts.schemaVersion,
    engineVersions: facts.engineVersions,
    asOf: facts.asOf,
    input: facts.input
  });
  invariant(facts.digests.input === expectedInput, 'input digest가 일치하지 않습니다.');
  const { digests: verifiedDigests, ...body } = facts;
  invariant(verifiedDigests.facts === digestSajuFactsValue(body),
    'facts digest가 일치하지 않습니다.');
  return facts;
}

export function isSajuFactsV1(value: unknown): value is SajuFactsV1 {
  try {
    parseSajuFactsV1(value);
    return true;
  } catch {
    return false;
  }
}
