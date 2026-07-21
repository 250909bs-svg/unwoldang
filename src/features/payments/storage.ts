import {
  APP_STORAGE_KEYS,
  defineStorage,
  readStorageValue,
  removeStorageValue,
  versionedJsonStorageCodec,
  writeStorageValue
} from '../../shared/storage';
import type { PaymentEntitlementReference, PendingPayment } from './model';

const pendingPaymentStorage = defineStorage<PendingPayment>(
  APP_STORAGE_KEYS.pendingPayment,
  versionedJsonStorageCodec(APP_STORAGE_KEYS.pendingPayment, {
    // v1 intentionally preserves the permissive legacy payload contract.
    decode: (value) => value as PendingPayment
  })
);
const entitlementReferenceStorage = defineStorage<unknown[]>(
  APP_STORAGE_KEYS.paymentEntitlementReferences,
  versionedJsonStorageCodec(APP_STORAGE_KEYS.paymentEntitlementReferences, {
    decode: (value) => {
      if (!Array.isArray(value)) {
        throw new Error('Invalid entitlement reference list.');
      }

      return value;
    }
  })
);

export const readPaymentEntitlementReferences = (): PaymentEntitlementReference[] => {
  const parsed = readStorageValue(entitlementReferenceStorage);

  if (parsed === null) {
    return [];
  }

  return parsed
    .filter((entry): entry is PaymentEntitlementReference => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }

      const candidate = entry as Record<string, unknown>;
      return (
        typeof candidate.orderId === 'string' &&
        /^UW-[A-Za-z0-9._-]{12,116}$/.test(candidate.orderId) &&
        typeof candidate.productId === 'string' &&
        Boolean(candidate.productId.trim()) &&
        typeof candidate.createdAt === 'string' &&
        Number.isFinite(Date.parse(candidate.createdAt))
      );
    })
    .slice(0, 20);
};

const rememberPaymentEntitlementReference = (payment: PendingPayment) => {
  const reference: PaymentEntitlementReference = {
    orderId: payment.orderId,
    productId: payment.productId,
    createdAt: payment.createdAt
  };
  const remaining = readPaymentEntitlementReferences().filter((entry) => entry.orderId !== reference.orderId);

  // Persist only the opaque order reference. Claims, bearer tokens and intake data remain session-only.
  writeStorageValue(
    entitlementReferenceStorage,
    [reference, ...remaining].slice(0, 20)
  );
};

export const savePendingPayment = (payment: PendingPayment) => {
  if (typeof window === 'undefined') {
    return;
  }

  writeStorageValue(pendingPaymentStorage, payment);
  rememberPaymentEntitlementReference(payment);
};

export const readPendingPayment = () => readStorageValue(pendingPaymentStorage);

export const clearPendingPayment = () => {
  removeStorageValue(APP_STORAGE_KEYS.pendingPayment);
};
