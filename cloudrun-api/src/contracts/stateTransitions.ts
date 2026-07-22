import { timingSafeEqual } from 'node:crypto';
import type {
  CompatibleReportArchive,
  EntitlementStatus,
  OrderStatus,
  PaymentStatus,
  ProductCatalogSnapshot,
  ProductCatalogSnapshotStatus,
  ReportArchiveStatus,
  ReportGenerationJob,
  ReportGenerationJobStatus,
  UserAccountStatus
} from './models.ts';
import {
  PRODUCT_STATUS,
  SERVER_PRODUCT_CATALOG,
  type ProductId,
  type ProductStatus,
  type ServerProductCatalog
} from './products.ts';
import { DataContractError, isKnownProductId, isSha256Hex } from './validation.ts';

export {
  getReportGenerationIdempotencyKey,
  getReportGenerationJobId
} from './resourceIdentity.ts';

export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  created: ['pending'],
  pending: ['paid', 'failed', 'cancelled'],
  paid: ['refunded'],
  failed: [],
  cancelled: [],
  refunded: []
} satisfies Record<OrderStatus, readonly OrderStatus[]>);

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus) {
  return ORDER_STATUS_TRANSITIONS[from].includes(to as never);
}

export function assertOrderStatusTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransitionOrderStatus(from, to)) {
    throw new DataContractError(
      'ORDER_STATUS_TRANSITION_FORBIDDEN',
      `Order status cannot transition from ${from} to ${to}.`,
      409
    );
  }
}

/**
 * Repeated provider callbacks may request the already-stored status. That is
 * an idempotent no-op, not an additional state-machine edge.
 */
export function assertOrderStatusUpdate(from: OrderStatus, to: OrderStatus) {
  if (from === to) {
    return 'noop' as const;
  }

  assertOrderStatusTransition(from, to);
  return 'transition' as const;
}

export const PAYMENT_STATUS_TRANSITIONS = Object.freeze({
  pending: ['paid', 'failed', 'cancelled'],
  paid: ['refunded'],
  failed: [],
  cancelled: [],
  refunded: []
} satisfies Record<PaymentStatus, readonly PaymentStatus[]>);

export const ENTITLEMENT_STATUS_TRANSITIONS = Object.freeze({
  active: ['revoked'],
  revoked: []
} satisfies Record<EntitlementStatus, readonly EntitlementStatus[]>);

export const REPORT_GENERATION_JOB_STATUS_TRANSITIONS = Object.freeze({
  queued: ['generating', 'cancelled'],
  generating: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: ['generating', 'cancelled'],
  cancelled: []
} satisfies Record<ReportGenerationJobStatus, readonly ReportGenerationJobStatus[]>);

export const USER_ACCOUNT_STATUS_TRANSITIONS = Object.freeze({
  active: ['disabled', 'anonymized'],
  disabled: ['active', 'anonymized'],
  anonymized: []
} satisfies Record<UserAccountStatus, readonly UserAccountStatus[]>);

export const PRODUCT_CATALOG_SNAPSHOT_STATUS_TRANSITIONS = Object.freeze({
  current: ['superseded'],
  superseded: []
} satisfies Record<
  ProductCatalogSnapshotStatus,
  readonly ProductCatalogSnapshotStatus[]
>);

export const REPORT_ARCHIVE_STATUS_TRANSITIONS = Object.freeze({
  available: ['deleted'],
  deleted: []
} satisfies Record<ReportArchiveStatus, readonly ReportArchiveStatus[]>);

function canTransitionStatus<TStatus extends string>(
  transitions: Readonly<Record<TStatus, readonly TStatus[]>>,
  from: TStatus,
  to: TStatus
) {
  return transitions[from].includes(to);
}

function assertStatusTransition<TStatus extends string>(
  model: string,
  transitions: Readonly<Record<TStatus, readonly TStatus[]>>,
  from: TStatus,
  to: TStatus
) {
  if (!canTransitionStatus(transitions, from, to)) {
    throw new DataContractError(
      `${model.toUpperCase()}_STATUS_TRANSITION_FORBIDDEN`,
      `${model} status cannot transition from ${from} to ${to}.`,
      409
    );
  }
}

export const canTransitionPaymentStatus = (from: PaymentStatus, to: PaymentStatus) =>
  canTransitionStatus(PAYMENT_STATUS_TRANSITIONS, from, to);
export const assertPaymentStatusTransition = (from: PaymentStatus, to: PaymentStatus) =>
  assertStatusTransition('PAYMENT', PAYMENT_STATUS_TRANSITIONS, from, to);
export const canTransitionEntitlementStatus = (from: EntitlementStatus, to: EntitlementStatus) =>
  canTransitionStatus(ENTITLEMENT_STATUS_TRANSITIONS, from, to);
export const assertEntitlementStatusTransition = (from: EntitlementStatus, to: EntitlementStatus) =>
  assertStatusTransition('ENTITLEMENT', ENTITLEMENT_STATUS_TRANSITIONS, from, to);
export const canTransitionReportGenerationJobStatus = (
  from: ReportGenerationJobStatus,
  to: ReportGenerationJobStatus
) => canTransitionStatus(REPORT_GENERATION_JOB_STATUS_TRANSITIONS, from, to);
export const assertReportGenerationJobStatusTransition = (
  from: ReportGenerationJobStatus,
  to: ReportGenerationJobStatus
) => assertStatusTransition('REPORT_GENERATION_JOB', REPORT_GENERATION_JOB_STATUS_TRANSITIONS, from, to);
export const canTransitionUserAccountStatus = (from: UserAccountStatus, to: UserAccountStatus) =>
  canTransitionStatus(USER_ACCOUNT_STATUS_TRANSITIONS, from, to);
export const canTransitionProductCatalogSnapshotStatus = (
  from: ProductCatalogSnapshotStatus,
  to: ProductCatalogSnapshotStatus
) => canTransitionStatus(PRODUCT_CATALOG_SNAPSHOT_STATUS_TRANSITIONS, from, to);
export const canTransitionReportArchiveStatus = (from: ReportArchiveStatus, to: ReportArchiveStatus) =>
  canTransitionStatus(REPORT_ARCHIVE_STATUS_TRANSITIONS, from, to);

export type ProductAccessPolicy = Readonly<{
  canStartIntake: boolean;
  canCreateOrder: boolean;
  canConfirmExistingPayment: boolean;
  canRecoverEntitlement: boolean;
  canReadHistoricalReport: boolean;
}>;

export const PRODUCT_ACCESS_POLICIES = Object.freeze({
  [PRODUCT_STATUS.ACTIVE]: {
    canStartIntake: true,
    canCreateOrder: true,
    canConfirmExistingPayment: true,
    canRecoverEntitlement: true,
    canReadHistoricalReport: true
  },
  [PRODUCT_STATUS.DRAFT]: {
    canStartIntake: false,
    canCreateOrder: false,
    canConfirmExistingPayment: false,
    canRecoverEntitlement: false,
    canReadHistoricalReport: false
  },
  [PRODUCT_STATUS.ARCHIVED]: {
    canStartIntake: false,
    canCreateOrder: false,
    canConfirmExistingPayment: true,
    canRecoverEntitlement: true,
    canReadHistoricalReport: true
  }
} satisfies Record<ProductStatus, ProductAccessPolicy>);

export function getProductAccessPolicy(status: ProductStatus): ProductAccessPolicy {
  return PRODUCT_ACCESS_POLICIES[status];
}

export function getProductAccessPolicyById(
  productId: string,
  catalog: ServerProductCatalog = SERVER_PRODUCT_CATALOG
): ProductAccessPolicy | null {
  const product = catalog[productId];
  return product ? getProductAccessPolicy(product.status) : null;
}

export function canCreateOrderForProduct(
  productId: string,
  catalog: ServerProductCatalog = SERVER_PRODUCT_CATALOG
) {
  return getProductAccessPolicyById(productId, catalog)?.canCreateOrder === true;
}

export function canAccessExistingProductData(
  productId: string,
  catalog: ServerProductCatalog = SERVER_PRODUCT_CATALOG
) {
  const policy = getProductAccessPolicyById(productId, catalog);
  return Boolean(
    policy?.canConfirmExistingPayment &&
      policy.canRecoverEntitlement &&
      policy.canReadHistoricalReport
  );
}

export function assertKnownProduct(productId: string): asserts productId is ProductId {
  if (!isKnownProductId(productId)) {
    throw new DataContractError('PRODUCT_UNKNOWN', 'Unknown product is not allowed.', 400);
  }
}

export function assertProductCanCreateOrder(
  productId: string,
  catalog: ServerProductCatalog = SERVER_PRODUCT_CATALOG
) {
  if (!catalog[productId]) {
    throw new DataContractError('PRODUCT_UNKNOWN', 'Unknown product is not allowed.', 400);
  }

  if (!canCreateOrderForProduct(productId, catalog)) {
    throw new DataContractError(
      'PRODUCT_NOT_FOR_SALE',
      'This product is not available for a new order.',
      409
    );
  }
}

export function assertProductAllowsExistingAccess(
  productId: string,
  catalog: ServerProductCatalog = SERVER_PRODUCT_CATALOG
) {
  if (!catalog[productId]) {
    throw new DataContractError('PRODUCT_UNKNOWN', 'Unknown product is not allowed.', 400);
  }

  if (!canAccessExistingProductData(productId, catalog)) {
    throw new DataContractError(
      'PRODUCT_ACCESS_UNAVAILABLE',
      'This product is not available for existing access.',
      409
    );
  }
}

export const ENTITLEMENT_REQUIRES_PAID_PAYMENT = 'ENTITLEMENT_REQUIRES_PAID_PAYMENT';
export const REFUND_ENTITLEMENT_POLICY_DECISION_REQUIRED =
  'REFUND_ENTITLEMENT_POLICY_DECISION_REQUIRED';

export function canIssueActiveEntitlement(paymentStatus: PaymentStatus) {
  return paymentStatus === 'paid';
}

export function assertCanIssueActiveEntitlement(paymentStatus: PaymentStatus) {
  if (!canIssueActiveEntitlement(paymentStatus)) {
    throw new DataContractError(
      ENTITLEMENT_REQUIRES_PAID_PAYMENT,
      'An active entitlement requires a paid payment.',
      409
    );
  }
}

export type ExistingEntitlementPaymentDecision =
  | Readonly<{
      action: 'keep-current-status';
      entitlementStatus: EntitlementStatus;
      automaticallyRevoked: false;
    }>
  | Readonly<{
      action: 'policy-decision-required';
      code: typeof REFUND_ENTITLEMENT_POLICY_DECISION_REQUIRED;
      entitlementStatus: EntitlementStatus;
      automaticallyRevoked: false;
    }>;

export function evaluateExistingEntitlementAfterPaymentStatus(
  paymentStatus: PaymentStatus,
  entitlementStatus: EntitlementStatus
): ExistingEntitlementPaymentDecision {
  if (paymentStatus === 'refunded' && entitlementStatus === 'active') {
    return {
      action: 'policy-decision-required',
      code: REFUND_ENTITLEMENT_POLICY_DECISION_REQUIRED,
      entitlementStatus,
      automaticallyRevoked: false
    };
  }

  return {
    action: 'keep-current-status',
    entitlementStatus,
    automaticallyRevoked: false
  };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function isSameReportGenerationRequest(
  existing: Pick<ReportGenerationJob, 'entitlementId' | 'inputHash'>,
  entitlementId: string,
  inputHash: string
) {
  return (
    safeEqual(existing.entitlementId, entitlementId) &&
    safeEqual(existing.inputHash, inputHash)
  );
}

export function assertReportInputImmutable(
  existing: Pick<ReportGenerationJob, 'entitlementId' | 'inputHash'>,
  entitlementId: string,
  inputHash: string
) {
  if (!safeEqual(existing.entitlementId, entitlementId)) {
    throw new DataContractError(
      'REPORT_ENTITLEMENT_CONFLICT',
      'Report generation job belongs to another entitlement.',
      409
    );
  }

  if (!safeEqual(existing.inputHash, inputHash)) {
    throw new DataContractError(
      'REPORT_INPUT_CONFLICT',
      'This entitlement is already bound to a different report input.',
      409
    );
  }
}

export function canAccessReportArchive(
  archive: Pick<CompatibleReportArchive, 'ownerUserId' | 'status'>,
  requesterUserId: string
) {
  return (
    archive.status === 'available' &&
    requesterUserId.length > 0 &&
    safeEqual(archive.ownerUserId, requesterUserId)
  );
}

export function assertReportArchiveOwnership(
  archive: Pick<CompatibleReportArchive, 'ownerUserId' | 'status'> | null,
  requesterUserId: string
) {
  if (!archive || !canAccessReportArchive(archive, requesterUserId)) {
    // Missing and foreign resources deliberately share the same response.
    throw new DataContractError(
      'REPORT_ARCHIVE_NOT_FOUND',
      'Report archive was not found.',
      404
    );
  }
}

export function getSnapshotProductStatus(
  snapshot: ProductCatalogSnapshot,
  productId: ProductId
) {
  return snapshot.products.find((product) => product.productId === productId)?.status;
}
