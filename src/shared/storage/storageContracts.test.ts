import { describe, expect, it } from 'vitest';
import { APP_STORAGE_KEYS, APP_STORAGE_SCHEMA_VERSION, getCustomerKeyStorageContract } from './keys';

describe('application storage contracts', () => {
  it('keeps stable v1 keys, areas and serialization formats', () => {
    expect(APP_STORAGE_SCHEMA_VERSION).toBe(1);
    expect(APP_STORAGE_KEYS).toEqual({
      authUser: {
        key: 'unwoldang.auth.user',
        area: 'local',
        serialization: 'json',
        version: 1
      },
      kakaoAuthState: {
        key: 'unwoldang.auth.kakao.state',
        area: 'session',
        serialization: 'raw-string',
        version: 1
      },
      pendingPayment: {
        key: 'unwoldang.payment.pending',
        area: 'session',
        serialization: 'json',
        version: 1
      },
      paymentEntitlementReferences: {
        key: 'unwoldang.payment.entitlements',
        area: 'local',
        serialization: 'json',
        version: 1
      }
    });
  });

  it('preserves the dynamic customer key prefix', () => {
    expect(getCustomerKeyStorageContract('user-1')).toEqual({
      key: 'unwoldang.payment.pending.customer.user-1',
      area: 'local',
      serialization: 'raw-string',
      version: 1
    });
  });
});
