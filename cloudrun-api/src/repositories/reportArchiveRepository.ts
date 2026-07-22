import { createHash } from 'node:crypto';
import {
  DataStoreRequestError,
  ReportRequestError
} from '../contracts/errors.ts';
import { FirestoreRepository } from './firestoreRepository.ts';

type FirestoreDocument = {
  fields?: Record<string, { stringValue?: string }>;
  updateTime?: string;
};

type FirestoreRunQueryRow = {
  document?: FirestoreDocument;
};

export type StoredReportArchiveEntry = {
  id: string;
  orderId?: string;
  productId: string;
  customerName: string;
  title: string;
  createdAt: string;
  paymentMethod?: string;
  [key: string]: unknown;
};

function readString(document: FirestoreDocument, fieldName: string) {
  const value = document.fields?.[fieldName];

  return typeof value?.stringValue === 'string' ? value.stringValue : '';
}

function parseArchiveEntry(document: FirestoreDocument) {
  const entryJson = readString(document, 'entryJson');

  if (!entryJson) {
    return null;
  }

  try {
    return JSON.parse(entryJson) as unknown;
  } catch {
    return null;
  }
}

function getCreatedAt(entry: unknown) {
  if (!entry || (typeof entry !== 'object' && typeof entry !== 'function')) {
    return '';
  }

  const createdAt = (entry as { createdAt?: unknown }).createdAt;

  return typeof createdAt === 'string' ? createdAt : '';
}

export function getReportArchiveDocumentId(userId: string, archiveId: string) {
  return createHash('sha256').update(`${userId}:${archiveId}`).digest('hex');
}

export class ReportArchiveRepository {
  constructor(
    private readonly firestore: FirestoreRepository,
    private readonly collection: string
  ) {}

  private documentPath(documentId: string) {
    return `/${encodeURIComponent(this.collection)}/${documentId}`;
  }

  private async readExisting(documentId: string) {
    try {
      return await this.firestore.request<FirestoreDocument>(
        this.documentPath(documentId)
      );
    } catch (error) {
      if (
        error instanceof DataStoreRequestError &&
        error.providerStatus === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  private assertCompatibleBinding(
    existing: FirestoreDocument,
    userId: string,
    entry: StoredReportArchiveEntry
  ) {
    const existingOrderId = readString(existing, 'orderId');
    const entryOrderId = entry.orderId || '';
    if (
      readString(existing, 'userId') !== userId ||
      readString(existing, 'archiveId') !== entry.id ||
      readString(existing, 'productId') !== entry.productId ||
      (existingOrderId && entryOrderId && existingOrderId !== entryOrderId)
    ) {
      throw new ReportRequestError(
        409,
        'Archive identity is already bound to a different report.'
      );
    }
  }

  async saveForUser(userId: string, entry: StoredReportArchiveEntry) {
    const documentId = getReportArchiveDocumentId(userId, entry.id);
    const entryJson = JSON.stringify(entry);
    const existing = await this.readExisting(documentId);

    if (existing) {
      this.assertCompatibleBinding(existing, userId, entry);
    }

    const precondition = existing?.updateTime
      ? `currentDocument.updateTime=${encodeURIComponent(existing.updateTime)}`
      : 'currentDocument.exists=false';

    await this.firestore.request(
      `${this.documentPath(documentId)}?${precondition}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            userId: { stringValue: userId },
            archiveId: { stringValue: entry.id },
            orderId: { stringValue: entry.orderId || '' },
            productId: { stringValue: entry.productId },
            customerName: { stringValue: entry.customerName },
            title: { stringValue: entry.title },
            paymentMethod: { stringValue: entry.paymentMethod || '' },
            createdAt: { timestampValue: entry.createdAt },
            entryJson: { stringValue: entryJson }
          }
        })
      }
    );

    return entry;
  }

  private async list(whereUserId?: string) {
    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId: this.collection }],
      limit: 200
    };

    if (whereUserId) {
      structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: 'userId' },
          op: 'EQUAL',
          value: { stringValue: whereUserId }
        }
      };
    }

    const rows = await this.firestore.request<FirestoreRunQueryRow[]>(':runQuery', {
      method: 'POST',
      body: JSON.stringify({ structuredQuery })
    });
    const entries = Array.isArray(rows)
      ? rows
          .map((row) => (row.document ? parseArchiveEntry(row.document) : null))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      : [];

    return entries
      .sort(
        (left, right) =>
          Date.parse(getCreatedAt(right)) - Date.parse(getCreatedAt(left))
      )
      .slice(0, 100) as StoredReportArchiveEntry[];
  }

  listForUser(userId: string) {
    return this.list(userId);
  }

  listAll() {
    return this.list();
  }

  save(userId: string, entry: StoredReportArchiveEntry) {
    return this.saveForUser(userId, entry);
  }

  listByUser(userId: string) {
    return this.listForUser(userId);
  }
}
