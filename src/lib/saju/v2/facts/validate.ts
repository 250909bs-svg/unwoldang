import { digestSajuFactsValue } from './digest';
import { SAJU_FACTS_SCHEMA_VERSION, type SajuFactsV1 } from './types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`saju-facts-v1 검증 실패: ${message}`);
  }
}

function isDate(value: unknown): value is UnknownRecord {
  return isRecord(value) &&
    isFiniteNumber(value.year) &&
    isFiniteNumber(value.month) &&
    isFiniteNumber(value.day);
}

function isDateTime(value: unknown): value is UnknownRecord {
  return isDate(value) &&
    isFiniteNumber(value.hour) &&
    isFiniteNumber(value.minute);
}

function isGz(value: unknown) {
  return isRecord(value) &&
    isFiniteNumber(value.tg) && Number.isInteger(value.tg) &&
    isFiniteNumber(value.dz) && Number.isInteger(value.dz) &&
    Number(value.tg) >= 0 && Number(value.tg) < 10 &&
    Number(value.dz) >= 0 && Number(value.dz) < 12;
}

function isBazi(value: unknown) {
  if (!isRecord(value)) return false;
  return isGz(value.y_gz) &&
    isGz(value.m_gz) &&
    isGz(value.d_gz) &&
    (value.h_gz === null || isGz(value.h_gz)) &&
    Array.isArray(value.solar) &&
    value.solar.length === 3 &&
    value.solar.every(isFiniteNumber) &&
    (value.lunar_in === null || typeof value.lunar_in === 'string') &&
    isFiniteNumber(value.start_age) &&
    typeof value.forward === 'boolean' &&
    isRecord(value.calculationBasis) &&
    typeof value.calculationBasis.ipchun === 'string' &&
    typeof value.calculationBasis.isAfterIpchun === 'boolean';
}

function isDayunRow(value: unknown) {
  return isRecord(value) &&
    isFiniteNumber(value.period) &&
    typeof value.age === 'string' &&
    isFiniteNumber(value.year) &&
    typeof value.ganzhi === 'string' &&
    typeof value.tenGod === 'string' &&
    isFiniteNumber(value.luckStrength);
}

function isScenario(value: unknown) {
  if (!isRecord(value) ||
    !isRecord(value.scenario) ||
    !isBazi(value.bazi) ||
    !isRecord(value.trace)) {
    return false;
  }

  const scenario = value.scenario;
  const trace = value.trace;
  return typeof scenario.id === 'string' &&
    typeof scenario.label === 'string' &&
    isFiniteNumber(scenario.hour) &&
    isFiniteNumber(scenario.minute) &&
    typeof trace.scenarioId === 'string' &&
    isDate(trace.inputDate) &&
    isDate(trace.normalizedSolarDate) &&
    isDateTime(trace.inputCivilDateTime) &&
    isDateTime(trace.instantInKst) &&
    isRecord(trace.solarTimeCorrection) &&
    isRecord(trace.dayBoundary) &&
    isStringArray(trace.warnings);
}

export function parseSajuFactsV1(value: unknown): SajuFactsV1 {
  invariant(isRecord(value), '객체가 아닙니다.');
  if (value.schemaVersion !== SAJU_FACTS_SCHEMA_VERSION) {
    throw new Error(`지원하지 않는 사주 facts 버전입니다: ${String(value.schemaVersion)}`);
  }

  const engineVersions = value.engineVersions;
  invariant(isRecord(engineVersions), 'engineVersions가 없습니다.');
  for (const key of ['myeongri', 'calendar', 'interpretation', 'releaseAudit']) {
    invariant(typeof engineVersions[key] === 'string', `engineVersions.${key}가 올바르지 않습니다.`);
  }
  invariant(engineVersions.interaction === null || typeof engineVersions.interaction === 'string',
    'engineVersions.interaction이 올바르지 않습니다.');
  invariant(engineVersions.compatibility === null || typeof engineVersions.compatibility === 'string',
    'engineVersions.compatibility가 올바르지 않습니다.');
  invariant(typeof value.asOf === 'string' && Number.isFinite(Date.parse(value.asOf)),
    'asOf가 올바르지 않습니다.');

  const input = value.input;
  invariant(isRecord(input), 'input이 없습니다.');
  invariant(input.gender === 'male' || input.gender === 'female', 'input.gender가 올바르지 않습니다.');
  invariant(input.calendar === 'solar' || input.calendar === 'lunar', 'input.calendar가 올바르지 않습니다.');
  invariant(typeof input.isLeapMonth === 'boolean' && isDate(input.date), 'input 날짜가 올바르지 않습니다.');
  invariant(isRecord(input.time) && isRecord(input.timezone) &&
    isRecord(input.location) && isRecord(input.policies), 'input 계산 정책이 없습니다.');

  const natal = value.natal;
  invariant(isRecord(natal), 'natal이 없습니다.');
  invariant(['stable', 'ambiguous', 'degraded'].includes(String(natal.status)),
    'natal.status가 올바르지 않습니다.');
  invariant(natal.selected === null || isBazi(natal.selected), 'natal.selected가 올바르지 않습니다.');
  invariant(Array.isArray(natal.scenarios) &&
    natal.scenarios.length > 0 &&
    natal.scenarios.every(isScenario), 'natal.scenarios가 올바르지 않습니다.');

  const dayun = value.dayun;
  invariant(isRecord(dayun), 'dayun이 없습니다.');
  invariant(dayun.representative === null ||
    Array.isArray(dayun.representative) && dayun.representative.every(isDayunRow),
  'dayun 대표값이 올바르지 않습니다.');
  invariant(Array.isArray(dayun.scenarios) && dayun.scenarios.every((item) =>
    isRecord(item) &&
    typeof item.scenarioId === 'string' &&
    Array.isArray(item.rows) &&
    item.rows.every(isDayunRow)
  ), 'dayun 시나리오가 올바르지 않습니다.');

  invariant(Array.isArray(value.seun) && value.seun.every((item) =>
    isRecord(item) &&
    isFiniteNumber(item.year) &&
    typeof item.ganzhi === 'string' &&
    typeof item.note === 'string'
  ), 'seun이 올바르지 않습니다.');

  const currentFlow = value.currentFlow;
  invariant(isRecord(currentFlow) &&
    currentFlow.asOf === value.asOf &&
    isRecord(currentFlow.pillars) &&
    isGz(currentFlow.pillars.year) &&
    isGz(currentFlow.pillars.month) &&
    isGz(currentFlow.pillars.day) &&
    (currentFlow.pillars.hour === null || isGz(currentFlow.pillars.hour)),
  'currentFlow가 올바르지 않습니다.');

  const release = value.release;
  invariant(isRecord(release) &&
    isRecord(release.audit) &&
    isStringArray(release.uncertainty), 'release가 올바르지 않습니다.');

  const digests = value.digests;
  invariant(isRecord(digests) &&
    digests.algorithm === 'fnv1a-128-v1' &&
    typeof digests.input === 'string' &&
    typeof digests.facts === 'string', 'digests가 올바르지 않습니다.');

  const facts = value as unknown as SajuFactsV1;
  const expectedInput = digestSajuFactsValue({
    schemaVersion: facts.schemaVersion,
    engineVersions: facts.engineVersions,
    asOf: facts.asOf,
    input: facts.input
  });
  invariant(facts.digests.input === expectedInput, 'input digest가 일치하지 않습니다.');
  const { digests: verifiedDigests, ...body } = facts;
  invariant(verifiedDigests.facts === digestSajuFactsValue(body), 'facts digest가 일치하지 않습니다.');
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
