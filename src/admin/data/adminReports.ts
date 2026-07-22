import type { ReportArchiveEntry } from '../../lib/reportArchive';

export function normalizeAdminReportEntries(entries: ReportArchiveEntry[]) {
  const entriesById = new Map<string, ReportArchiveEntry>();

  entries.forEach((entry) => {
    if (!entry?.id) {
      return;
    }

    const current = entriesById.get(entry.id);
    const entryTimestamp = Date.parse(entry.createdAt || '') || 0;
    const currentTimestamp = Date.parse(current?.createdAt || '') || 0;

    if (!current || entryTimestamp >= currentTimestamp) {
      entriesById.set(entry.id, entry);
    }
  });

  return [...entriesById.values()].sort(
    (left, right) => Date.parse(right.createdAt || '') - Date.parse(left.createdAt || '')
  );
}

export function selectVisibleAdminReports(
  reports: ReportArchiveEntry[],
  adminAccessToken: string,
  verifiedToken: string
) {
  return adminAccessToken && verifiedToken !== adminAccessToken ? [] : reports;
}
