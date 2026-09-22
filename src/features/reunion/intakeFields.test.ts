import { describe, expect, it } from 'vitest';
import {
  birthDigits,
  clockDigits,
  displayBirthDigits,
  EMPTY_CLOCK,
  fromIsoBirthDate,
  isBirthDigitsReady,
  isNotFuture,
  ledgerSummary,
  parseClock,
  toClockValue,
  toIsoBirthDate
} from './intakeFields';

describe('reunion intake field converters', () => {
  it('keeps only eight digits no matter what the IME hands over', () => {
    expect(birthDigits('1995.10.15')).toBe('19951015');
    expect(birthDigits('1995년 10월 15일')).toBe('19951015');
    expect(birthDigits('199510151234')).toBe('19951015');
    expect(clockDigits('9시')).toBe('9');
    expect(clockDigits('0930')).toBe('09');
  });

  it('formats progressively so the field reads as a date while it is typed', () => {
    expect(displayBirthDigits('19')).toBe('19');
    expect(displayBirthDigits('1995')).toBe('1995');
    expect(displayBirthDigits('199510')).toBe('1995.10');
    expect(displayBirthDigits('19951015')).toBe('1995.10.15');
  });

  it('refuses dates the calendar does not have', () => {
    expect(isBirthDigitsReady('19951015')).toBe(true);
    expect(isBirthDigitsReady('19990230')).toBe(false);
    expect(isBirthDigitsReady('20000229')).toBe(true);
    expect(isBirthDigitsReady('19951015'.slice(0, 7))).toBe(false);
    expect(isBirthDigitsReady('18991231')).toBe(false);
    expect(isBirthDigitsReady('19951340')).toBe(false);
  });

  it('lets the lunar calendar have a 30th but never a 31st', () => {
    // 음력은 큰달 30일까지다. 양력 기준 유효성으로 막으면 2월 30일이 통과한다.
    expect(isBirthDigitsReady('19950230', 'lunar')).toBe(true);
    expect(isBirthDigitsReady('19950231', 'lunar')).toBe(false);
    expect(isBirthDigitsReady('19950230', 'solar')).toBe(false);
  });

  it('round-trips between the typing buffer and the ISO the draft contract wants', () => {
    expect(toIsoBirthDate('19951015')).toBe('1995-10-15');
    expect(toIsoBirthDate('1995101')).toBe('');
    expect(toIsoBirthDate('19990230')).toBe('');
    expect(fromIsoBirthDate('1995-10-15')).toBe('19951015');
    expect(fromIsoBirthDate('')).toBe('');
    expect(fromIsoBirthDate('1995-10')).toBe('');
  });

  it('keeps the optional last-contact date out of the future', () => {
    expect(isNotFuture('19951015')).toBe(true);
    expect(isNotFuture('29951015')).toBe(false);
    expect(isNotFuture('1995101')).toBe(false);
  });

  it('splits and rebuilds the clock without ever touching a native picker', () => {
    expect(parseClock('09:30')).toEqual({ period: 'am', hour: '9', minute: '30' });
    expect(parseClock('21:05')).toEqual({ period: 'pm', hour: '9', minute: '05' });
    expect(parseClock('12:00')).toEqual({ period: 'pm', hour: '12', minute: '00' });
    expect(parseClock('00:00')).toEqual({ period: 'am', hour: '12', minute: '00' });
    expect(parseClock('9:30')).toEqual(EMPTY_CLOCK);
    expect(parseClock('')).toEqual(EMPTY_CLOCK);

    expect(toClockValue({ period: 'am', hour: '9', minute: '30' })).toBe('09:30');
    expect(toClockValue({ period: 'pm', hour: '9', minute: '5' })).toBe('21:05');
    expect(toClockValue({ period: 'am', hour: '12', minute: '00' })).toBe('00:00');
    expect(toClockValue({ period: 'pm', hour: '12', minute: '00' })).toBe('12:00');
    expect(toClockValue({ period: '', hour: '9', minute: '30' })).toBe('');
    expect(toClockValue({ period: 'am', hour: '13', minute: '30' })).toBe('');
    expect(toClockValue({ period: 'am', hour: '9', minute: '61' })).toBe('');
  });

  it('never invents a value the ledger does not have', () => {
    expect(ledgerSummary({
      calendar: 'solar', isLeapMonth: false, birthDate: '', birthTime: '', isUnknownTime: false
    })).toBe('—');

    expect(ledgerSummary({
      calendar: 'solar', isLeapMonth: false, birthDate: '1995-10-15', birthTime: '09:30', isUnknownTime: false
    })).toBe('양력 1995.10.15 · 09:30');

    expect(ledgerSummary({
      calendar: 'lunar', isLeapMonth: true, birthDate: '1995-10-15', birthTime: '', isUnknownTime: true
    })).toBe('윤달 1995.10.15 · 시간 모름');

    expect(ledgerSummary({
      calendar: 'lunar', isLeapMonth: false, birthDate: '1995-10-15', birthTime: '', isUnknownTime: false
    })).toBe('음력 1995.10.15');
  });
});
