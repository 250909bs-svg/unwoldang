import type { ProductId, ProductStatus } from './products.ts';

export const DATA_SCHEMA_VERSION = 1 as const;

export type DataSchemaVersion = typeof DATA_SCHEMA_VERSION;
export type IsoDateTime = string;
export type Sha256Hex = string;
export type Currency = 'KRW';

export interface VersionedEntity {
  schemaVersion: DataSchemaVersion;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  idempotencyKey: string;
}

export const USER_ACCOUNT_STATUSES = ['active', 'disabled', 'anonymized'] as const;
export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export interface UserAccount extends VersionedEntity {
  userId: string;
  ownerUserId: string;
  productId: null;
  provider: 'kakao';
  providerUserId: string;
  status: UserAccountStatus;
  nickname?: string;
  email?: string;
  avatarUrl?: string;
  lastAuthenticatedAt: IsoDateTime;
}

export const PRODUCT_CATALOG_SNAPSHOT_STATUSES = ['current', 'superseded'] as const;
export type ProductCatalogSnapshotStatus =
  (typeof PRODUCT_CATALOG_SNAPSHOT_STATUSES)[number];

export interface ProductCatalogItemSnapshot {
  productId: ProductId;
  displayName: string;
  amount: number;
  currency: Currency;
  status: ProductStatus;
}

export interface ProductCatalogSnapshot extends VersionedEntity {
  catalogSnapshotId: Sha256Hex;
  ownerUserId: null;
  productId: null;
  status: ProductCatalogSnapshotStatus;
  effectiveAt: IsoDateTime;
  products: readonly ProductCatalogItemSnapshot[];
  catalogHash: Sha256Hex;
}

export const ORDER_STATUSES = [
  'created',
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded'
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Order extends VersionedEntity {
  orderId: string;
  ownerUserId: string;
  userBinding: string;
  productId: ProductId;
  catalogSnapshotId: Sha256Hex;
  amount: number;
  currency: Currency;
  status: OrderStatus;
  paidAt?: IsoDateTime;
  failedAt?: IsoDateTime;
  cancelledAt?: IsoDateTime;
  refundedAt?: IsoDateTime;
}

export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded'
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface Payment extends VersionedEntity {
  paymentId: string;
  orderId: string;
  ownerUserId: string;
  userBinding: string;
  productId: ProductId;
  amount: number;
  currency: Currency;
  storeId: string;
  transactionId: string;
  provider: 'portone';
  status: PaymentStatus;
  approvedAt?: IsoDateTime;
  confirmedAt?: IsoDateTime;
  refundedAt?: IsoDateTime;
}

export const ENTITLEMENT_STATUSES = ['active', 'revoked'] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export interface Entitlement extends VersionedEntity {
  entitlementId: Sha256Hex;
  paymentId: string;
  orderId: string;
  productId: ProductId;
  ownerUserId: string;
  userBinding: string;
  status: EntitlementStatus;
  issuedAt: IsoDateTime;
  revokedAt?: IsoDateTime;
  revocationReason?: string;
}

export const REPORT_GENERATION_JOB_STATUSES = [
  'queued',
  'generating',
  'completed',
  'failed',
  'cancelled'
] as const;
export type ReportGenerationJobStatus =
  (typeof REPORT_GENERATION_JOB_STATUSES)[number];

export interface ReportGenerationJob extends VersionedEntity {
  jobId: Sha256Hex;
  orderId: string;
  entitlementId: Sha256Hex;
  productId: ProductId;
  ownerUserId: string;
  userBinding: string;
  inputHash: Sha256Hex;
  status: ReportGenerationJobStatus;
  attemptCount: number;
  provider?: string;
  leaseId?: string;
  leaseExpiresAt?: IsoDateTime;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  failedAt?: IsoDateTime;
  cancelledAt?: IsoDateTime;
  errorCode?: string;
}

export const REPORT_ARCHIVE_STATUSES = ['available', 'deleted'] as const;
export type ReportArchiveStatus = (typeof REPORT_ARCHIVE_STATUSES)[number];

export interface ReportArchive extends VersionedEntity {
  archiveId: string;
  orderId: string;
  entitlementId: Sha256Hex;
  productId: ProductId;
  ownerUserId: string;
  userBinding: string;
  status: ReportArchiveStatus;
  reportData: Record<string, unknown>;
  reportProvider: string;
  reportVersion: number;
}

/**
 * Read-only projection for schema-less reportArchives documents. It keeps the
 * owner boundary explicit without inventing an entitlement or auth binding.
 * New writes must use the strict ReportArchive contract above.
 */
export type LegacyReportArchiveProjection = Omit<
  ReportArchive,
  'orderId' | 'entitlementId' | 'userBinding'
> & {
  sourceSchemaVersion: 0;
  orderId: string | null;
  entitlementId: null;
  userBinding: null;
};

export type CompatibleReportArchive = ReportArchive | LegacyReportArchiveProjection;

export const ADMIN_AUDIT_EVENT_STATUSES = ['succeeded', 'denied', 'failed'] as const;
export type AdminAuditEventStatus = (typeof ADMIN_AUDIT_EVENT_STATUSES)[number];

export type AdminAuditMetadataValue = string | number | boolean;

export interface AdminAuditEvent extends VersionedEntity {
  eventId: string;
  actorAdminId: string;
  ownerUserId: string | null;
  productId: ProductId | null;
  status: AdminAuditEventStatus;
  action: string;
  resourceType: string;
  resourceIdHash?: Sha256Hex;
  requestId: string;
  metadata?: Readonly<Record<string, AdminAuditMetadataValue>>;
}

export type DataModelName =
  | 'UserAccount'
  | 'ProductCatalogSnapshot'
  | 'Order'
  | 'Payment'
  | 'Entitlement'
  | 'ReportGenerationJob'
  | 'ReportArchive'
  | 'AdminAuditEvent';

export type RetentionMetadata = Readonly<{
  period: string;
  trigger: string;
  automaticDeletionEnabled: false;
  legalReviewRequired: boolean;
}>;

export type ModelContractMetadata = Readonly<{
  idField: string;
  idFormat: string;
  ownerField: string | null;
  productField: string | null;
  statusField: string;
  serverAuthorityFields: readonly string[];
  clientWritableFields: readonly string[];
  forbiddenClientFields: readonly string[];
  piiFields: readonly string[];
  sensitiveFields: readonly string[];
  retention: RetentionMetadata;
  deletionPolicy: string;
  idempotencyRule: string;
  indexRequirements: readonly string[];
}>;

const COMMON_SERVER_FIELDS = [
  'schemaVersion',
  'createdAt',
  'updatedAt',
  'idempotencyKey',
  'status'
] as const;

export const DATA_MODEL_METADATA = Object.freeze({
  UserAccount: {
    idField: 'userId',
    idFormat: 'Opaque verified Kakao subject; non-empty, at most 128 characters',
    ownerField: 'ownerUserId',
    productField: null,
    statusField: 'status',
    serverAuthorityFields: [
      ...COMMON_SERVER_FIELDS,
      'userId',
      'ownerUserId',
      'provider',
      'providerUserId',
      'lastAuthenticatedAt'
    ],
    clientWritableFields: [],
    forbiddenClientFields: ['userId', 'ownerUserId', 'providerUserId', 'status'],
    piiFields: ['userId', 'ownerUserId', 'providerUserId', 'nickname', 'email', 'avatarUrl'],
    sensitiveFields: ['email'],
    retention: {
      period: 'Account lifetime; proposed PII anonymization within 30 days of closure',
      trigger: 'Account closure',
      automaticDeletionEnabled: false,
      legalReviewRequired: true
    },
    deletionPolicy: 'Anonymize profile PII; retain only pseudonymous transaction linkage as required.',
    idempotencyRule: 'kakao:{providerUserId}',
    indexRequirements: []
  },
  ProductCatalogSnapshot: {
    idField: 'catalogSnapshotId',
    idFormat:
      'sha256(unwoldang:product-catalog-snapshot:v1:{catalogHash}:{effectiveAt})',
    ownerField: null,
    productField: 'products[].productId',
    statusField: 'status',
    serverAuthorityFields: [
      ...COMMON_SERVER_FIELDS,
      'catalogSnapshotId',
      'effectiveAt',
      'products',
      'catalogHash'
    ],
    clientWritableFields: [],
    forbiddenClientFields: ['products', 'catalogHash', 'status', 'effectiveAt'],
    piiFields: [],
    sensitiveFields: [],
    retention: {
      period: 'Indefinite for historical price and product-policy evidence',
      trigger: 'Never automatically expires',
      automaticDeletionEnabled: false,
      legalReviewRequired: false
    },
    deletionPolicy: 'Immutable; supersede with a new snapshot instead of deleting.',
    idempotencyRule: 'catalogHash + effectiveAt (deterministic catalogSnapshotId)',
    indexRequirements: ['status ASC, effectiveAt DESC']
  },
  Order: {
    idField: 'orderId',
    idFormat: '^UW-[A-Za-z0-9._-]{12,116}$',
    ownerField: 'ownerUserId',
    productField: 'productId',
    statusField: 'status',
    serverAuthorityFields: [
      ...COMMON_SERVER_FIELDS,
      'ownerUserId',
      'userBinding',
      'catalogSnapshotId',
      'amount',
      'currency'
    ],
    clientWritableFields: ['orderId', 'productId', 'amount'],
    forbiddenClientFields: ['ownerUserId', 'userBinding', 'catalogSnapshotId', 'currency', 'status'],
    piiFields: ['ownerUserId'],
    sensitiveFields: ['userBinding'],
    retention: {
      period: 'Proposed 5 years after terminal state',
      trigger: 'paid, failed, cancelled, or refunded terminal state',
      automaticDeletionEnabled: false,
      legalReviewRequired: true
    },
    deletionPolicy: 'Anonymize owner linkage when permitted; never bulk-delete in an application migration.',
    idempotencyRule: 'orderId; signed orderClaim binds owner, product, and server amount',
    indexRequirements: [
      'ownerUserId ASC, createdAt DESC',
      'ownerUserId ASC, status ASC, createdAt DESC'
    ]
  },
  Payment: {
    idField: 'paymentId',
    idFormat: 'Existing PortOne payment/order ID; document ID sha256(portone:{paymentId})',
    ownerField: 'ownerUserId',
    productField: 'productId',
    statusField: 'status',
    serverAuthorityFields: [
      ...COMMON_SERVER_FIELDS,
      'ownerUserId',
      'userBinding',
      'amount',
      'currency',
      'storeId',
      'transactionId',
      'provider',
      'approvedAt',
      'confirmedAt',
      'refundedAt'
    ],
    clientWritableFields: ['paymentId', 'orderId', 'productId', 'amount', 'transactionId'],
    forbiddenClientFields: ['ownerUserId', 'userBinding', 'status', 'approvedAt', 'confirmedAt'],
    piiFields: ['ownerUserId'],
    sensitiveFields: ['userBinding', 'paymentId', 'transactionId'],
    retention: {
      period: 'Proposed 5 years after confirmation or refund',
      trigger: 'Payment terminal state',
      automaticDeletionEnabled: false,
      legalReviewRequired: true
    },
    deletionPolicy: 'Retain the immutable payment ledger; anonymize owner data only when legally permitted.',
    idempotencyRule: 'sha256(portone:{paymentId})',
    indexRequirements: ['ownerUserId ASC, confirmedAt DESC']
  },
  Entitlement: {
    idField: 'entitlementId',
    idFormat: 'Lowercase SHA-256; currently sha256(portone:{paymentId})',
    ownerField: 'ownerUserId',
    productField: 'productId',
    statusField: 'status',
    serverAuthorityFields: [
      ...COMMON_SERVER_FIELDS,
      'entitlementId',
      'paymentId',
      'orderId',
      'ownerUserId',
      'userBinding',
      'issuedAt',
      'revokedAt',
      'revocationReason'
    ],
    clientWritableFields: [],
    forbiddenClientFields: ['entitlementId', 'ownerUserId', 'userBinding', 'status', 'revokedAt'],
    piiFields: ['ownerUserId'],
    sensitiveFields: ['userBinding'],
    retention: {
      period: 'While active, then for the linked payment retention period',
      trigger: 'Revocation or linked payment expiry',
      automaticDeletionEnabled: false,
      legalReviewRequired: true
    },
    deletionPolicy: 'Revoke rather than hard-delete; preserve the payment linkage.',
    idempotencyRule: 'One entitlement per verified payment document ID',
    indexRequirements: [
      'ownerUserId ASC, status ASC, issuedAt DESC',
      'ownerUserId ASC, productId ASC, status ASC'
    ]
  },
  ReportGenerationJob: {
    idField: 'jobId',
    idFormat: 'Lowercase SHA-256 derived from the entitlement ID',
    ownerField: 'ownerUserId',
    productField: 'productId',
    statusField: 'status',
    serverAuthorityFields: [
      ...COMMON_SERVER_FIELDS,
      'jobId',
      'ownerUserId',
      'userBinding',
      'inputHash',
      'attemptCount',
      'provider',
      'leaseId',
      'leaseExpiresAt',
      'errorCode'
    ],
    clientWritableFields: [],
    forbiddenClientFields: ['jobId', 'inputHash', 'status', 'attemptCount', 'provider', 'errorCode'],
    piiFields: ['ownerUserId'],
    sensitiveFields: ['userBinding', 'inputHash'],
    retention: {
      period: 'Job metadata follows the entitlement; no TTL while co-located with the payment ledger',
      trigger: 'Entitlement retention expiry after future storage separation',
      automaticDeletionEnabled: false,
      legalReviewRequired: true
    },
    deletionPolicy: 'Do not delete co-located legacy ledger fields; future split storage may expire lease diagnostics.',
    idempotencyRule: 'sha256("unwoldang:report-generation:v1:" + entitlementId + ":" + inputHash), with one deterministic jobId per entitlement',
    indexRequirements: [
      'status ASC, leaseExpiresAt ASC',
      'ownerUserId ASC, status ASC, updatedAt DESC'
    ]
  },
  ReportArchive: {
    idField: 'archiveId',
    idFormat: 'Existing client archive ID; document ID sha256(ownerUserId:archiveId)',
    ownerField: 'ownerUserId',
    productField: 'productId',
    statusField: 'status',
    serverAuthorityFields: [
      ...COMMON_SERVER_FIELDS,
      'ownerUserId',
      'userBinding',
      'entitlementId',
      'reportProvider',
      'reportVersion'
    ],
    clientWritableFields: ['archiveId', 'orderId', 'productId', 'reportData'],
    forbiddenClientFields: ['ownerUserId', 'userBinding', 'entitlementId', 'status', 'reportVersion'],
    piiFields: ['ownerUserId', 'reportData'],
    sensitiveFields: ['userBinding', 'reportData'],
    retention: {
      period: 'Until explicit deletion or account closure; proposed purge within 30 days thereafter',
      trigger: 'User deletion request or account closure',
      automaticDeletionEnabled: false,
      legalReviewRequired: true
    },
    deletionPolicy: 'Soft-delete first; never delete or rewrite legacy archives during an adapter migration.',
    idempotencyRule: 'sha256(ownerUserId:archiveId)',
    indexRequirements: [
      'ownerUserId ASC, createdAt DESC',
      'ownerUserId ASC, status ASC, createdAt DESC',
      'ownerUserId ASC, productId ASC, createdAt DESC'
    ]
  },
  AdminAuditEvent: {
    idField: 'eventId',
    idFormat: 'Opaque server-generated audit event ID',
    ownerField: 'ownerUserId',
    productField: 'productId',
    statusField: 'status',
    serverAuthorityFields: [
      ...COMMON_SERVER_FIELDS,
      'eventId',
      'actorAdminId',
      'action',
      'resourceType',
      'resourceIdHash',
      'requestId',
      'metadata'
    ],
    clientWritableFields: [],
    forbiddenClientFields: ['eventId', 'actorAdminId', 'status', 'resourceIdHash', 'metadata'],
    piiFields: ['actorAdminId', 'ownerUserId'],
    sensitiveFields: [],
    retention: {
      period: 'Proposed 1 year',
      trigger: 'Event creation',
      automaticDeletionEnabled: false,
      legalReviewRequired: true
    },
    deletionPolicy: 'Append-only; purge only under an approved audit-retention process.',
    idempotencyRule: 'requestId:action:resourceType:resourceIdHash-or-none',
    indexRequirements: [
      'actorAdminId ASC, createdAt DESC',
      'resourceType ASC, resourceIdHash ASC, createdAt DESC',
      'action ASC, createdAt DESC'
    ]
  }
} satisfies Record<DataModelName, ModelContractMetadata>);
