import type { ServiceId, IntakeFormData } from '../api/mockData';
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
};

const REPORT_ARCHIVE_KEY = 'unwoldang.report.archive';

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

export const readReportArchiveEntries = () => {
  if (typeof window === 'undefined') {
    return [] as ReportArchiveEntry[];
  }

  const raw = window.localStorage.getItem(REPORT_ARCHIVE_KEY);

  if (!raw) {
    return [] as ReportArchiveEntry[];
  }

  try {
    return JSON.parse(raw) as ReportArchiveEntry[];
  } catch {
    window.localStorage.removeItem(REPORT_ARCHIVE_KEY);
    return [] as ReportArchiveEntry[];
  }
};

export const saveReportArchiveEntry = (entry: ReportArchiveEntry) => {
  if (typeof window === 'undefined') {
    return;
  }

  const next = mergeReportArchiveEntries([entry], readReportArchiveEntries());
  window.localStorage.setItem(REPORT_ARCHIVE_KEY, JSON.stringify(next));
};

export const writeReportArchiveEntries = (entries: ReportArchiveEntry[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(REPORT_ARCHIVE_KEY, JSON.stringify(mergeReportArchiveEntries(entries)));
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
