import { describe, expect, it } from 'vitest';
import type { ReportArchiveEntry } from '../../lib/reportArchive';
import { normalizeAdminReportEntries, selectVisibleAdminReports } from './adminReports';

function entry(id: string, createdAt: string, title = id) {
  return { id, createdAt, title } as unknown as ReportArchiveEntry;
}

describe('admin report archive normalization', () => {
  it('does not apply the customer archive twenty-entry limit', () => {
    const remoteEntries = Array.from({ length: 100 }, (_, index) =>
      entry(`remote-${index}`, new Date(2026, 0, index + 1).toISOString())
    );

    expect(normalizeAdminReportEntries(remoteEntries)).toHaveLength(100);
  });

  it('deduplicates ids and sorts newest first', () => {
    const normalized = normalizeAdminReportEntries([
      entry('same', '2026-07-22T00:00:00.000Z', 'newer duplicate'),
      entry('older', '2026-07-19T00:00:00.000Z'),
      entry('same', '2026-07-20T00:00:00.000Z', 'older duplicate')
    ]);

    expect(normalized.map((value) => value.id)).toEqual(['same', 'older']);
    expect(normalized[0].title).toBe('newer duplicate');
  });

  it('hides local state synchronously until a new server token is verified', () => {
    const reports = [entry('local', '2026-07-22T00:00:00.000Z')];

    expect(selectVisibleAdminReports(reports, 'new-token', '')).toEqual([]);
    expect(selectVisibleAdminReports(reports, 'new-token', 'old-token')).toEqual([]);
    expect(selectVisibleAdminReports(reports, 'new-token', 'new-token')).toBe(reports);
    expect(selectVisibleAdminReports(reports, '', '')).toBe(reports);
  });
});
