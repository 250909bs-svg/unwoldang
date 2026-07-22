import type { AppConfig } from '../../config/env.ts';
import type { ReportAccessClaims } from '../../contracts/auth.ts';
import { ReportRequestError } from '../../contracts/errors.ts';
import { assertNoServerSecretKeys } from '../../contracts/privacy.ts';
import {
  isProductAvailableForExistingAccess,
  SERVER_PRODUCT_CATALOG
} from '../../contracts/products.ts';
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
  formData?: Record<string, unknown>;
  reportData: Record<string, unknown>;
  reportProvider?: string;
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

function canReadArchiveProduct(productId: unknown) {
  if (typeof productId !== 'string') {
    return false;
  }
  const product = SERVER_PRODUCT_CATALOG[productId as keyof typeof SERVER_PRODUCT_CATALOG];
  return isProductAvailableForExistingAccess(product?.status);
}

function assertArchiveProduct(productId: string) {
  const product = SERVER_PRODUCT_CATALOG[productId as keyof typeof SERVER_PRODUCT_CATALOG];

  if (!product) {
    throw new ReportRequestError(400, 'Archive product is not registered in the server catalog.');
  }
  if (!isProductAvailableForExistingAccess(product.status)) {
    throw new ReportRequestError(409, 'This product is not available for report archive access.');
  }
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

    try {
      assertNoServerSecretKeys(raw, 'ArchiveEntry');
    } catch {
      throw new ReportRequestError(
        400,
        'Archive entry contains a forbidden credential field.'
      );
    }

    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
    const productId = typeof raw.productId === 'string' && raw.productId.trim() ? raw.productId.trim() : '';
    const reportData =
      raw.reportData && typeof raw.reportData === 'object' && !Array.isArray(raw.reportData)
        ? raw.reportData
        : null;
    const formData =
      raw.formData === undefined
        ? undefined
        : raw.formData && typeof raw.formData === 'object' && !Array.isArray(raw.formData)
          ? raw.formData
          : null;

    if (!id || !productId || !reportData || formData === null) {
      throw new ReportRequestError(400, 'Archive entry is incomplete.');
    }

    return {
      id,
      productId,
      reportData,
      orderId: typeof raw.orderId === 'string' ? raw.orderId.trim() : undefined,
      customerName: typeof raw.customerName === 'string' && raw.customerName.trim() ? raw.customerName.trim() : '운월당 회원',
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '운월당 리포트',
      subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.trim() : '',
      createdAt: getTimestampValue(raw.createdAt),
      paymentMethod: typeof raw.paymentMethod === 'string' ? raw.paymentMethod.trim() : undefined,
      ...(formData === undefined ? {} : { formData }),
      reportProvider:
        typeof raw.reportProvider === 'string' && raw.reportProvider.trim()
          ? raw.reportProvider.trim()
          : undefined
    };
  }

  private assertReportToken(
    entry: ArchiveEntry,
    body: Record<string, unknown>,
    userId: string
  ): ReportAccessClaims | null {
    if (!this.config.report.requireTokenForArchive) {
      return null;
    }

    const reportToken = getOptionalString(body, 'reportAccessToken');

    if (!reportToken) {
      throw new ReportRequestError(401, 'Report access token is required for archive save.');
    }

    const payload = this.tokens.verifyReportAccessToken(reportToken);

    if (payload.userBinding !== this.tokens.createUserBinding(userId)) {
      throw new ReportRequestError(403, 'Report token does not belong to this login account.');
    }

    if (entry.orderId && payload.orderId !== entry.orderId) {
      throw new ReportRequestError(403, 'Report token does not match this archive order.');
    }

    if (payload.productId !== entry.productId) {
      throw new ReportRequestError(403, 'Report token does not match this archive product.');
    }

    return payload;
  }

  async save(userId: string, body: Record<string, unknown>) {
    const entry = this.normalizeEntry(body.entry);
    assertArchiveProduct(entry.productId);
    const reportAccess = this.assertReportToken(entry, body, userId);
    const serverBoundEntry: ArchiveEntry = {
      ...entry,
      orderId: reportAccess?.orderId || entry.orderId
    };
    const entryJson = JSON.stringify(serverBoundEntry);

    if (entryJson.length > 900_000) {
      throw new ReportRequestError(413, 'Archive entry is too large.');
    }

    await this.repository.upsert(userId, serverBoundEntry, entryJson);
    return serverBoundEntry;
  }

  async list(whereUserId?: string) {
    const entries = await this.repository.list(whereUserId);
    return whereUserId
      ? entries.filter((entry) => canReadArchiveProduct(entry?.productId))
      : entries;
  }
}
