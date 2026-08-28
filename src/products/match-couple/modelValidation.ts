import { ELEM_ORDER } from '../../lib/saju/constants';
import type { MatchCoupleReportModel } from './types';

const guidanceKeys = [
  'attraction',
  'emotionalExpression',
  'communication',
  'conflictRecovery',
  'dailyLife',
  'money',
  'longTermRoles'
] as const;

const fiveElements = ELEM_ORDER;
const tendencies = ['supportive', 'conditional', 'tension', 'insufficient'] as const;
const relationGroupIds = ['combine', 'clash', 'punishment', 'break', 'harm'] as const;
const relationshipStatuses = [
  '',
  'situationship',
  'dating',
  'ambiguous',
  'breakup-reunion',
  'married'
] as const;
const relationshipDurations = ['', 'under1', 'under3', 'under5', 'under10', 'over10'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isStringTuple(value: unknown): value is [string, string] {
  return Array.isArray(value) && value.length === 2 && isStringArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOneOf(value: unknown, values: readonly string[]): value is string {
  return typeof value === 'string' && values.includes(value);
}

function isAvailability(value: unknown) {
  if (!isRecord(value) || !isOneOf(value.status, ['available', 'limited', 'unavailable'])) return false;
  if (value.status === 'available') return value.note === undefined || typeof value.note === 'string';
  return typeof value.note === 'string';
}

function isPerson(value: unknown) {
  if (value === null) return true;
  if (!isRecord(value) || !isOneOf(value.id, ['self', 'partner'])) return false;

  const pillars = value.pillars;
  const spousePalace = value.spousePalace;
  if (!isRecord(pillars) || !isRecord(spousePalace)) return false;

  return (
    typeof value.name === 'string' &&
    typeof value.dayMaster === 'string' &&
    isOneOf(value.dayMasterElement, fiveElements) &&
    typeof pillars.year === 'string' &&
    typeof pillars.month === 'string' &&
    typeof pillars.day === 'string' &&
    (pillars.hour === null || typeof pillars.hour === 'string') &&
    Array.isArray(value.fiveElements) &&
    value.fiveElements.every(
      (item) => isRecord(item) && isOneOf(item.label, fiveElements) && isFiniteNumber(item.weight)
    ) &&
    Array.isArray(value.tenGods) &&
    value.tenGods.every(
      (item) => isRecord(item) && typeof item.label === 'string' && isFiniteNumber(item.weight)
    ) &&
    typeof spousePalace.branch === 'string' &&
    isOneOf(spousePalace.element, fiveElements) &&
    typeof spousePalace.tenGod === 'string' &&
    isAvailability(value.availability)
  );
}

function isDimension(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    isOneOf(value.tendency, tendencies) &&
    typeof value.statement === 'string' &&
    isStringArray(value.evidenceIds) &&
    isStringArray(value.uncertainty)
  );
}

function isGuidanceItem(value: unknown) {
  return isRecord(value) && isDimension(value) && typeof value.practicalRule === 'string';
}

function isGuidance(value: unknown) {
  if (value === null) return true;
  if (!isRecord(value) || Object.keys(value).length !== guidanceKeys.length) return false;
  return guidanceKeys.every((key) => isGuidanceItem(value[key]));
}

function isRelationItem(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.subtype === 'string' &&
    typeof value.description === 'string' &&
    isStringArray(value.evidenceIds) &&
    isStringArray(value.uncertainty)
  );
}

function isRelationGroup(value: unknown) {
  return (
    isRecord(value) &&
    isOneOf(value.id, relationGroupIds) &&
    typeof value.label === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(isRelationItem)
  );
}

function isExperimentItem(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.days === 'string' &&
    typeof value.title === 'string' &&
    typeof value.action === 'string' &&
    typeof value.check === 'string'
  );
}

function isContext(value: unknown) {
  return (
    isRecord(value) &&
    value.version === 'match-couple-v1' &&
    isOneOf(value.relationshipStatus, relationshipStatuses) &&
    isOneOf(value.relationshipDuration, relationshipDurations) &&
    typeof value.majorConflict === 'string' &&
    typeof value.desiredInsight === 'string' &&
    isStringTuple(value.questions) &&
    typeof value.selfLocationUnknown === 'boolean' &&
    typeof value.partnerLocationUnknown === 'boolean' &&
    typeof value.selfSolarTimeCorrectionRequested === 'boolean' &&
    typeof value.partnerSolarTimeCorrectionRequested === 'boolean'
  );
}

function isGeneratedFrom(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.calendarEngine === 'string' &&
    (value.compatibilityEngine === null || value.compatibilityEngine === '2.0.0')
  );
}

export function isMatchCoupleReportModel(value: unknown): value is MatchCoupleReportModel {
  if (!isRecord(value) || value.version !== 'match-couple-report-v1') return false;
  if (!isStringTuple(value.names)) return false;
  if (!Array.isArray(value.people) || value.people.length !== 2 || !value.people.every(isPerson)) return false;
  if (!Array.isArray(value.relations) || !value.relations.every(isRelationGroup)) return false;
  if (!isGuidance(value.guidance)) return false;
  if (!isStringTuple(value.questions)) return false;

  return (
    typeof value.relationshipSummary === 'string' &&
    isContext(value.context) &&
    (value.overview === null || isDimension(value.overview)) &&
    isStringArray(value.cautionWords) &&
    isStringArray(value.cautionActions) &&
    isStringArray(value.relationshipRules) &&
    Array.isArray(value.experiment) &&
    value.experiment.every(isExperimentItem) &&
    isStringArray(value.limitations) &&
    isStringArray(value.evidenceIds) &&
    isGeneratedFrom(value.generatedFrom)
  );
}
