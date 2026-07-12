import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getReportArchiveStorageKey,
  readReportArchiveEntries,
  saveReportArchiveEntry,
  type ReportArchiveEntry
} from './reportArchive';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}

function buildEntry(id: string, customerName: string): ReportArchiveEntry {
  return {
    id,
    productId: 'general-signature',
    customerName,
    title: '운월당 종합사주',
    subtitle: '테스트 리포트',
    createdAt: '2026-07-12T00:00:00.000Z',
    reportData: {} as ReportArchiveEntry['reportData']
  };
}

describe('local report archive isolation', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: createMemoryStorage(),
        sessionStorage: createMemoryStorage()
      }
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('stores logged-in reports under separate account keys', () => {
    saveReportArchiveEntry(buildEntry('report-a', '사용자 A'), 'kakao-a');
    saveReportArchiveEntry(buildEntry('report-b', '사용자 B'), 'kakao-b');

    expect(readReportArchiveEntries('kakao-a').map((entry) => entry.id)).toEqual(['report-a']);
    expect(readReportArchiveEntries('kakao-b').map((entry) => entry.id)).toEqual(['report-b']);
  });

  it('keeps guest reports in session storage only', () => {
    saveReportArchiveEntry(buildEntry('guest-report', '비회원'));

    expect(window.sessionStorage.getItem(getReportArchiveStorageKey())).toContain('guest-report');
    expect(window.localStorage.getItem(getReportArchiveStorageKey())).toBeNull();
  });

  it('removes the legacy shared archive instead of assigning it to another account', () => {
    window.localStorage.setItem('unwoldang.report.archive', JSON.stringify([buildEntry('legacy', '이전 사용자')]));

    expect(readReportArchiveEntries('new-user')).toEqual([]);
    expect(window.localStorage.getItem('unwoldang.report.archive')).toBeNull();
  });
});
