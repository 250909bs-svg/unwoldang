import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser, PaymentOrderClaims } from '../../contracts/auth.ts';
import { PaymentRequestError, ReportRequestError } from '../../contracts/errors.ts';
import {
  assertProductAvailableForNewOrder,
  getCatalogAmount,
  PRODUCT_STATUS,
  SERVER_PRODUCT_CATALOG,
  type ProductId
} from '../../contracts/products.ts';
import {
  getOptionalString,
  getRequiredAmount,
  getRequiredString
} from '../../http/validation.ts';
import type { PortOnePayment, PortOnePaymentClient } from './portoneClient.ts';

export type PaymentServiceConfig = {
  storeId: string;
  orderClaimTtlMs: number;
  reportAccessTokenTtlMs: number;
};

export type PaymentOrderClaimInput = {
  userId: string;
  orderId: string;
  productId: string;
  amount: number;
};

export type ReportAccessTokenInput = {
  userId: string;
  orderId: string;
  paymentId: string;
  productId: string;
  amount: number;
  entitlementId: string;
};

export interface PaymentTokenService {
  createUserBinding(userId: string): string;
  createPaymentOrderClaim(input: PaymentOrderClaimInput): string;
  verifyPaymentOrderClaim(token: string, userId: string): PaymentOrderClaims;
  createReportAccessToken(input: ReportAccessTokenInput): string;
}

export interface PaymentLedgerRecord {
  [field: string]: unknown;
  paymentId?: string;
  orderId?: string;
  productId?: string;
  amount?: number;
  currency?: string;
  storeId?: string;
  transactionId?: string;
  confirmedAt?: string;
  userId?: string;
  userBinding?: string;
  entitlementId?: string;
  orderClaimHash?: string;
  entitlementStatus?: string;
  entitlementCreatedAt?: string;
}

export interface ConfirmedPaymentLedgerRecord extends PaymentLedgerRecord {
  paymentId: string;
  orderId: string;
  productId: string;
  amount: number;
  currency: string;
  storeId: string;
  transactionId: string;
  confirmedAt: string;
  userId: string;
  userBinding: string;
  entitlementId: string;
  orderClaimHash: string;
  entitlementStatus: typeof PRODUCT_STATUS.ACTIVE;
  entitlementCreatedAt: string;
}
export type PaymentLedgerCreationResult =
  | void
  | {
      kind: 'created' | 'existing';
      ledger: PaymentLedgerRecord;
    };


export interface PaymentLedgerRepository {
  createPaymentLedger(
    record: ConfirmedPaymentLedgerRecord
  ): Promise<PaymentLedgerCreationResult>;
  getPaymentLedger(entitlementId: string): Promise<PaymentLedgerRecord | null>;
  listPaymentLedgersByUserId(userId: string, limit: number): Promise<unknown>;
}

export type PaymentServiceDependencies = {
  config: PaymentServiceConfig;
  portOneClient: PortOnePaymentClient;
  ledgerRepository: PaymentLedgerRepository;
  tokenService: PaymentTokenService;
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
};

function assertPaymentOrderId(orderId: string) {
  if (!/^UW-[A-Za-z0-9._-]{12,116}$/.test(orderId)) {
    throw new PaymentRequestError(400, 'orderId 형식이 올바르지 않습니다.');
  }
}

function readNestedString(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const value = path.reduce<unknown>(
      (current, key) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined,
      source
    );

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readLedgerString(record: PaymentLedgerRecord | null, field: string) {
  const value = record?.[field];
  return typeof value === 'string' ? value : undefined;
}

function readLedgerInteger(record: PaymentLedgerRecord | null, field: string) {
  const value = record?.[field];
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : NaN;
}

function readLedgerTimestamp(record: PaymentLedgerRecord | null, field: string) {
  const value = record?.[field];
  return typeof value === 'string' ? value : '';
}

function getPaymentLedgerDocumentId(paymentId: string) {
  return createHash('sha256').update(`portone:${paymentId}`).digest('hex');
}

function getCustomData(payment: PortOnePayment) {
  const rawCustomData = payment.customData;

  if (rawCustomData && typeof rawCustomData === 'object' && !Array.isArray(rawCustomData)) {
    return rawCustomData as Record<string, unknown>;
  }

  if (typeof rawCustomData === 'string' && rawCustomData.trim()) {
    try {
      const parsedCustomData = JSON.parse(rawCustomData) as unknown;

      if (
        parsedCustomData &&
        typeof parsedCustomData === 'object' &&
        !Array.isArray(parsedCustomData)
      ) {
        return parsedCustomData as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export class PaymentService {
  private readonly now: () => number;
  private readonly generateRandomBytes: (size: number) => Buffer;

  constructor(private readonly dependencies: PaymentServiceDependencies) {
    this.now = dependencies.now || Date.now;
    this.generateRandomBytes = dependencies.randomBytes || randomBytes;
  }

  createOrderIntent(user: AuthenticatedUser, body: Record<string, unknown>) {
    const productId = getRequiredString(body, 'productId');
    const amount = getCatalogAmount(productId);
    assertProductAvailableForNewOrder(productId);
    const requestedAmount = body.amount === undefined ? amount : getRequiredAmount(body);
    const orderId =
      getOptionalString(body, 'orderId') ||
      `UW-${this.now()}-${this.generateRandomBytes(16).toString('base64url')}`;

    assertPaymentOrderId(orderId);

    if (requestedAmount !== amount) {
      throw new PaymentRequestError(409, '주문 금액이 서버 상품 가격과 일치하지 않습니다.');
    }

    const orderClaim = this.dependencies.tokenService.createPaymentOrderClaim({
      userId: user.userId,
      orderId,
      productId,
      amount
    });

    return {
      orderId,
      productId,
      amount,
      currency: 'KRW' as const,
      orderClaim,
      orderClaimExpiresAt: new Date(
        this.now() + this.dependencies.config.orderClaimTtlMs
      ).toISOString()
    };
  }

  async confirmPayment(user: AuthenticatedUser, body: Record<string, unknown>) {
    const paymentId = getRequiredString(body, 'paymentId');
    const orderId = getRequiredString(body, 'orderId');
    const amount = getRequiredAmount(body);
    const txId = getOptionalString(body, 'txId');
    const productId = getRequiredString(body, 'productId');
    const suppliedOrderClaim = getOptionalString(body, 'orderClaim');
    const catalogAmount = getCatalogAmount(productId);

    assertPaymentOrderId(orderId);

    if (!Number.isSafeInteger(amount) || amount !== catalogAmount) {
      throw new PaymentRequestError(409, '주문 금액이 서버 상품 가격과 일치하지 않습니다.');
    }

    if (paymentId !== orderId) {
      throw new PaymentRequestError(409, '결제 ID와 주문번호가 일치하지 않습니다.');
    }

    const configuredStoreId = this.dependencies.config.storeId.trim();

    if (!configuredStoreId) {
      throw new PaymentRequestError(500, 'PORTONE_STORE_ID가 서버에 설정되지 않았습니다.');
    }

    const payment = await this.dependencies.portOneClient.fetchPayment(paymentId);
    const status = String(readNestedString(payment, [['status']]) || '').toUpperCase();
    const portOnePaymentId = readNestedString(payment, [['id']]);
    const storeId = readNestedString(payment, [['storeId']]);
    const currency = readNestedString(payment, [['currency']]);
    const paidAmountValue =
      payment.amount && typeof payment.amount === 'object'
        ? (payment.amount as Record<string, unknown>).total
        : undefined;
    const paidAmount =
      typeof paidAmountValue === 'number' && Number.isSafeInteger(paidAmountValue)
        ? paidAmountValue
        : null;
    const portOneTransactionId = readNestedString(payment, [['transactionId']]);
    const customData = getCustomData(payment);
    const paidProductId =
      typeof customData?.productId === 'string' && customData.productId.trim()
        ? customData.productId.trim()
        : undefined;
    const paidOrderClaim =
      typeof customData?.orderClaim === 'string' && customData.orderClaim.trim()
        ? customData.orderClaim.trim()
        : undefined;

    if (!portOnePaymentId || portOnePaymentId !== paymentId) {
      throw new PaymentRequestError(
        409,
        'PortOne 응답의 결제 ID가 주문 정보와 일치하지 않습니다.'
      );
    }

    if (paidAmount === null || paidAmount !== catalogAmount) {
      throw new PaymentRequestError(409, 'PortOne 결제 금액이 주문 금액과 일치하지 않습니다.');
    }

    if (status !== 'PAID') {
      throw new PaymentRequestError(
        409,
        `PortOne 결제가 아직 완료 상태가 아닙니다. 현재 상태: ${status || 'UNKNOWN'}`
      );
    }

    if (!storeId || configuredStoreId !== storeId) {
      throw new PaymentRequestError(409, 'PortOne 상점 ID가 서버 설정과 일치하지 않습니다.');
    }

    if (currency !== 'KRW') {
      throw new PaymentRequestError(409, 'PortOne 결제 통화가 KRW와 일치하지 않습니다.');
    }

    if (!paidProductId || paidProductId !== productId) {
      throw new PaymentRequestError(409, 'PortOne 결제 상품이 주문 상품과 일치하지 않습니다.');
    }

    if (!paidOrderClaim || (suppliedOrderClaim && suppliedOrderClaim !== paidOrderClaim)) {
      throw new PaymentRequestError(
        409,
        'PortOne 결제의 주문 인증 정보가 확인 요청과 일치하지 않습니다.'
      );
    }

    const orderClaims = this.dependencies.tokenService.verifyPaymentOrderClaim(
      paidOrderClaim,
      user.userId
    );

    if (
      orderClaims.orderId !== orderId ||
      orderClaims.productId !== productId ||
      orderClaims.amount !== catalogAmount
    ) {
      throw new PaymentRequestError(
        409,
        '서명된 주문 정보가 PortOne 결제 정보와 일치하지 않습니다.'
      );
    }

    if (!portOneTransactionId || (txId && txId !== portOneTransactionId)) {
      throw new PaymentRequestError(409, 'PortOne 거래 ID가 결제 결과와 일치하지 않습니다.');
    }

    const confirmedAt = new Date(this.now()).toISOString();
    const ledgerDocumentId = getPaymentLedgerDocumentId(paymentId);
    const userBinding = this.dependencies.tokenService.createUserBinding(user.userId);
    const orderClaimHash = createHash('sha256').update(paidOrderClaim).digest('hex');
    const ledger: ConfirmedPaymentLedgerRecord = {
      paymentId,
      orderId,
      productId,
      amount: catalogAmount,
      currency,
      storeId,
      transactionId: portOneTransactionId,
      confirmedAt,
      userId: user.userId,
      userBinding,
      entitlementId: ledgerDocumentId,
      orderClaimHash,
      entitlementStatus: PRODUCT_STATUS.ACTIVE,
      entitlementCreatedAt: confirmedAt
    };

    let existing: PaymentLedgerRecord | null | undefined;

    try {
      const creation = await this.dependencies.ledgerRepository.createPaymentLedger(ledger);

      if (creation && creation.kind === 'existing') {
        existing = creation.ledger;
      }
    } catch (error) {
      if (!(error instanceof ReportRequestError) || error.status !== 409) {
        throw error;
      }

      existing = await this.dependencies.ledgerRepository.getPaymentLedger(
        ledgerDocumentId
      );
    }

    if (
      existing !== undefined &&
      (readLedgerString(existing, 'paymentId') !== paymentId ||
        readLedgerString(existing, 'orderId') !== orderId ||
        readLedgerString(existing, 'productId') !== productId ||
        readLedgerInteger(existing, 'amount') !== catalogAmount ||
        readLedgerString(existing, 'currency') !== currency ||
        readLedgerString(existing, 'storeId') !== storeId ||
        readLedgerString(existing, 'transactionId') !== portOneTransactionId ||
        readLedgerString(existing, 'userId') !== user.userId ||
        readLedgerString(existing, 'userBinding') !== userBinding ||
        readLedgerString(existing, 'entitlementId') !== ledgerDocumentId ||
        readLedgerString(existing, 'orderClaimHash') !== orderClaimHash ||
        readLedgerString(existing, 'entitlementStatus') !== PRODUCT_STATUS.ACTIVE)
    ) {
      throw new PaymentRequestError(
        409,
        '이미 확인된 결제 원장과 현재 주문 정보가 일치하지 않습니다.'
      );
    }

    const reportAccessToken = this.dependencies.tokenService.createReportAccessToken({
      userId: user.userId,
      orderId,
      paymentId,
      productId,
      amount: catalogAmount,
      entitlementId: ledgerDocumentId
    });

    return {
      paymentId,
      txId: portOneTransactionId,
      orderId,
      productId,
      amount: catalogAmount,
      currency,
      status,
      method: readNestedString(payment, [['method', 'type'], ['method'], ['payMethod']]),
      approvedAt: readNestedString(payment, [['paidAt'], ['approvedAt']]),
      reportAccessToken,
      reportAccessTokenExpiresAt: new Date(
        this.now() + this.dependencies.config.reportAccessTokenTtlMs
      ).toISOString()
    };
  }

  async renewEntitlement(user: AuthenticatedUser, body: Record<string, unknown>) {
    const orderId = getRequiredString(body, 'orderId');
    assertPaymentOrderId(orderId);
    const documentId = getPaymentLedgerDocumentId(orderId);
    let ledger: PaymentLedgerRecord | null;

    try {
      ledger = await this.dependencies.ledgerRepository.getPaymentLedger(documentId);
    } catch (error) {
      if (error instanceof ReportRequestError && error.status === 404) {
        throw new PaymentRequestError(
          404,
          '이 계정에서 복구할 수 있는 결제 권한을 찾지 못했습니다.'
        );
      }

      throw error;
    }

    if (readLedgerString(ledger, 'userId') !== user.userId) {
      throw new PaymentRequestError(
        404,
        '이 계정에서 복구할 수 있는 결제 권한을 찾지 못했습니다.'
      );
    }

    const paymentId = readLedgerString(ledger, 'paymentId');
    const storedOrderId = readLedgerString(ledger, 'orderId');
    const productId = readLedgerString(ledger, 'productId');
    const userBinding = readLedgerString(ledger, 'userBinding');
    const amount = readLedgerInteger(ledger, 'amount');

    if (
      paymentId !== orderId ||
      storedOrderId !== orderId ||
      !productId ||
      !Number.isSafeInteger(amount) ||
      amount !== getCatalogAmount(productId) ||
      userBinding !== this.dependencies.tokenService.createUserBinding(user.userId) ||
      readLedgerString(ledger, 'entitlementId') !== documentId ||
      readLedgerString(ledger, 'entitlementStatus') !== PRODUCT_STATUS.ACTIVE
    ) {
      throw new PaymentRequestError(409, '결제 권한 원장의 무결성을 확인할 수 없습니다.');
    }

    const reportAccessToken = this.dependencies.tokenService.createReportAccessToken({
      userId: user.userId,
      orderId,
      paymentId,
      productId,
      amount,
      entitlementId: documentId
    });

    return {
      orderId,
      productId,
      amount,
      currency: readLedgerString(ledger, 'currency') || 'KRW',
      reportAccessToken,
      reportAccessTokenExpiresAt: new Date(
        this.now() + this.dependencies.config.reportAccessTokenTtlMs
      ).toISOString()
    };
  }

  async queryEntitlements(user: AuthenticatedUser) {
    const records = await this.dependencies.ledgerRepository.listPaymentLedgersByUserId(
      user.userId,
      100
    );

    if (!Array.isArray(records)) {
      return [];
    }

    return (records as PaymentLedgerRecord[])
      .filter((record) => {
        const productId = readLedgerString(record, 'productId');
        const amount = readLedgerInteger(record, 'amount');
        const product = productId
          ? SERVER_PRODUCT_CATALOG[productId as ProductId]
          : undefined;

        return (
          readLedgerString(record, 'userId') === user.userId &&
          readLedgerString(record, 'userBinding') ===
            this.dependencies.tokenService.createUserBinding(user.userId) &&
          readLedgerString(record, 'entitlementStatus') === PRODUCT_STATUS.ACTIVE &&
          Boolean(productId) &&
          Number.isSafeInteger(amount) &&
          (product?.status === PRODUCT_STATUS.ACTIVE ||
            product?.status === PRODUCT_STATUS.ARCHIVED) &&
          product.amount === amount
        );
      })
      .map((record) => ({
        orderId: readLedgerString(record, 'orderId'),
        productId: readLedgerString(record, 'productId'),
        amount: readLedgerInteger(record, 'amount'),
        currency: readLedgerString(record, 'currency') || 'KRW',
        confirmedAt: readLedgerTimestamp(record, 'confirmedAt'),
        status: PRODUCT_STATUS.ACTIVE
      }))
      .filter((entry) => Boolean(entry.orderId))
      .sort((left, right) => Date.parse(right.confirmedAt) - Date.parse(left.confirmedAt));
  }
}

export function createPaymentService(dependencies: PaymentServiceDependencies) {
  return new PaymentService(dependencies);
}
