import type { ServiceId, IntakeFormData } from '../api/mockData';
import type { AiReportProvider } from './aiReport';
import type { PaymentMethodType } from './auth';
import { getAdminReportsEndpoint, getReportArchiveEndpoint } from './runtimeConfig';
import type { SajuReportData } from './saju/report';

export type ReportArchiveEntry = {
  id: string;
  orderId?: string;
  productId: ServiceId;
  customerName: string;
  title: string;
  subtitle: string;
  createdAt: string;
  paymentMethod?: PaymentMethodType | string;
  formData?: Partial<IntakeFormData>;
  reportData: SajuReportData;
  reportProvider?: AiReportProvider;
};

const LEGACY_REPORT_ARCHIVE_KEY = 'unwoldang.report.archive';
const REPORT_ARCHIVE_KEY_PREFIX = 'unwoldang.report.archive.v2';

function getReportArchiveStorage(ownerId?: string) {
  return ownerId?.trim() ? window.localStorage : window.sessionStorage;
}

export function getReportArchiveStorageKey(ownerId?: string) {
  const normalizedOwner = ownerId?.trim().replace(/[^a-zA-Z0-9._@=-]/g, '') || 'guest';

  return `${REPORT_ARCHIVE_KEY_PREFIX}.${normalizedOwner}`;
}

function clearLegacySharedArchive() {
  window.localStorage.removeItem(LEGACY_REPORT_ARCHIVE_KEY);
}

function sortReportArchiveEntries(entries: ReportArchiveEntry[]) {
  return [...entries].sort((left, right) => Date.parse(right.createdAt || '') - Date.parse(left.createdAt || ''));
}

export const mergeReportArchiveEntries = (...groups: ReportArchiveEntry[][]) => {
  const map = new Map<string, ReportArchiveEntry>();

  groups.flat().forEach((entry) => {
    if (!entry?.id) {
      return;
    }

    map.set(entry.id, entry);
  });

  return sortReportArchiveEntries([...map.values()]).slice(0, 20);
};

export const readReportArchiveEntries = (ownerId?: string) => {
  if (typeof window === 'undefined') {
    return [] as ReportArchiveEntry[];
  }

  clearLegacySharedArchive();
  const storage = getReportArchiveStorage(ownerId);
  const storageKey = getReportArchiveStorageKey(ownerId);
  const raw = storage.getItem(storageKey);

  if (!raw) {
    return [] as ReportArchiveEntry[];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      storage.removeItem(storageKey);
      return [] as ReportArchiveEntry[];
    }

    return parsed as ReportArchiveEntry[];
  } catch {
    storage.removeItem(storageKey);
    return [] as ReportArchiveEntry[];
  }
};

export const saveReportArchiveEntry = (entry: ReportArchiveEntry, ownerId?: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const storage = getReportArchiveStorage(ownerId);
  const next = mergeReportArchiveEntries([entry], readReportArchiveEntries(ownerId));
  storage.setItem(getReportArchiveStorageKey(ownerId), JSON.stringify(next));
};

export const writeReportArchiveEntries = (entries: ReportArchiveEntry[], ownerId?: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const storage = getReportArchiveStorage(ownerId);
  storage.setItem(getReportArchiveStorageKey(ownerId), JSON.stringify(mergeReportArchiveEntries(entries)));
};

async function readArchiveResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as { entries?: ReportArchiveEntry[]; message?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.message || '리포트 보관함 API 요청에 실패했습니다.');
  }

  return Array.isArray(payload?.entries) ? payload.entries : [];
}

export async function fetchRemoteReportArchiveEntries(authToken?: string) {
  const endpoint = getReportArchiveEndpoint();

  if (!endpoint || !authToken) {
    return [] as ReportArchiveEntry[];
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  return readArchiveResponse(response);
}

export async function saveRemoteReportArchiveEntry(
  entry: ReportArchiveEntry,
  options: { authToken?: string; reportAccessToken?: string } = {}
) {
  const endpoint = getReportArchiveEndpoint();

  if (!endpoint || !options.authToken) {
    return false;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      entry,
      reportAccessToken: options.reportAccessToken
    })
  });

  if (!response.ok) {
    return false;
  }

  return true;
}

export async function fetchAdminReportArchiveEntries(adminAccessToken?: string) {
  const endpoint = getAdminReportsEndpoint();

  if (!endpoint || !adminAccessToken) {
    return [] as ReportArchiveEntry[];
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${adminAccessToken}`
    }
  });

  return readArchiveResponse(response);
}
