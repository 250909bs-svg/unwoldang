export const DEFAULT_FIRESTORE_COLLECTIONS = Object.freeze({
  userAccounts: 'users',
  productCatalogSnapshots: 'productCatalogSnapshots',
  orders: 'orders',
  payments: 'payments',
  entitlements: 'entitlements',
  reportGenerationJobs: 'reportGenerationJobs',
  reportArchives: 'reportArchives',
  adminAuditEvents: 'adminAuditEvents',
  portOnePaymentConfirmations: 'portonePaymentConfirmations'
} as const);

export type FirestoreCollectionKey = keyof typeof DEFAULT_FIRESTORE_COLLECTIONS;

export type FirestoreCollectionNames = {
  readonly [Key in FirestoreCollectionKey]: string;
};

/**
 * The two legacy variable names are part of the deployed compatibility
 * contract. New collection variables follow the same override convention,
 * but resolving them does not create, migrate, or write any documents.
 */
export const FIRESTORE_COLLECTION_ENV = Object.freeze({
  userAccounts: 'FIRESTORE_USERS_COLLECTION',
  productCatalogSnapshots: 'FIRESTORE_PRODUCT_CATALOG_SNAPSHOTS_COLLECTION',
  orders: 'FIRESTORE_ORDERS_COLLECTION',
  payments: 'FIRESTORE_PAYMENTS_COLLECTION',
  entitlements: 'FIRESTORE_ENTITLEMENTS_COLLECTION',
  reportGenerationJobs: 'FIRESTORE_REPORT_GENERATION_JOBS_COLLECTION',
  reportArchives: 'FIRESTORE_ARCHIVE_COLLECTION',
  adminAuditEvents: 'FIRESTORE_ADMIN_AUDIT_EVENTS_COLLECTION',
  portOnePaymentConfirmations: 'PORTONE_PAYMENT_LEDGER_COLLECTION'
} as const satisfies Readonly<Record<FirestoreCollectionKey, string>>);

export type CollectionEnvironment = Readonly<Record<string, string | undefined>>;

function resolveCollectionName(
  env: CollectionEnvironment,
  key: FirestoreCollectionKey
) {
  const configured = env[FIRESTORE_COLLECTION_ENV[key]]?.trim();
  return configured || DEFAULT_FIRESTORE_COLLECTIONS[key];
}

export function resolveFirestoreCollections(
  env: CollectionEnvironment = process.env
): FirestoreCollectionNames {
  return Object.freeze({
    userAccounts: resolveCollectionName(env, 'userAccounts'),
    productCatalogSnapshots: resolveCollectionName(env, 'productCatalogSnapshots'),
    orders: resolveCollectionName(env, 'orders'),
    payments: resolveCollectionName(env, 'payments'),
    entitlements: resolveCollectionName(env, 'entitlements'),
    reportGenerationJobs: resolveCollectionName(env, 'reportGenerationJobs'),
    reportArchives: resolveCollectionName(env, 'reportArchives'),
    adminAuditEvents: resolveCollectionName(env, 'adminAuditEvents'),
    portOnePaymentConfirmations: resolveCollectionName(
      env,
      'portOnePaymentConfirmations'
    )
  });
}

export const LEGACY_FIRESTORE_COLLECTIONS = Object.freeze({
  paymentLedger: DEFAULT_FIRESTORE_COLLECTIONS.portOnePaymentConfirmations,
  reportArchives: DEFAULT_FIRESTORE_COLLECTIONS.reportArchives
} as const);
