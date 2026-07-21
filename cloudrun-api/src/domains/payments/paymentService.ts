import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser, PaymentOrderClaims } from '../../contracts/auth.ts';
import { PaymentRequestError, ReportRequestError } from '../../contracts/errors.ts';
import {
  assertProductAvailableForExistingAccess,
  assertProductAvailableForNewOrder,
  getCatalogAmount,
  getProductContract,
  isProductAvailableForExistingAccess,
  SERVER_PRODUCT_CATALOG,
  type ProductId
} from '../../contracts/products.ts';
import {
  getOptionalString,
  getRequiredAmount,
  getRequiredString
} from '../../http/validation.ts';
import {
  ENTITLEMENT_STATUS,
  getAdjustmentKindForOrderStatus,
  getOrderStatusForProviderStatus,
  isPaymentOrderStatus,
  PAYMENT_ORDER_STATUS,
  type EntitlementStatus,
  type PaymentAdjustmentKind,
  type PaymentOrderStatus
} from './paymentContracts.ts';
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
  entitlementUpdatedAt?: string;
  entitlementRevokedAt?: string;
  entitlementRevocationId?: string;
  entitlementRevocationReason?: string;
  entitlementRevocationProviderStatus?: string;
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
  entitlementStatus: typeof ENTITLEMENT_STATUS.ACTIVE;
  entitlementCreatedAt: string;
  entitlementUpdatedAt: string;
}

export type PaymentLedgerCreationResult =
  | void
  | {
      kind: 'created' | 'existing';
      ledger: PaymentLedgerRecord;
    };

export type EntitlementRevocationInput = {
  status: Exclude<EntitlementStatus, typeof ENTITLEMENT_STATUS.ACTIVE>;
  revokedAt: string;
  revocationId: string;
  reason: string;
  providerStatus: string;
};

export interface PaymentLedgerRepository {
  createPaymentLedger(
    record: ConfirmedPaymentLedgerRecord
  ): Promise<PaymentLedgerCreationResult>;
  getPaymentLedger(entitlementId: string): Promise<PaymentLedgerRecord | null>;
  listPaymentLedgersByUserId(userId: string, limit: number): Promise<unknown>;
  revokePaymentEntitlement(
    entitlementId: string,
    input: EntitlementRevocationInput
  ): Promise<PaymentLedgerRecord>;
}

export interface PaymentOrderRecord {
  [field: string]: unknown;
  orderId?: string;
  productId?: string;
  amount?: number;
  currency?: string;
  productStatusSnapshot?: string;
  userId?: string;
  userBinding?: string;
  orderClaimHash?: string;
  status?: string;
  providerStatus?: string;
  paymentId?: string;
  transactionId?: string;
  source?: string;
  createdAt?: string;
  statusUpdatedAt?: string;
  adjustmentId?: string;
  adjustmentKind?: string;
  adjustmentReason?: string;
  adjustmentAt?: string;
}

export interface NewPaymentOrderRecord extends PaymentOrderRecord {
  orderId: string;
  productId: string;
  amount: number;
  currency: 'KRW';
  productStatusSnapshot: string;
  userId: string;
  userBinding: string;
  orderClaimHash: string;
  status: PaymentOrderStatus;
  source: 'created' | 'legacy';
  createdAt: string;
}

export type PaymentOrderAdjustment = {
  id: string;
  kind: PaymentAdjustmentKind;
  reason: string;
  occurredAt: string;
};

export type PaymentOrderTransition = {
  status: PaymentOrderStatus;
  providerStatus: string;
  paymentId: string;
  transactionId: string;
  statusUpdatedAt: string;
  adjustment?: PaymentOrderAdjustment;
};

export type PaymentOrderCreationResult =
  | { kind: 'created' | 'existing'; order: PaymentOrderRecord };

export interface PaymentOrderRepository {
  createPaymentOrder(
    record: NewPaymentOrderRecord
  ): Promise<PaymentOrderCreationResult>;
  getPaymentOrder(orderId: string): Promise<PaymentOrderRecord | null>;
  transitionPaymentOrder(
    order: PaymentOrderRecord,
    input: PaymentOrderTransition
  ): Promise<PaymentOrderRecord>;
}

export type PaymentServiceDependencies = {
  config: PaymentServiceConfig;
  portOneClient: PortOnePaymentClient;
  ledgerRepository: PaymentLedgerRepository;
  orderRepository: PaymentOrderRepository;
  tokenService: PaymentTokenService;
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
};

type VerifiedPaymentContract = {
  paymentId: string;
  orderId: string;
  productId: string;
  amount: number;
  currency: string;
  storeId: string;
  transactionId: string;
  orderClaim: string;
  orderClaimHash: string;
  providerStatus: string;
  method?: string;
  approvedAt?: string;
};

function assertPaymentOrderId(orderId: string) {
  if (!/^UW-[A-Za-z0-9._-]{12,116}$/.test(orderId)) {
    throw new PaymentRequestError(400, 'The payment order ID format is invalid.');
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

function readRecordString(record: Record<string, unknown> | null, field: string) {
  const value = record?.[field];
  return typeof value === 'string' ? value : undefined;
}

function readRecordInteger(record: Record<string, unknown> | null, field: string) {
  const value = record?.[field];
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : NaN;
}

function readRecordTimestamp(record: Record<string, unknown> | null, field: string) {
  const value = record?.[field];
  return typeof value === 'string' ? value : '';
}

function readOrderStatus(order: PaymentOrderRecord): PaymentOrderStatus {
  if (!isPaymentOrderStatus(order.status)) {
    throw new PaymentRequestError(409, 'Stored payment order has an invalid status.');
  }

  return order.status;
}

function getPaymentLedgerDocumentId(paymentId: string) {
  return createHash('sha256').update(`portone:${paymentId}`).digest('hex');
}

function hashOrderClaim(orderClaim: string) {
  return createHash('sha256').update(orderClaim).digest('hex');
}

function getReconciliationId(
  paymentId: string,
  providerStatus: string,
  transactionId: string
) {
  return createHash('sha256')
    .update(`portone-reconciliation:${paymentId}:${providerStatus}:${transactionId}`)
    .digest('hex');
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

function isNotFound(error: unknown) {
  return error instanceof ReportRequestError && error.status === 404;
}

export class PaymentService {
  private readonly now: () => number;
  private readonly generateRandomBytes: (size: number) => Buffer;

  constructor(private readonly dependencies: PaymentServiceDependencies) {
    this.now = dependencies.now || Date.now;
    this.generateRandomBytes = dependencies.randomBytes || randomBytes;
  }

  private async getLedger(entitlementId: string) {
    try {
      return await this.dependencies.ledgerRepository.getPaymentLedger(entitlementId);
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  private assertStoredOrder(
    order: PaymentOrderRecord,
    expected: {
      orderId: string;
      productId: string;
      amount: number;
      userId: string;
      userBinding: string;
      orderClaimHash: string;
    }
  ) {
    if (
      readRecordString(order, 'orderId') !== expected.orderId ||
      readRecordString(order, 'productId') !== expected.productId ||
      readRecordInteger(order, 'amount') !== expected.amount ||
      readRecordString(order, 'currency') !== 'KRW' ||
      readRecordString(order, 'userId') !== expected.userId ||
      readRecordString(order, 'userBinding') !== expected.userBinding ||
      readRecordString(order, 'orderClaimHash') !== expected.orderClaimHash
    ) {
      throw new PaymentRequestError(409, 'Stored payment order does not match this request.');
    }

    readOrderStatus(order);
  }

  private assertLedgerMatches(
    ledger: PaymentLedgerRecord,
    payment: VerifiedPaymentContract,
    user: AuthenticatedUser,
    userBinding: string,
    entitlementId: string,
    allowedStatuses: readonly EntitlementStatus[]
  ) {
    if (
      readRecordString(ledger, 'paymentId') !== payment.paymentId ||
      readRecordString(ledger, 'orderId') !== payment.orderId ||
      readRecordString(ledger, 'productId') !== payment.productId ||
      readRecordInteger(ledger, 'amount') !== payment.amount ||
      readRecordString(ledger, 'currency') !== payment.currency ||
      readRecordString(ledger, 'storeId') !== payment.storeId ||
      readRecordString(ledger, 'transactionId') !== payment.transactionId ||
      readRecordString(ledger, 'userId') !== user.userId ||
      readRecordString(ledger, 'userBinding') !== userBinding ||
      readRecordString(ledger, 'entitlementId') !== entitlementId ||
      readRecordString(ledger, 'orderClaimHash') !== payment.orderClaimHash ||
      !allowedStatuses.includes(
        readRecordString(ledger, 'entitlementStatus') as EntitlementStatus
      )
    ) {
      throw new PaymentRequestError(
        409,
        'The confirmed payment ledger does not match this order.'
      );
    }
  }

  private async transitionOrder(
    order: PaymentOrderRecord,
    input: PaymentOrderTransition
  ) {
    const transitioned = await this.dependencies.orderRepository.transitionPaymentOrder(
      order,
      input
    );

    if (readOrderStatus(transitioned) !== input.status) {
      throw new PaymentRequestError(409, 'Payment order status was not persisted.');
    }

    return transitioned;
  }

  createOrderIntent(user: AuthenticatedUser, body: Record<string, unknown>) {
    const productId = getRequiredString(body, 'productId');
    const product = getProductContract(productId);
    assertProductAvailableForNewOrder(productId);
    const requestedAmount =
      body.amount === undefined ? product.amount : getRequiredAmount(body);
    const orderId =
      getOptionalString(body, 'orderId') ||
      `UW-${this.now()}-${this.generateRandomBytes(16).toString('base64url')}`;

    assertPaymentOrderId(orderId);

    if (requestedAmount !== product.amount) {
      throw new PaymentRequestError(409, '주문 금액이 서버 상품 가격과 일치하지 않습니다.');
    }

    const orderClaim = this.dependencies.tokenService.createPaymentOrderClaim({
      userId: user.userId,
      orderId,
      productId,
      amount: product.amount
    });
    const createdAt = new Date(this.now()).toISOString();
    const userBinding = this.dependencies.tokenService.createUserBinding(user.userId);
    const record: NewPaymentOrderRecord = {
      orderId,
      productId,
      amount: product.amount,
      currency: product.currency,
      productStatusSnapshot: product.status,
      userId: user.userId,
      userBinding,
      orderClaimHash: hashOrderClaim(orderClaim),
      status: PAYMENT_ORDER_STATUS.CREATED,
      source: 'created',
      createdAt
    };
    return this.dependencies.orderRepository.createPaymentOrder(record).then((creation) => {
      this.assertStoredOrder(creation.order, record);

      return {
        orderId,
        productId,
        amount: product.amount,
        currency: product.currency,
        orderStatus: PAYMENT_ORDER_STATUS.CREATED,
        orderClaim,
        orderClaimExpiresAt: new Date(
          this.now() + this.dependencies.config.orderClaimTtlMs
        ).toISOString()
      };
    });
  }

  private verifyPortOnePayment(
    payment: PortOnePayment,
    expected: {
      paymentId: string;
      orderId: string;
      productId: string;
      amount: number;
      suppliedOrderClaim?: string;
      suppliedTransactionId?: string;
    }
  ): VerifiedPaymentContract {
    const providerStatus = String(readNestedString(payment, [['status']]) || '').toUpperCase();
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
    const transactionId = readNestedString(payment, [['transactionId']]);
    const customData = getCustomData(payment);
    const paidProductId =
      typeof customData?.productId === 'string' && customData.productId.trim()
        ? customData.productId.trim()
        : undefined;
    const paidOrderClaim =
      typeof customData?.orderClaim === 'string' && customData.orderClaim.trim()
        ? customData.orderClaim.trim()
        : undefined;
    const configuredStoreId = this.dependencies.config.storeId.trim();

    if (!configuredStoreId) {
      throw new PaymentRequestError(500, 'PORTONE_STORE_ID is not configured on the server.');
    }

    if (!portOnePaymentId || portOnePaymentId !== expected.paymentId) {
      throw new PaymentRequestError(409, 'PortOne payment ID does not match the order.');
    }

    if (!providerStatus) {
      throw new PaymentRequestError(409, 'PortOne payment status is missing.');
    }

    getOrderStatusForProviderStatus(providerStatus, PAYMENT_ORDER_STATUS.CREATED);

    if (!storeId || configuredStoreId !== storeId) {
      throw new PaymentRequestError(409, 'PortOne store ID does not match server configuration.');
    }

    if (currency !== 'KRW') {
      throw new PaymentRequestError(409, 'PortOne payment currency must be KRW.');
    }

    if (paidAmount === null || paidAmount !== expected.amount) {
      throw new PaymentRequestError(409, 'PortOne payment amount does not match the order.');
    }

    if (!paidProductId || paidProductId !== expected.productId) {
      throw new PaymentRequestError(409, 'PortOne product data does not match the order.');
    }

    if (
      !paidOrderClaim ||
      (expected.suppliedOrderClaim && expected.suppliedOrderClaim !== paidOrderClaim)
    ) {
      throw new PaymentRequestError(409, 'PortOne order claim does not match this request.');
    }

    if (
      !transactionId ||
      (expected.suppliedTransactionId &&
        expected.suppliedTransactionId !== transactionId)
    ) {
      throw new PaymentRequestError(409, 'PortOne transaction ID does not match the result.');
    }

    return {
      paymentId: expected.paymentId,
      orderId: expected.orderId,
      productId: expected.productId,
      amount: expected.amount,
      currency,
      storeId,
      transactionId,
      orderClaim: paidOrderClaim,
      orderClaimHash: hashOrderClaim(paidOrderClaim),
      providerStatus,
      method: readNestedString(payment, [['method', 'type'], ['method'], ['payMethod']]),
      approvedAt: readNestedString(payment, [['paidAt'], ['approvedAt']])
    };
  }

  async confirmPayment(user: AuthenticatedUser, body: Record<string, unknown>) {
    const paymentId = getRequiredString(body, 'paymentId');
    const orderId = getRequiredString(body, 'orderId');
    const requestedAmount = getRequiredAmount(body);
    const suppliedTransactionId = getOptionalString(body, 'txId');
    const requestedProductId = getRequiredString(body, 'productId');
    const suppliedOrderClaim = getOptionalString(body, 'orderClaim');

    assertPaymentOrderId(orderId);

    if (paymentId !== orderId) {
      throw new PaymentRequestError(409, 'The payment ID must match the order ID.');
    }

    let order = await this.dependencies.orderRepository.getPaymentOrder(orderId);
    let productId: string;
    let amount: number;

    if (order) {
      productId = readRecordString(order, 'productId') || '';
      amount = readRecordInteger(order, 'amount');

      if (
        readRecordString(order, 'orderId') !== orderId ||
        readRecordString(order, 'userId') !== user.userId ||
        readRecordString(order, 'userBinding') !==
          this.dependencies.tokenService.createUserBinding(user.userId) ||
        !productId ||
        !Number.isSafeInteger(amount) ||
        readRecordString(order, 'currency') !== 'KRW'
      ) {
        throw new PaymentRequestError(404, 'Payment order was not found for this account.');
      }
    } else {
      productId = requestedProductId;
      amount = getCatalogAmount(productId);
      assertProductAvailableForExistingAccess(productId);
    }

    if (requestedProductId !== productId || requestedAmount !== amount) {
      throw new PaymentRequestError(409, 'The requested product or amount does not match the server order.');
    }

    const paymentResponse = await this.dependencies.portOneClient.fetchPayment(paymentId);
    const payment = this.verifyPortOnePayment(paymentResponse, {
      paymentId,
      orderId,
      productId,
      amount,
      suppliedOrderClaim,
      suppliedTransactionId
    });
    const userBinding = this.dependencies.tokenService.createUserBinding(user.userId);

    if (order) {
      this.assertStoredOrder(order, {
        orderId,
        productId,
        amount,
        userId: user.userId,
        userBinding,
        orderClaimHash: payment.orderClaimHash
      });
    }

    const entitlementId = getPaymentLedgerDocumentId(paymentId);
    let ledger = await this.getLedger(entitlementId);

    if (ledger) {
      this.assertLedgerMatches(
        ledger,
        payment,
        user,
        userBinding,
        entitlementId,
        [
          ENTITLEMENT_STATUS.ACTIVE,
          ENTITLEMENT_STATUS.REVOKED,
          ENTITLEMENT_STATUS.REFUNDED
        ]
      );
    } else {
      const orderClaims = this.dependencies.tokenService.verifyPaymentOrderClaim(
        payment.orderClaim,
        user.userId
      );

      if (
        orderClaims.orderId !== orderId ||
        orderClaims.productId !== productId ||
        orderClaims.amount !== amount
      ) {
        throw new PaymentRequestError(
          409,
          'Signed order data does not match PortOne payment data.'
        );
      }
    }

    if (!order) {
      const product = getProductContract(productId);
      const createdAt = new Date(this.now()).toISOString();
      const recovered: NewPaymentOrderRecord = {
        orderId,
        productId,
        amount,
        currency: 'KRW',
        productStatusSnapshot: product.status,
        userId: user.userId,
        userBinding,
        orderClaimHash: payment.orderClaimHash,
        status: ledger ? PAYMENT_ORDER_STATUS.PAID : PAYMENT_ORDER_STATUS.CREATED,
        source: 'legacy',
        createdAt
      };
      const creation = await this.dependencies.orderRepository.createPaymentOrder(recovered);
      order = creation.order;
      this.assertStoredOrder(order, recovered);
    }

    let currentStatus = readOrderStatus(order);
    const isProviderCancellation =
      payment.providerStatus === 'CANCELLED' ||
      payment.providerStatus === 'PARTIAL_CANCELLED';
    const statusUpdatedAt = new Date(this.now()).toISOString();

    if (
      isProviderCancellation &&
      ledger &&
      (currentStatus === PAYMENT_ORDER_STATUS.CREATED ||
        currentStatus === PAYMENT_ORDER_STATUS.PENDING)
    ) {
      order = await this.transitionOrder(order, {
        status: PAYMENT_ORDER_STATUS.PAID,
        providerStatus: 'PAID',
        paymentId,
        transactionId: payment.transactionId,
        statusUpdatedAt:
          readRecordTimestamp(ledger, 'confirmedAt') || statusUpdatedAt
      });
      currentStatus = PAYMENT_ORDER_STATUS.PAID;
    }

    const targetStatus = getOrderStatusForProviderStatus(
      payment.providerStatus,
      currentStatus
    );

    if (payment.providerStatus === 'PAID') {
      const confirmedAt = statusUpdatedAt;
      const proposedLedger: ConfirmedPaymentLedgerRecord = {
        paymentId,
        orderId,
        productId,
        amount,
        currency: payment.currency,
        storeId: payment.storeId,
        transactionId: payment.transactionId,
        confirmedAt,
        userId: user.userId,
        userBinding,
        entitlementId,
        orderClaimHash: payment.orderClaimHash,
        entitlementStatus: ENTITLEMENT_STATUS.ACTIVE,
        entitlementCreatedAt: confirmedAt,
        entitlementUpdatedAt: confirmedAt
      };

      if (!ledger) {
        try {
          const creation = await this.dependencies.ledgerRepository.createPaymentLedger(
            proposedLedger
          );
          ledger = creation && 'ledger' in creation ? creation.ledger : proposedLedger;
        } catch (error) {
          if (!(error instanceof ReportRequestError) || error.status !== 409) {
            throw error;
          }
          ledger = await this.getLedger(entitlementId);
        }
      }

      if (!ledger) {
        throw new PaymentRequestError(409, 'Payment entitlement was not persisted.');
      }

      this.assertLedgerMatches(
        ledger,
        payment,
        user,
        userBinding,
        entitlementId,
        [ENTITLEMENT_STATUS.ACTIVE]
      );

      order = await this.transitionOrder(order, {
        status: PAYMENT_ORDER_STATUS.PAID,
        providerStatus: payment.providerStatus,
        paymentId,
        transactionId: payment.transactionId,
        statusUpdatedAt
      });

      if (readOrderStatus(order) !== PAYMENT_ORDER_STATUS.PAID) {
        throw new PaymentRequestError(409, 'Paid order state was not persisted.');
      }

      const entitlementCreatedAt =
        readRecordTimestamp(ledger, 'entitlementCreatedAt') ||
        readRecordTimestamp(ledger, 'confirmedAt');
      const reportAccessToken = this.dependencies.tokenService.createReportAccessToken({
        userId: user.userId,
        orderId,
        paymentId,
        productId,
        amount,
        entitlementId
      });

      return {
        paymentId,
        txId: payment.transactionId,
        orderId,
        productId,
        amount,
        currency: payment.currency,
        status: payment.providerStatus,
        orderStatus: PAYMENT_ORDER_STATUS.PAID,
        entitlement: {
          id: entitlementId,
          status: ENTITLEMENT_STATUS.ACTIVE,
          createdAt: entitlementCreatedAt
        },
        method: payment.method,
        approvedAt: payment.approvedAt,
        reportAccessToken,
        reportAccessTokenExpiresAt: new Date(
          this.now() + this.dependencies.config.reportAccessTokenTtlMs
        ).toISOString()
      };
    }

    let persistedTargetStatus = targetStatus;

    if (isProviderCancellation && ledger) {
      const revocationId = getReconciliationId(
        paymentId,
        payment.providerStatus,
        payment.transactionId
      );
      ledger = await this.dependencies.ledgerRepository.revokePaymentEntitlement(
        entitlementId,
        {
          status: ENTITLEMENT_STATUS.REFUNDED,
          revokedAt: statusUpdatedAt,
          revocationId,
          reason: 'PortOne payment reconciliation',
          providerStatus: payment.providerStatus
        }
      );

      if (
        readRecordString(ledger, 'entitlementStatus') !==
          ENTITLEMENT_STATUS.REFUNDED ||
        readRecordString(ledger, 'entitlementRevocationId') !== revocationId
      ) {
        throw new PaymentRequestError(409, 'Entitlement revocation was not persisted.');
      }

      persistedTargetStatus = PAYMENT_ORDER_STATUS.REFUNDED;
    }

    const adjustmentKind = getAdjustmentKindForOrderStatus(persistedTargetStatus);
    const adjustment = adjustmentKind
      ? {
          id: getReconciliationId(
            paymentId,
            payment.providerStatus,
            payment.transactionId
          ),
          kind: adjustmentKind,
          reason: 'PortOne payment reconciliation',
          occurredAt: statusUpdatedAt
        }
      : undefined;

    await this.transitionOrder(order, {
      status: persistedTargetStatus,
      providerStatus: payment.providerStatus,
      paymentId,
      transactionId: payment.transactionId,
      statusUpdatedAt,
      adjustment
    });

    throw new PaymentRequestError(
      409,
      `PortOne payment is not paid. Current status: ${payment.providerStatus}`
    );
  }

  async renewEntitlement(user: AuthenticatedUser, body: Record<string, unknown>) {
    const orderId = getRequiredString(body, 'orderId');
    assertPaymentOrderId(orderId);
    const documentId = getPaymentLedgerDocumentId(orderId);
    const ledger = await this.getLedger(documentId);

    if (!ledger || readRecordString(ledger, 'userId') !== user.userId) {
      throw new PaymentRequestError(
        404,
        'No recoverable payment entitlement belongs to this account.'
      );
    }

    const paymentId = readRecordString(ledger, 'paymentId');
    const storedOrderId = readRecordString(ledger, 'orderId');
    const productId = readRecordString(ledger, 'productId');
    const userBinding = readRecordString(ledger, 'userBinding');
    const amount = readRecordInteger(ledger, 'amount');
    const expectedBinding = this.dependencies.tokenService.createUserBinding(user.userId);
    const order = await this.dependencies.orderRepository.getPaymentOrder(orderId);

    if (order) {
      if (
        readRecordString(order, 'userId') !== user.userId ||
        readRecordString(order, 'userBinding') !== expectedBinding ||
        readRecordString(order, 'productId') !== productId ||
        readRecordInteger(order, 'amount') !== amount ||
        readOrderStatus(order) !== PAYMENT_ORDER_STATUS.PAID
      ) {
        throw new PaymentRequestError(409, 'Payment order cannot renew this entitlement.');
      }
    } else if (productId) {
      assertProductAvailableForExistingAccess(productId);

      if (amount !== getCatalogAmount(productId)) {
        throw new PaymentRequestError(409, 'Legacy entitlement amount is invalid.');
      }
    }

    if (
      paymentId !== orderId ||
      storedOrderId !== orderId ||
      !productId ||
      !Number.isSafeInteger(amount) ||
      userBinding !== expectedBinding ||
      readRecordString(ledger, 'entitlementId') !== documentId ||
      readRecordString(ledger, 'entitlementStatus') !== ENTITLEMENT_STATUS.ACTIVE
    ) {
      throw new PaymentRequestError(409, 'The stored payment entitlement failed integrity checks.');
    }

    const reportAccessToken = this.dependencies.tokenService.createReportAccessToken({
      userId: user.userId,
      orderId,
      paymentId,
      productId,
      amount,
      entitlementId: documentId
    });
    const entitlementCreatedAt =
      readRecordTimestamp(ledger, 'entitlementCreatedAt') ||
      readRecordTimestamp(ledger, 'confirmedAt');

    return {
      orderId,
      productId,
      amount,
      currency: readRecordString(ledger, 'currency') || 'KRW',
      entitlement: {
        id: documentId,
        status: ENTITLEMENT_STATUS.ACTIVE,
        createdAt: entitlementCreatedAt
      },
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
        const productId = readRecordString(record, 'productId');
        const amount = readRecordInteger(record, 'amount');
        const product = productId
          ? SERVER_PRODUCT_CATALOG[productId as ProductId]
          : undefined;

        return (
          readRecordString(record, 'userId') === user.userId &&
          readRecordString(record, 'userBinding') ===
            this.dependencies.tokenService.createUserBinding(user.userId) &&
          readRecordString(record, 'entitlementStatus') === ENTITLEMENT_STATUS.ACTIVE &&
          Boolean(productId) &&
          Number.isSafeInteger(amount) &&
          isProductAvailableForExistingAccess(product?.status) &&
          product?.amount === amount
        );
      })
      .map((record) => ({
        orderId: readRecordString(record, 'orderId'),
        productId: readRecordString(record, 'productId'),
        amount: readRecordInteger(record, 'amount'),
        currency: readRecordString(record, 'currency') || 'KRW',
        confirmedAt: readRecordTimestamp(record, 'confirmedAt'),
        status: ENTITLEMENT_STATUS.ACTIVE
      }))
      .filter((entry) => Boolean(entry.orderId))
      .sort((left, right) => Date.parse(right.confirmedAt) - Date.parse(left.confirmedAt));
  }
}

export function createPaymentService(dependencies: PaymentServiceDependencies) {
  return new PaymentService(dependencies);
}
