import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../../../api/mockData';
import { buildDeterministicSajuBasis } from '../../deterministicBasis';
import { buildSajuReport } from '../../reportBuilder';
import { parseSajuFactsV1 } from '.';

const AS_OF = '2026-07-22T03:00:00.000Z';

function intake(overrides: Partial<IntakeFormData> = {}): Partial<IntakeFormData> {
  return {
    name: 'PII-NAME-MUST-NOT-LEAK',
    gender: 'female',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-09-09',
    birthTime: '09:36',
    isUnknownTime: false,
    birthTimePrecision: 'exact',
    dayBoundaryPolicy: 'midnight',
    location: 'PII-LOCATION-MUST-NOT-LEAK',
    q1: 'PII-QUESTION-ONE-MUST-NOT-LEAK',
    q2: 'PII-QUESTION-TWO-MUST-NOT-LEAK',
    ...overrides
  };
}

function build(overrides: Partial<IntakeFormData> = {}) {
  return buildDeterministicSajuBasis(
    'general-signature',
    intake(overrides),
    undefined,
    { asOf: AS_OF }
  );
}

describe('saju-facts-v1', () => {
  it('round-trips through JSON and rejects unknown schema versions', () => {
    const facts = build().facts;
    expect(parseSajuFactsV1(JSON.parse(JSON.stringify(facts)))).toEqual(facts);
    expect(() => parseSajuFactsV1({ ...facts, schemaVersion: 'saju-facts-v999' }))
      .toThrow(/지원하지 않는 사주 facts 버전/);
  });

  it('is deterministic for the same canonical input and fixed asOf', () => {
    const first = build();
    const second = build();
    expect(second.facts).toEqual(first.facts);
    expect(first.facts.currentFlow.asOf).toBe(AS_OF);
    expect(buildSajuReport('general-signature', intake(), first).createdAt).toBe(AS_OF);
  });

  it('changes the input digest when a calculation policy changes', () => {
    const midnight = build({ dayBoundaryPolicy: 'midnight' }).facts;
    const lateZi = build({ dayBoundaryPolicy: 'late-zi' }).facts;
    expect(lateZi.digests.input).not.toBe(midnight.digests.input);
    expect(lateZi.input.policies.dayBoundary).toBe('late-zi-next-day');
  });

  it('excludes names, free-text locations, and questions', () => {
    const serialized = JSON.stringify(build().facts);
    expect(serialized).not.toContain('PII-NAME-MUST-NOT-LEAK');
    expect(serialized).not.toContain('PII-LOCATION-MUST-NOT-LEAK');
    expect(serialized).not.toContain('PII-QUESTION-ONE-MUST-NOT-LEAK');
    expect(serialized).not.toContain('PII-QUESTION-TWO-MUST-NOT-LEAK');
  });

  it('retains all unknown-time traces without inventing a representative dayun', () => {
    const facts = build({
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown'
    }).facts;
    expect(facts.natal.status).toBe('degraded');
    expect(facts.natal.scenarios).toHaveLength(13);
    expect(facts.natal.scenarios.every(({ trace }) => Boolean(trace.dayBoundary))).toBe(true);
    expect(facts.dayun.status).toBe('scenario-dependent');
    expect(facts.dayun.representative).toBeNull();
    expect(facts.dayun.current).toBeNull();
    expect(facts.dayun.scenarios).toHaveLength(13);
  });

  it('marks a late-zi unknown-time chart as ambiguous', () => {
    const facts = build({
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown',
      dayBoundaryPolicy: 'late-zi'
    }).facts;
    expect(facts.natal.status).toBe('ambiguous');
    expect(facts.natal.selected).toBeNull();
    expect(facts.dayun.status).toBe('unavailable');
  });
});
