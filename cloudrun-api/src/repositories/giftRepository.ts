import { createHash, randomBytes } from 'node:crypto';
import { ReportRequestError } from '../contracts/errors.ts';
import { FirestoreRepository } from './firestoreRepository.ts';

/**
 * 선물 보관소.
 *
 * 선물 하나는 결제 하나에 붙는다. 산 사람은 결제하고 코드를 받고, 받은 사람은 그 코드로
 * 리포트를 한 번 만든다. 그래서 이 문서가 지켜야 하는 것은 **한 번만 쓰이는 것**이다 —
 * `redeemedAt` 을 채우는 갱신에 `currentDocument.updateTime` 전제조건을 걸어, 같은
 * 코드로 두 사람이 동시에 들어오면 뒤쪽이 떨어진다.
 *
 * 출생정보는 여기 없다. 받은 사람이 자기 브라우저에서 입력해 리포트를 만들고, 선물
 * 문서에는 "누가 언제 받았는지" 만 남는다.
 */

type FirestoreValue = { stringValue?: string; integerValue?: string; timestampValue?: string };
type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
};

export type GiftRecord = {
  documentId: string;
  path: string;
  code: string;
  orderId: string;
  paymentId: string;
  productId: string;
  amount: number;
  entitlementId: string;
  buyerUserId: string;
  buyerName: string;
  message: string;
  createdAt: string;
  expiresAt: string;
  redeemedByUserId: string;
  redeemedAt: string;
  updateTime: string;
};

const REDEEM_UPDATE_MASK = ['redeemedByUserId', 'redeemedAt'];

function readString(document: FirestoreDocument, field: string) {
  const value = document.fields?.[field]?.stringValue;
  return typeof value === 'string' ? value : '';
}

function readInteger(document: FirestoreDocument, field: string) {
  const value = document.fields?.[field]?.integerValue;
  return typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : 0;
}

function readTimestamp(document: FirestoreDocument, field: string) {
  const value = document.fields?.[field]?.timestampValue;
  return typeof value === 'string' ? value : '';
}

/**
 * 선물 코드.
 *
 * 링크로 돌아다니는 값이라 추측되면 남이 선물을 가져간다. 그래서 난수 16바이트를
 * base32 로 적는다 — 사람이 입으로 읽을 수 있으면서(0/O, 1/I 를 뺀다) 추측은 불가능하다.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createGiftCode(random: (size: number) => Buffer = randomBytes) {
  const bytes = random(16);

  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

export function getGiftDocumentId(code: string) {
  return createHash('sha256').update(`gift:${code}`).digest('hex');
}

export class GiftRepository {
  constructor(
    private readonly firestore: FirestoreRepository,
    private readonly collection: string
  ) {}

  private documentPath(documentId: string) {
    return `/${encodeURIComponent(this.collection)}/${documentId}`;
  }

  private parse(document: FirestoreDocument, fallbackDocumentId = ''): GiftRecord {
    const documentId = (document.name || '').split('/').pop() || fallbackDocumentId;

    return {
      documentId,
      path: documentId ? this.documentPath(documentId) : '',
      code: readString(document, 'code'),
      orderId: readString(document, 'orderId'),
      paymentId: readString(document, 'paymentId'),
      productId: readString(document, 'productId'),
      amount: readInteger(document, 'amount'),
      entitlementId: readString(document, 'entitlementId'),
      buyerUserId: readString(document, 'buyerUserId'),
      buyerName: readString(document, 'buyerName'),
      message: readString(document, 'message'),
      createdAt: readTimestamp(document, 'createdAt'),
      expiresAt: readTimestamp(document, 'expiresAt'),
      redeemedByUserId: readString(document, 'redeemedByUserId'),
      redeemedAt: readTimestamp(document, 'redeemedAt'),
      updateTime: typeof document.updateTime === 'string' ? document.updateTime : ''
    };
  }

  async create(input: {
    code: string;
    orderId: string;
    paymentId: string;
    productId: string;
    amount: number;
    entitlementId: string;
    buyerUserId: string;
    buyerName: string;
    message: string;
    createdAt: string;
    expiresAt: string;
  }) {
    const documentId = getGiftDocumentId(input.code);

    try {
      const document = await this.firestore.request<FirestoreDocument>(
        `/${encodeURIComponent(this.collection)}?documentId=${encodeURIComponent(documentId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            fields: {
              code: { stringValue: input.code },
              orderId: { stringValue: input.orderId },
              paymentId: { stringValue: input.paymentId },
              productId: { stringValue: input.productId },
              amount: { integerValue: String(input.amount) },
              entitlementId: { stringValue: input.entitlementId },
              buyerUserId: { stringValue: input.buyerUserId },
              buyerName: { stringValue: input.buyerName },
              message: { stringValue: input.message },
              createdAt: { timestampValue: input.createdAt },
              expiresAt: { timestampValue: input.expiresAt },
              redeemedByUserId: { stringValue: '' },
              redeemedAt: { stringValue: '' }
            }
          })
        }
      );

      return { created: true as const, gift: this.parse(document, documentId) };
    } catch (error) {
      if (!(error instanceof ReportRequestError) || error.status !== 409) throw error;

      /* 같은 결제로 두 번 확인이 들어온 경우. 코드는 결제에서 결정되므로 같은 문서다. */
      return { created: false as const, gift: await this.get(input.code) };
    }
  }

  async get(code: string): Promise<GiftRecord> {
    const documentId = getGiftDocumentId(code);
    const document = await this.firestore.request<FirestoreDocument>(this.documentPath(documentId));

    return this.parse(document, documentId);
  }

  /** 없으면 null. "없는 코드" 와 "서버 오류" 를 섞지 않는다. */
  async find(code: string): Promise<GiftRecord | null> {
    try {
      return await this.get(code);
    } catch (error) {
      if (error instanceof ReportRequestError && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * 받은 사람을 기록한다.
   *
   * `updateTime` 전제조건이 걸려 있어 같은 코드로 두 사람이 동시에 들어오면 뒤쪽이
   * 412/409 로 떨어진다. 그 실패를 삼키면 한 선물로 두 리포트가 나간다.
   */
  async redeem(gift: GiftRecord, userId: string, redeemedAt: string) {
    const params = new URLSearchParams();
    REDEEM_UPDATE_MASK.forEach((field) => params.append('updateMask.fieldPaths', field));
    params.set('currentDocument.updateTime', gift.updateTime);

    const document = await this.firestore.request<FirestoreDocument>(
      `${gift.path}?${params.toString()}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            redeemedByUserId: { stringValue: userId },
            redeemedAt: { timestampValue: redeemedAt }
          }
        })
      }
    );

    return this.parse(document, gift.documentId);
  }
}
