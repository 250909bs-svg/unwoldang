import type { AppConfig } from '../../config/env.ts';
import type { ReportAccessClaims } from '../../contracts/auth.ts';
import { ReportRequestError } from '../../contracts/errors.ts';
import { getOptionalString } from '../../http/validation.ts';

export type ArchiveEntry = Record<string, any> & {
  id: string;
  productId: string;
  orderId?: string;
  customerName: string;
  title: string;
  subtitle: string;
  createdAt: string;
  paymentMethod?: string;
  reportData: Record<string, unknown>;
};

export type ArchiveRepository = {
  upsert(userId: string, entry: ArchiveEntry, entryJson: string): Promise<void>;
  list(whereUserId?: string): Promise<any[]>;
};

type ArchiveTokenService = {
  verifyReportAccessToken(token: string): ReportAccessClaims;
  createUserBinding(userId: string): string;
};

function getTimestampValue(value?: unknown) {
  const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;

  if (Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString();
  }

  return new Date().toISOString();
}

export class ArchiveService {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: ArchiveRepository,
    private readonly tokens: ArchiveTokenService
  ) {}

  normalizeEntry(rawValue: unknown): ArchiveEntry {
    const raw = rawValue && typeof rawValue === 'object' ? (rawValue as Record<string, any>) : null;

    if (!raw) {
      throw new ReportRequestError(400, 'Archive entry is required.');
    }

    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
    const productId = typeof raw.productId === 'string' && raw.productId.trim() ? raw.productId.trim() : '';
    const reportData = raw.reportData && typeof raw.reportData === 'object' ? raw.reportData : null;

    if (!id || !productId || !reportData) {
      throw new ReportRequestError(400, 'Archive entry is incomplete.');
    }

    return {
      ...raw,
      id,
      productId,
      reportData,
      orderId: typeof raw.orderId === 'string' ? raw.orderId.trim() : undefined,
      customerName: typeof raw.customerName === 'string' && raw.customerName.trim() ? raw.customerName.trim() : '운월당 회원',
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '운월당 리포트',
      subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.trim() : '',
      createdAt: getTimestampValue(raw.createdAt),
      paymentMethod: typeof raw.paymentMethod === 'string' ? raw.paymentMethod.trim() : undefined
    };
  }

  private assertReportToken(entry: ArchiveEntry, body: Record<string, unknown>, userId: string) {
    if (!this.config.report.requireTokenForArchive) {
      return;
    }

    const reportToken = getOptionalString(body, 'reportAccessToken');

    if (!reportToken) {
      throw new ReportRequestError(401, 'Report access token is required for archive save.');
    }

    const payload = this.tokens.verifyReportAccessToken(reportToken);

    if (payload.userBinding !== this.tokens.createUserBinding(userId)) {
      throw new ReportRequestError(403, 'Report token does not belong to this login account.');
    }

    if (payload.orderId && entry.orderId && payload.orderId !== entry.orderId) {
      throw new ReportRequestError(403, 'Report token does not match this archive order.');
    }

    if (payload.productId && entry.productId && payload.productId !== entry.productId) {
      throw new ReportRequestError(403, 'Report token does not match this archive product.');
    }
  }

  async save(userId: string, body: Record<string, unknown>) {
    const entry = this.normalizeEntry(body.entry);
    this.assertReportToken(entry, body, userId);
    const entryJson = JSON.stringify(entry);

    if (entryJson.length > 900_000) {
      throw new ReportRequestError(413, 'Archive entry is too large.');
    }

    await this.repository.upsert(userId, entry, entryJson);
    return entry;
  }

  list(whereUserId?: string) {
    return this.repository.list(whereUserId);
  }
}
