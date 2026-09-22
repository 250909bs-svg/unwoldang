import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser, PaymentOrderClaims } from '../../contracts/auth.ts';
import { PaymentRequestError, ReportRequestError } from '../../contracts/errors.ts';
import {
  assertProductAvailableForExistingAccess,
  assertProductAvailableForNewOrder,
  getCatalogAmount,
  isProductAvailableForExistingAccess,
  PRODUCT_STATUS,
  SERVER_PRODUCT_CATALOG,
  type ProductId
} from '../../contracts/products.ts';
import {
  getOptionalString,
  getRequiredAmount,
  getRequiredString
} from '../../http/validation.ts';
import type { PaymentProvider } from './paymentProvider.ts';

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
  /** 쿠폰 적용 후 청구액. 없으면 정가와 같다. */
  payableAmount?: number;
  couponCode?: string;
  /** 선물 주문 표시. 확정되면 리포트 대신 선물 코드가 나간다. */
  gift?: boolean;
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
  paymentProvider: PaymentProvider;
  ledgerRepository: PaymentLedgerRepository;
  tokenService: PaymentTokenService;
  /**
   * 쿠폰 적용 금액을 정하는 곳. 없으면 쿠폰 없이 정가로만 판다.
   *
   * 할인 계산을 여기에 두지 않는 이유: 결제대행사가 바뀌면 이 파일은 크게 고쳐지는데
   * 쿠폰 규칙은 그대로 남아야 한다. 결제는 "얼마를 받을지" 를 묻기만 한다.
   */
  couponService?: OrderPricingService | null;
  /** 선물 주문을 코드로 바꿔 주는 곳. 없으면 선물 주문을 받지 않는다. */
  giftService?: GiftIssuer | null;
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
};

export type GiftIssuer = {
  readonly enabled: boolean;
  createForPayment(input: {
    orderId: string;
    paymentId: string;
    productId: string;
    amount: number;
    entitlementId: string;
    buyerUserId: string;
    buyerName: string;
    message: unknown;
  }): Promise<{ code: string; expiresAt: string }>;
};

export type OrderPricingService = {
  resolvePricing(input: {
    userId: string;
    productId: string;
    catalogAmount: number;
    couponCode?: unknown;
  }): Promise<{
    catalogAmount: number;
    payableAmount: number;
    discount: number;
    couponCode: string;
  }>;
  redeem(userId: string, code: string, orderId: string): Promise<unknown>;
};

function assertPaymentOrderId(orderId: string) {
  if (!/^UW-[A-Za-z0-9._-]{12,116}$/.test(orderId)) {
    throw new PaymentRequestError(400, 'orderId 형식이 올바르지 않습니다.');
  }
}

function assertPaymentProviderConfigured(provider: PaymentProvider) {
  if (provider.configured) {
    return;
  }
  const message = provider.name === 'hyphen'
    ? '하이픈 결제 연동이 아직 구성되지 않았습니다.'
    : '결제 시스템이 현재 비활성화되어 있습니다.';
  throw new PaymentRequestError(503, message);
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

export class PaymentService {
  private readonly now: () => number;
  private readonly generateRandomBytes: (size: number) => Buffer;

  constructor(private readonly dependencies: PaymentServiceDependencies) {
    this.now = dependencies.now || Date.now;
    this.generateRandomBytes = dependencies.randomBytes || randomBytes;
  }

  async createOrderIntent(user: AuthenticatedUser, body: Record<string, unknown>) {
    const productId = getRequiredString(body, 'productId');
    assertPaymentProviderConfigured(this.dependencies.paymentProvider);
    const amount = getCatalogAmount(productId);
    assertProductAvailableForNewOrder(productId);
    const requestedAmount = body.amount === undefined ? amount : getRequiredAmount(body);
    const orderId =
      getOptionalString(body, 'orderId') ||
      `UW-${this.now()}-${this.generateRandomBytes(16).toString('base64url')}`;

    assertPaymentOrderId(orderId);

    /* 클라이언트가 보낸 금액은 **정가** 와만 대조한다. 할인은 아래에서 서버가 따로
       계산한다 — 클라이언트가 깎인 금액을 제안할 자리는 없다. */
    if (requestedAmount !== amount) {
      throw new PaymentRequestError(409, '주문 금액이 서버 상품 가격과 일치하지 않습니다.');
    }

    /* 선물을 받을 곳이 없는데 선물 주문을 받아 두면, 결제는 되고 코드는 안 나온다.
       돈을 받기 전에 막는다. */
    if (body.gift === true && !this.dependencies.giftService?.enabled) {
      throw new PaymentRequestError(503, '선물하기가 아직 열리지 않았습니다.');
    }

    const pricing = await this.resolvePricing(user.userId, productId, amount, body.couponCode);

    const orderClaim = this.dependencies.tokenService.createPaymentOrderClaim({
      userId: user.userId,
      orderId,
      productId,
      amount,
      payableAmount: pricing.payableAmount,
      couponCode: pricing.couponCode,
      /* 선물인지도 서명해 둔다. 확인 단계에서 클라이언트에게 다시 묻지 않으려면
         "이 주문이 선물이었는가" 가 주문을 만들 때 고정돼 있어야 한다. */
      gift: body.gift === true
    });

    return {
      orderId,
      productId,
      amount,
      /* 결제창에 띄울 금액. `amount` 는 정가라서 둘이 다를 수 있다. */
      payableAmount: pricing.payableAmount,
      discount: pricing.discount,
      couponCode: pricing.couponCode,
      currency: 'KRW' as const,
      orderClaim,
      orderClaimExpiresAt: new Date(
        this.now() + this.dependencies.config.orderClaimTtlMs
      ).toISOString()
    };
  }

  private async resolvePricing(
    userId: string,
    productId: string,
    catalogAmount: number,
    couponCode: unknown
  ) {
    const code = typeof couponCode === 'string' ? couponCode.trim() : '';

    if (!code) {
      return { payableAmount: catalogAmount, discount: 0, couponCode: '' };
    }

    if (!this.dependencies.couponService) {
      /* 쿠폰을 처리할 곳이 없는데 코드를 받았다면, 조용히 정가를 청구해서는 안 된다.
         손님은 할인을 기대하고 결제 버튼을 누른다. */
      throw new PaymentRequestError(503, '쿠폰을 사용할 수 없는 상태입니다.');
    }

    return this.dependencies.couponService.resolvePricing({
      userId,
      productId,
      catalogAmount,
      couponCode: code
    });
  }

  async confirmPayment(user: AuthenticatedUser, body: Record<string, unknown>) {
    const paymentId = getRequiredString(body, 'paymentId');
    assertPaymentProviderConfigured(this.dependencies.paymentProvider);
    const orderId = getRequiredString(body, 'orderId');
    const amount = getRequiredAmount(body);
    const txId = getOptionalString(body, 'txId');
    const productId = getRequiredString(body, 'productId');
    const suppliedOrderClaim = getOptionalString(body, 'orderClaim');
    const catalogAmount = getCatalogAmount(productId);
    assertProductAvailableForExistingAccess(productId);

    assertPaymentOrderId(orderId);

    /* 여기서는 정가와 대조하지 않는다. 쿠폰이 붙은 주문은 정가보다 적게 청구되고,
       "얼마를 받기로 했는가" 는 서명된 주문 클레임에만 있다. 클레임은 아래에서
       PortOne 응답과 함께 검증하므로, 그때까지 판단을 미룬다. */
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > catalogAmount) {
      throw new PaymentRequestError(409, '주문 금액이 서버 상품 가격과 맞지 않습니다.');
    }

    if (paymentId !== orderId) {
      throw new PaymentRequestError(409, '결제 ID와 주문번호가 일치하지 않습니다.');
    }

    const configuredStoreId = this.dependencies.config.storeId.trim();
    if (this.dependencies.paymentProvider.name === 'legacy-portone' && !configuredStoreId) {
      throw new PaymentRequestError(500, 'PORTONE_STORE_ID가 서버에 설정되지 않았습니다.');
    }

    const payment = await this.dependencies.paymentProvider.verifyPayment(paymentId);
    const status = payment.status;
    const portOnePaymentId = payment.paymentId;
    const storeId = payment.merchantId;
    const currency = payment.currency;
    const paidAmount = payment.amount;
    const portOneTransactionId = payment.transactionId;
    const paidProductId = payment.productId;
    const paidOrderClaim = payment.orderClaim;

    if (!portOnePaymentId || portOnePaymentId !== paymentId) {
      throw new PaymentRequestError(
        409,
        'PortOne 응답의 결제 ID가 주문 정보와 일치하지 않습니다.'
      );
    }

    /* 실제 결제 금액의 판단은 서명된 클레임을 읽은 뒤에 한다(아래 payableAmount). */

    if (status !== 'PAID') {
      throw new PaymentRequestError(
        409,
        `PortOne 결제가 아직 완료 상태가 아닙니다. 현재 상태: ${status || 'UNKNOWN'}`
      );
    }

    if (!storeId || (configuredStoreId && configuredStoreId !== storeId)) {
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

    /*
     * 청구액은 서명된 클레임에서만 온다.
     *
     * 쿠폰이 붙으면 실제 결제액이 정가보다 적으므로, 정가와 대조하면 정상 결제가 거절된다.
     * 반대로 클라이언트가 보낸 금액을 믿으면 1원 결제로 리포트를 받을 수 있다. 서버가
     * 서명해 둔 값만이 두 실수를 모두 막는다. 쿠폰 도입 전 클레임에는 이 필드가 없으므로
     * 정가로 되돌린다.
     */
    const payableAmount = Number.isSafeInteger(orderClaims.payableAmount)
      ? (orderClaims.payableAmount as number)
      : orderClaims.amount;

    if (payableAmount <= 0 || payableAmount > catalogAmount) {
      throw new PaymentRequestError(409, '서명된 주문의 청구 금액이 유효하지 않습니다.');
    }

    if (amount !== payableAmount) {
      throw new PaymentRequestError(409, '확인 요청의 금액이 주문 청구 금액과 다릅니다.');
    }

    if (paidAmount === null || paidAmount !== payableAmount) {
      throw new PaymentRequestError(409, 'PortOne 결제 금액이 주문 청구 금액과 일치하지 않습니다.');
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
      amount: payableAmount,
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
        readLedgerInteger(existing, 'amount') !== payableAmount ||
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

    /*
     * 쿠폰 소모는 결제 원장이 만들어진 **다음** 이다.
     *
     * 순서를 뒤집으면 결제가 마지막에 실패했을 때 쿠폰만 사라진다. 이 순서에서는 최악의
     * 경우가 "결제는 됐는데 쿠폰이 아직 남아 있다" 인데, 그건 손님에게 유리한 쪽이고
     * 운영이 나중에 정리할 수 있다.
     *
     * 원장이 이미 있었다면(같은 결제 재확인) 다시 소모하지 않는다 — 새로고침 한 번에
     * 쿠폰이 한 장씩 사라지면 안 된다.
     */
    const couponCode = orderClaims.couponCode || '';

    if (couponCode && this.dependencies.couponService && existing === undefined) {
      try {
        await this.dependencies.couponService.redeem(user.userId, couponCode, orderId);
      } catch (error) {
        /* 이미 결제는 끝났다. 쿠폰 기록에 실패했다고 해서 손님의 리포트를 막지 않는다.
           동시 결제로 전제조건이 깨진 경우도 여기로 온다. */
        console.error('[coupon] 결제 후 쿠폰 소모 실패', {
          orderId,
          couponCode,
          message: error instanceof Error ? error.message : 'unknown'
        });
      }
    }

    /*
     * 선물 주문이면 리포트 토큰 대신 **코드**가 결과물이다.
     *
     * 산 사람은 자기 출생정보를 넣지 않았으므로 여기서 만들 리포트가 없다. 코드는
     * 주문번호에서 결정론적으로 나오므로, 같은 결제를 두 번 확인해도 코드가 하나다.
     */
    let gift: { code: string; expiresAt: string } | null = null;

    if (orderClaims.gift === true && this.dependencies.giftService?.enabled) {
      gift = await this.dependencies.giftService.createForPayment({
        orderId,
        paymentId,
        productId,
        amount: payableAmount,
        entitlementId: ledgerDocumentId,
        buyerUserId: user.userId,
        buyerName: user.nickname || '',
        message: body.giftMessage
      });
    }

    const reportAccessToken = this.dependencies.tokenService.createReportAccessToken({
      userId: user.userId,
      orderId,
      paymentId,
      productId,
      amount: payableAmount,
      entitlementId: ledgerDocumentId
    });

    return {
      paymentId,
      txId: portOneTransactionId,
      orderId,
      productId,
      amount: payableAmount,
      couponCode,
      gift,
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
    assertPaymentProviderConfigured(this.dependencies.paymentProvider);
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

    if (productId) {
      assertProductAvailableForExistingAccess(productId);
    }

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
          isProductAvailableForExistingAccess(product?.status) &&
          product?.amount === amount
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
