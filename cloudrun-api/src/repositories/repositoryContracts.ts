import type {
  AdminAuditEvent,
  CompatibleReportArchive,
  Entitlement,
  Order,
  Payment,
  ProductCatalogSnapshot,
  ReportArchive,
  ReportGenerationJob,
  UserAccount,
  OrderStatus,
  PaymentStatus,
  UserAccountStatus
} from '../contracts/models.ts';

export type RepositoryWriteResult<T> = Readonly<{
  kind: 'created' | 'updated' | 'existing';
  value: T;
}>;

export type RepositoryListOptions = Readonly<{
  limit?: number;
  cursor?: string;
}>;

export type RepositoryListResult<T> = Readonly<{
  items: readonly T[];
  nextCursor?: string;
}>;

export type PaidPayment = Payment & Readonly<{
  status: 'paid';
  confirmedAt: string;
}>;

export type ActiveEntitlement = Entitlement & Readonly<{
  status: 'active';
}>;

export type RepositoryStatusTransition<TStatus extends string> = Readonly<{
  expectedStatus: TStatus;
  nextStatus: TStatus;
  updatedAt: string;
  idempotencyKey: string;
}>;

export type ReportJobLease = Readonly<{
  expectedStatus: 'queued' | 'failed';
  entitlementId: string;
  inputHash: string;
  leaseId: string;
  leaseExpiresAt: string;
  startedAt: string;
  idempotencyKey: string;
}>;

interface CreateOnlyRepository<T> {
  create(value: T): Promise<RepositoryWriteResult<T>>;
}

export interface UserAccountRepositoryContract
{
  getById(userId: string): Promise<UserAccount | null>;
  findByProviderIdentity(
    provider: string,
    providerUserId: string
  ): Promise<UserAccount | null>;
  upsertFromVerifiedIdentity(
    value: UserAccount,
    expectedUpdatedAt?: string
  ): Promise<RepositoryWriteResult<UserAccount>>;
  transitionStatus(
    userId: string,
    transition: RepositoryStatusTransition<UserAccountStatus>
  ): Promise<RepositoryWriteResult<UserAccount>>;
}

export interface ProductCatalogSnapshotRepositoryContract
  extends CreateOnlyRepository<ProductCatalogSnapshot> {
  getById(catalogSnapshotId: string): Promise<ProductCatalogSnapshot | null>;
  getCurrent(): Promise<ProductCatalogSnapshot | null>;
  markSuperseded(
    catalogSnapshotId: string,
    updatedAt: string
  ): Promise<RepositoryWriteResult<ProductCatalogSnapshot>>;
}

export interface OrderRepositoryContract
  extends CreateOnlyRepository<Order> {
  getById(orderId: string): Promise<Order | null>;
  listByOwner(
    ownerUserId: string,
    options?: RepositoryListOptions
  ): Promise<RepositoryListResult<Order>>;
  transitionStatus(
    orderId: string,
    transition: RepositoryStatusTransition<OrderStatus>
  ): Promise<RepositoryWriteResult<Order>>;
}

export interface PaymentRepositoryContract
  extends CreateOnlyRepository<Payment> {
  getById(paymentId: string): Promise<Payment | null>;
  getByOrderId(orderId: string): Promise<Payment | null>;
  getByIdempotencyKey(idempotencyKey: string): Promise<Payment | null>;
  listByOwner(
    ownerUserId: string,
    options?: RepositoryListOptions
  ): Promise<RepositoryListResult<Payment>>;
  transitionProviderStatus(
    paymentId: string,
    transition: RepositoryStatusTransition<PaymentStatus>
  ): Promise<RepositoryWriteResult<Payment>>;
}

export interface EntitlementRepositoryContract {
  getById(entitlementId: string): Promise<Entitlement | null>;
  getByOrderId(orderId: string): Promise<Entitlement | null>;
  getByPaymentId(paymentId: string): Promise<Entitlement | null>;
  listByOwner(
    ownerUserId: string,
    options?: RepositoryListOptions
  ): Promise<RepositoryListResult<Entitlement>>;
  issueFromPaidPayment(input: Readonly<{
    payment: PaidPayment;
    entitlement: ActiveEntitlement;
  }>): Promise<RepositoryWriteResult<Entitlement>>;
  revoke(input: Readonly<{
    entitlementId: string;
    expectedStatus: 'active';
    revokedAt: string;
    revocationReason: string;
    idempotencyKey: string;
  }>): Promise<RepositoryWriteResult<Entitlement>>;
}

export interface ReportGenerationJobRepositoryContract {
  createForEntitlement(input: Readonly<Pick<
    ReportGenerationJob,
    | 'orderId'
    | 'entitlementId'
    | 'productId'
    | 'ownerUserId'
    | 'userBinding'
    | 'inputHash'
    | 'createdAt'
    | 'provider'
  >>): Promise<RepositoryWriteResult<ReportGenerationJob>>;
  getById(jobId: string): Promise<ReportGenerationJob | null>;
  getByEntitlementAndInputHash(
    entitlementId: string,
    inputHash: string
  ): Promise<ReportGenerationJob | null>;
  acquire(jobId: string, lease: ReportJobLease): Promise<RepositoryWriteResult<ReportGenerationJob>>;
  complete(input: Readonly<{
    jobId: string;
    expectedStatus: 'generating';
    leaseId: string;
    inputHash: string;
    completedAt: string;
    idempotencyKey: string;
  }>): Promise<RepositoryWriteResult<ReportGenerationJob>>;
  fail(input: Readonly<{
    jobId: string;
    expectedStatus: 'generating';
    leaseId: string;
    inputHash: string;
    failedAt: string;
    errorCode: string;
    idempotencyKey: string;
  }>): Promise<RepositoryWriteResult<ReportGenerationJob>>;
  cancel(input: Readonly<{
    jobId: string;
    expectedStatus: 'queued' | 'generating';
    leaseId?: string;
    inputHash: string;
    cancelledAt: string;
    idempotencyKey: string;
  }>): Promise<RepositoryWriteResult<ReportGenerationJob>>;
}

export interface ReportArchiveRepositoryContract {
  getByIdForOwner(
    ownerUserId: string,
    archiveId: string
  ): Promise<CompatibleReportArchive | null>;
  listByOwner(
    ownerUserId: string,
    options?: RepositoryListOptions
  ): Promise<RepositoryListResult<CompatibleReportArchive>>;
  upsertForOwner(
    authenticatedOwnerUserId: string,
    value: ReportArchive,
    expectedUpdatedAt?: string
  ): Promise<RepositoryWriteResult<ReportArchive>>;
}

export interface AdminAuditEventRepositoryContract
  extends CreateOnlyRepository<AdminAuditEvent> {
  getById(eventId: string): Promise<AdminAuditEvent | null>;
  listByActor(
    actorAdminId: string,
    options?: RepositoryListOptions
  ): Promise<RepositoryListResult<AdminAuditEvent>>;
}
