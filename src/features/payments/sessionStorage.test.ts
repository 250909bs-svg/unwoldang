import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PaymentSession } from './contracts';
import {
  PAYMENT_SESSION_STORAGE_KEY,
  canRetryPaymentConfirmation,
  readPaymentSession,
  updatePaymentSession,
  writePaymentSession
} from './sessionStorage';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const createSession = (): PaymentSession => ({
  schemaVersion: 1,
  ownerId: 'user-a',
  orderId: 'UW-20990101-session-payment-0001',
  productId: 'general-signature',
  paymentMethod: 'portone',
  amount: 79_000,
  currency: 'KRW',
  status: 'pending',
  paymentId: 'UW-20990101-session-payment-0001',
  orderClaim: 'claim.'.padEnd(64, 'x'),
  orderClaimExpiresAt: '2099-01-01T00:00:00.000Z',
  createdAt: '2098-12-31T23:00:00.000Z',
  updatedAt: '2098-12-31T23:00:00.000Z'
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('payment session storage', () => {
  it('binds the session to its owner without creating a local entitlement reference', () => {
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    vi.stubGlobal('window', { sessionStorage, localStorage });

    writePaymentSession(createSession());

    expect(readPaymentSession('user-a')?.orderId).toBe('UW-20990101-session-payment-0001');
    expect(readPaymentSession('user-b')).toBeNull();
    expect(sessionStorage.getItem(PAYMENT_SESSION_STORAGE_KEY)).toContain('user-a');
    expect(localStorage.length).toBe(0);
  });

  it('keeps the same payment confirm retryable but strips authority after refund', () => {
    const sessionStorage = new MemoryStorage();
    vi.stubGlobal('window', { sessionStorage, localStorage: new MemoryStorage() });
    const pending = createSession();

    writePaymentSession(pending);
    expect(canRetryPaymentConfirmation(readPaymentSession('user-a'))).toBe(true);

    const paid = updatePaymentSession(pending, 'paid', {
      entitlementId: 'a'.repeat(64),
      entitlementStatus: 'active',
      reportAccessToken: 'report.'.padEnd(64, 'x'),
      reportAccessTokenExpiresAt: '2099-01-01T00:00:00.000Z'
    });
    const refunded = updatePaymentSession(paid, 'refunded');

    expect(refunded.reportAccessToken).toBeUndefined();
    expect(refunded.entitlementStatus).toBeUndefined();
    expect(canRetryPaymentConfirmation(refunded)).toBe(false);
  });

  it('rejects a report token on a non-paid session', () => {
    vi.stubGlobal('window', {
      sessionStorage: new MemoryStorage(),
      localStorage: new MemoryStorage()
    });

    expect(() =>
      writePaymentSession({
        ...createSession(),
        reportAccessToken: 'report.'.padEnd(64, 'x')
      })
    ).toThrow('무결성');
  });

  it('migrates a recent legacy session without carrying PII or local authority', () => {
    const sessionStorage = new MemoryStorage();
    vi.stubGlobal('window', { sessionStorage, localStorage: new MemoryStorage() });
    const createdAt = new Date(Date.now() - 60_000).toISOString();

    sessionStorage.setItem(
      PAYMENT_SESSION_STORAGE_KEY,
      JSON.stringify({
        orderId: 'UW-20990101-session-payment-0002',
        productId: 'general-signature',
        paymentMethod: 'portone',
        amount: 79_000,
        paymentKey: 'UW-20990101-session-payment-0002',
        txId: 'tx-legacy-0002',
        orderClaim: 'claim.'.padEnd(64, 'x'),
        reportAccessToken: 'must-not-migrate',
        formData: { name: 'must-not-migrate' },
        createdAt
      })
    );

    const migrated = readPaymentSession('user-a');

    expect(migrated).toMatchObject({
      schemaVersion: 1,
      ownerId: 'user-a',
      status: 'pending',
      paymentId: 'UW-20990101-session-payment-0002'
    });
    expect(migrated?.formData).toBeUndefined();
    expect(migrated?.reportAccessToken).toBeUndefined();
    expect(readPaymentSession('user-b')).toBeNull();
  });
});
