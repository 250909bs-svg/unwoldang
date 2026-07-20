import type { StorageKeyContract } from './contracts';

/**
 * Version 1 deliberately keeps the pre-refactor key names and raw JSON/string
 * payloads. A future version must add a backwards reader before changing a
 * writer or retiring a key.
 */
export const APP_STORAGE_SCHEMA_VERSION = 1 as const;

const defineKey = (
  key: string,
  area: StorageKeyContract['area'],
  serialization: StorageKeyContract['serialization']
): StorageKeyContract => ({
  key,
  area,
  serialization,
  version: APP_STORAGE_SCHEMA_VERSION
});

export const APP_STORAGE_KEYS = {
  authUser: defineKey('unwoldang.auth.user', 'local', 'json'),
  kakaoAuthState: defineKey('unwoldang.auth.kakao.state', 'session', 'raw-string'),
  pendingPayment: defineKey('unwoldang.payment.pending', 'session', 'json'),
  paymentEntitlementReferences: defineKey('unwoldang.payment.entitlements', 'local', 'json')
} as const;

export const getCustomerKeyStorageContract = (identity: string): StorageKeyContract =>
  defineKey(`${APP_STORAGE_KEYS.pendingPayment.key}.customer.${identity}`, 'local', 'raw-string');
