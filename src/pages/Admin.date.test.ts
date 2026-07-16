import { describe, expect, it } from 'vitest';
import {
  getAdminDateRange,
  getComparisonDateRange,
  getDefaultGranularity,
  getRangeDays
} from './Admin';

const referenceDate = new Date(2026, 6, 16, 16, 30, 0, 0);

function expectDateParts(date: Date, year: number, month: number, day: number) {
  expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([year, month, day]);
}

describe('admin analytics date ranges', () => {
  it('starts monthly, quarterly and yearly presets on their calendar boundaries', () => {
    const month = getAdminDateRange('month', [], '', '', referenceDate);
    const quarter = getAdminDateRange('quarter', [], '', '', referenceDate);
    const year = getAdminDateRange('year', [], '', '', referenceDate);

    expectDateParts(month.start, 2026, 7, 1);
    expectDateParts(quarter.start, 2026, 7, 1);
    expectDateParts(year.start, 2026, 1, 1);
    expect(month.end.getTime()).toBe(referenceDate.getTime());
  });

  it('keeps a custom end date inclusive through the end of the day', () => {
    const range = getAdminDateRange('custom', [], '2026-02-10', '2026-02-12', referenceDate);

    expectDateParts(range.start, 2026, 2, 10);
    expectDateParts(range.end, 2026, 2, 12);
    expect([range.end.getHours(), range.end.getMinutes(), range.end.getSeconds(), range.end.getMilliseconds()]).toEqual([
      23,
      59,
      59,
      999
    ]);
    expect(getRangeDays(range)).toBe(3);
  });

  it('maps the same selected dates to the previous year for year-over-year comparison', () => {
    const range = getAdminDateRange('custom', [], '2026-03-01', '2026-03-31', referenceDate);
    const comparison = getComparisonDateRange(range, 'yearAgo');

    expect(comparison).toBeDefined();
    expectDateParts(comparison!.start, 2025, 3, 1);
    expectDateParts(comparison!.end, 2025, 3, 31);
  });

  it('uses the immediately preceding range for prior-period comparison', () => {
    const range = getAdminDateRange('custom', [], '2026-07-10', '2026-07-16', referenceDate);
    const comparison = getComparisonDateRange(range, 'previous');

    expect(comparison).toBeDefined();
    expectDateParts(comparison!.start, 2026, 7, 3);
    expectDateParts(comparison!.end, 2026, 7, 9);
  });

  it('selects a readable graph unit for each preset scale', () => {
    expect(getDefaultGranularity('today')).toBe('hour');
    expect(getDefaultGranularity('30d')).toBe('day');
    expect(getDefaultGranularity('quarter')).toBe('week');
    expect(getDefaultGranularity('year')).toBe('month');
  });
});
