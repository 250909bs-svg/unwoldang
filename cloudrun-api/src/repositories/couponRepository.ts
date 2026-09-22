import { createHash } from 'node:crypto';
import { ReportRequestError } from '../contracts/errors.ts';
import { FirestoreRepository } from './firestoreRepository.ts';

/**
 * 쿠폰 보유·사용 기록.
 *
 * 쿠폰 **정의**는 코드에 있고(`domains/coupons/couponCatalog.ts`), 여기에는 누가 무엇을
 * 몇 번 썼는지만 쌓는다. 그래서 이 저장소가 털려도 새 할인이 생기지 않는다.
 *
 * 문서 ID 를 `(사용자, 코드)` 해시로 고정한다. 같은 쿠폰을 두 번 받으려 하면 Firestore 가
 * 409 로 막고, 사용 횟수 증가는 `currentDocument.updateTime` 전제조건을 걸어 동시에 두
 * 번 결제해도 한 번만 올라간다 — 리포트 생성 잠금이 쓰는 것과 같은 낙관적 동시성이다.
 */

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  timestampValue?: string;
};

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
};

type FirestoreRunQueryRow = { document?: FirestoreDocument };

export type CouponGrant = {
  documentId: string;
  path: string;
  userId: string;
  code: string;
  grantedAt: string;
  redeemedCount: number;
  lastOrderId: string;
  lastRedeemedAt: string;
  updateTime: string;
};

const REDEEM_UPDATE_MASK = ['redeemedCount', 'lastOrderId', 'lastRedeemedAt'];

function readString(document: FirestoreDocument, field: string) {
  const value = document.fields?.[field];

  return typeof value?.stringValue === 'string' ? value.stringValue : '';
}

function readInteger(document: FirestoreDocument, field: string) {
  const value = document.fields?.[field]?.integerValue;

  return typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : 0;
}

function readTimestamp(document: FirestoreDocument, field: string) {
  const value = document.fields?.[field]?.timestampValue;

  return typeof value === 'string' ? value : '';
}

export function getCouponGrantDocumentId(userId: string, code: string) {
  return createHash('sha256').update(`coupon:${userId}:${code}`).digest('hex');
}

export class CouponRepository {
  constructor(
    private readonly firestore: FirestoreRepository,
    private readonly collection: string
  ) {}

  private documentPath(documentId: string) {
    return `/${encodeURIComponent(this.collection)}/${documentId}`;
  }

  private parse(document: FirestoreDocument, fallbackDocumentId = ''): CouponGrant {
    const documentId = (document.name || '').split('/').pop() || fallbackDocumentId;

    return {
      documentId,
      path: documentId ? this.documentPath(documentId) : '',
      userId: readString(document, 'userId'),
      code: readString(document, 'code'),
      grantedAt: readTimestamp(document, 'grantedAt'),
      redeemedCount: readInteger(document, 'redeemedCount'),
      lastOrderId: readString(document, 'lastOrderId'),
      lastRedeemedAt: readTimestamp(document, 'lastRedeemedAt'),
      updateTime: typeof document.updateTime === 'string' ? document.updateTime : ''
    };
  }

  /** 쿠폰을 지급한다. 이미 있으면 `granted: false` 와 기존 기록을 돌려준다. */
  async grant(userId: string, code: string, grantedAt: string) {
    const documentId = getCouponGrantDocumentId(userId, code);

    try {
      const document = await this.firestore.request<FirestoreDocument>(
        `/${encodeURIComponent(this.collection)}?documentId=${encodeURIComponent(documentId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            fields: {
              userId: { stringValue: userId },
              code: { stringValue: code },
              grantedAt: { timestampValue: grantedAt },
              redeemedCount: { integerValue: '0' },
              lastOrderId: { stringValue: '' },
              lastRedeemedAt: { stringValue: '' }
            }
          })
        }
      );

      return { granted: true as const, grant: this.parse(document, documentId) };
    } catch (error) {
      if (!(error instanceof ReportRequestError) || error.status !== 409) throw error;

      return { granted: false as const, grant: await this.get(userId, code) };
    }
  }

  /** 없으면 null. "받지 않은 쿠폰" 과 "오류" 를 섞지 않는다. */
  async get(userId: string, code: string): Promise<CouponGrant | null> {
    const documentId = getCouponGrantDocumentId(userId, code);

    try {
      const document = await this.firestore.request<FirestoreDocument>(
        this.documentPath(documentId)
      );

      return this.parse(document, documentId);
    } catch (error) {
      if (error instanceof ReportRequestError && error.status === 404) return null;
      throw error;
    }
  }

  async listByUser(userId: string, limit = 50) {
    const queryLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 50) : 50;
    const rows = await this.firestore.request<FirestoreRunQueryRow[]>(':runQuery', {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: this.collection }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'userId' },
              op: 'EQUAL',
              value: { stringValue: userId }
            }
          },
          limit: queryLimit
        }
      })
    });

    if (!Array.isArray(rows)) return [];

    return rows
      .map((row) => row?.document)
      .filter((document): document is FirestoreDocument => Boolean(document))
      .map((document) => this.parse(document));
  }

  /**
   * 사용 횟수를 하나 올린다.
   *
   * `updateTime` 전제조건이 걸려 있어, 같은 쿠폰으로 두 결제가 동시에 들어오면 뒤에 오는
   * 쪽이 412/409 로 떨어진다. 그 실패를 삼키지 말고 위로 올려야 한 번만 깎인다.
   */
  async redeem(grant: CouponGrant, orderId: string, redeemedAt: string) {
    const params = new URLSearchParams();
    REDEEM_UPDATE_MASK.forEach((field) => params.append('updateMask.fieldPaths', field));
    params.set('currentDocument.updateTime', grant.updateTime);

    const document = await this.firestore.request<FirestoreDocument>(
      `${grant.path}?${params.toString()}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            redeemedCount: { integerValue: String(grant.redeemedCount + 1) },
            lastOrderId: { stringValue: orderId },
            lastRedeemedAt: { timestampValue: redeemedAt }
          }
        })
      }
    );

    return this.parse(document, grant.documentId);
  }
}
