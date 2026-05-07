import type { ServiceId, IntakeFormData } from '../api/mockData';
import type { PaymentMethodType } from './auth';
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

  const current = readReportArchiveEntries();
  const filtered = current.filter((item) => item.id !== entry.id);
  const next = [entry, ...filtered].slice(0, 20);
  window.localStorage.setItem(REPORT_ARCHIVE_KEY, JSON.stringify(next));
};
