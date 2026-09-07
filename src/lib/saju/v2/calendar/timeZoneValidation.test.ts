import { describe, expect, it } from 'vitest';
import type { CivilDateTime } from './types';
import {
  assertResolvableLocalDateTime,
  assertValidIanaTimeZone,
  resolveLocalDateTime
} from './timeZoneValidation';

function local(value: string): CivilDateTime {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid test local datetime: ${value}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5])
  };
}

function status(value: string, timeZone: string) {
  return resolveLocalDateTime(local(value), timeZone);
}

describe('IANA local civil-time round-trip validation', () => {
  it.each([
    ['2024-03-10T01:59', 'valid-unique', [-300]],
    ['2024-03-10T02:00', 'nonexistent', []],
    ['2024-03-10T02:30', 'nonexistent', []],
    ['2024-03-10T02:59', 'nonexistent', []],
    ['2024-03-10T03:00', 'valid-unique', [-240]],
    ['2024-03-10T03:01', 'valid-unique', [-240]],
    ['2024-11-03T00:59', 'valid-unique', [-240]],
    ['2024-11-03T01:00', 'ambiguous', [-240, -300]],
    ['2024-11-03T01:30', 'ambiguous', [-240, -300]],
    ['2024-11-03T01:59', 'ambiguous', [-240, -300]],
    ['2024-11-03T02:00', 'valid-unique', [-300]],
    ['2024-11-03T02:01', 'valid-unique', [-300]]
  ] as const)('classifies New York %s as %s', (value, expectedStatus, expectedOffsets) => {
    const result = status(value, 'America/New_York');
    expect(result.status).toBe(expectedStatus);
    expect(result.candidates.map((candidate) => candidate.utcOffsetMinutes)).toEqual(expectedOffsets);
  });

  it.each([
    ['2024-03-31T00:59', 'valid-unique', [0]],
    ['2024-03-31T01:00', 'nonexistent', []],
    ['2024-03-31T01:30', 'nonexistent', []],
    ['2024-03-31T01:59', 'nonexistent', []],
    ['2024-03-31T02:00', 'valid-unique', [60]],
    ['2024-10-27T00:59', 'valid-unique', [60]],
    ['2024-10-27T01:00', 'ambiguous', [60, 0]],
    ['2024-10-27T01:30', 'ambiguous', [60, 0]],
    ['2024-10-27T01:59', 'ambiguous', [60, 0]],
    ['2024-10-27T02:00', 'valid-unique', [0]]
  ] as const)('classifies London %s as %s', (value, expectedStatus, expectedOffsets) => {
    const result = status(value, 'Europe/London');
    expect(result.status).toBe(expectedStatus);
    expect(result.candidates.map((candidate) => candidate.utcOffsetMinutes)).toEqual(expectedOffsets);
  });

  it.each([
    ['2024-03-10T01:59', 'valid-unique', [-480]],
    ['2024-03-10T02:00', 'nonexistent', []],
    ['2024-03-10T02:30', 'nonexistent', []],
    ['2024-03-10T02:59', 'nonexistent', []],
    ['2024-03-10T03:00', 'valid-unique', [-420]],
    ['2024-11-03T00:59', 'valid-unique', [-420]],
    ['2024-11-03T01:00', 'ambiguous', [-420, -480]],
    ['2024-11-03T01:30', 'ambiguous', [-420, -480]],
    ['2024-11-03T01:59', 'ambiguous', [-420, -480]],
    ['2024-11-03T02:00', 'valid-unique', [-480]]
  ] as const)('classifies Los Angeles %s as %s', (value, expectedStatus, expectedOffsets) => {
    const result = status(value, 'America/Los_Angeles');
    expect(result.status).toBe(expectedStatus);
    expect(result.candidates.map((candidate) => candidate.utcOffsetMinutes)).toEqual(expectedOffsets);
  });

  it('requires an explicit matching offset for an ambiguous wall-clock time', () => {
    const value = local('2024-11-03T01:30');

    expect(() => assertResolvableLocalDateTime(value, 'America/New_York'))
      .toThrow(/두 번 존재/);
    expect(assertResolvableLocalDateTime(value, 'America/New_York', -240).selected.instant.toISOString())
      .toBe('2024-11-03T05:30:00.000Z');
    expect(assertResolvableLocalDateTime(value, 'America/New_York', -300).selected.instant.toISOString())
      .toBe('2024-11-03T06:30:00.000Z');
    expect(() => assertResolvableLocalDateTime(value, 'America/New_York', -360))
      .toThrow(/오프셋/);
  });

  it('rejects a DST gap rather than shifting it forward', () => {
    expect(() => assertResolvableLocalDateTime(
      local('2024-03-10T02:30'),
      'America/New_York',
      -300
    )).toThrow(/해당 시간이 존재하지/);
  });

  it.each([
    ['1999-04-04T01:59', 'valid-unique'],
    ['1999-04-04T02:30', 'nonexistent'],
    ['1999-04-04T03:00', 'valid-unique'],
    ['1999-10-31T01:30', 'ambiguous'],
    ['2000-03-26T01:30', 'nonexistent'],
    ['2000-10-29T01:30', 'ambiguous']
  ] as const)('uses historical tzdb rules for %s', (value, expectedStatus) => {
    const zone = value.startsWith('1999') ? 'America/New_York' : 'Europe/London';
    expect(status(value, zone).status).toBe(expectedStatus);
  });

  it.each([
    ['1992-09-09T10:24', 'Asia/Seoul', 540],
    ['1988-08-08T08:08', 'Asia/Tokyo', 540]
  ] as const)('keeps non-DST %s in %s unique', (value, zone, offset) => {
    const result = status(value, zone);
    expect(result.status).toBe('valid-unique');
    expect(result.candidates[0]?.utcOffsetMinutes).toBe(offset);
  });

  it('accepts canonical IANA identifiers and rejects ambiguous abbreviations', () => {
    expect(() => assertValidIanaTimeZone('UTC')).not.toThrow();
    expect(() => assertValidIanaTimeZone('America/New_York')).not.toThrow();
    expect(() => assertValidIanaTimeZone('EST')).toThrow(/IANA 시간대/);
  });
});
