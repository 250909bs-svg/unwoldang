import { afterEach, describe, expect, it, vi } from 'vitest';
import * as legacyAuth from '../../lib/auth';
import { ApiError } from '../../shared/api/errors';
import { APP_STORAGE_KEYS } from '../../shared/storage';
import { getPortOnePaymentApiEndpoint, requestPaymentOrderIntent } from './api';
import type { PendingPayment } from './model';
import {
  readPaymentEntitlementReferences,
  readPendingPayment,
  savePendingPayment
} from './storage';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const installWindow = () => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  vi.stubGlobal('window', { localStorage, sessionStorage });
  return { localStorage, sessionStorage };
};

const buildPayment = (sequence = 1): PendingPayment => ({
  orderId: `UW-${String(sequence).padStart(12, '0')}-order`,
  productId: 'general-signature',
  paymentMethod: 'portone',
  amount: 79_000,
  formData: {
    name: '개인정보',
    gender: 'female',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-09-09',
    birthTime: '09:36',
    isUnknownTime: false,
    birthTimePrecision: 'exact',
    dayBoundaryPolicy: 'late-zi',
    birthLocation: {
      label: '서울특별시',
      timezone: 'Asia/Seoul',
      utcOffsetMinutes: 540,
      latitude: 37.5665,
      longitude: 126.978,
      applySolarTimeCorrection: true
    },
    location: '서울특별시',
    relationshipStatus: 'dating',
    relationshipDuration: 'under1',
    q1: '직업 흐름을 어떻게 바꿀까요?',
    q2: '돈을 남기는 방법은 무엇인가요?'
  },
  orderClaim: 'claim-that-must-stay-in-session-storage',
  reportAccessToken: 'token-that-must-stay-in-session-storage',
  createdAt: new Date(Date.UTC(2026, 6, sequence)).toISOString()
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pending payment storage compatibility', () => {
  it('keeps pending details in session and only opaque references in local storage', () => {
    const { localStorage, sessionStorage } = installWindow();
    const payment = buildPayment();
    savePendingPayment(payment);

    expect(sessionStorage.getItem(APP_STORAGE_KEYS.pendingPayment.key)).not.toBeNull();
    const restored = readPendingPayment();
    expect(restored).not.toBeNull();
    expect(restored).toMatchObject({
      orderId: payment.orderId,
      productId: payment.productId,
      amount: payment.amount,
      formData: payment.formData
    });
    expect(restored?.formData).toMatchObject({
      birthTimePrecision: 'exact', timezone: 'Asia/Seoul', utcOffsetMinutes: 540,
      latitude: 37.5665, longitude: 126.978, applySolarTimeCorrection: true
    });
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.paymentEntitlementReferences.key) || '[]')).toEqual([
      { orderId: payment.orderId, productId: payment.productId, createdAt: payment.createdAt }
    ]);
    expect(localStorage.getItem(APP_STORAGE_KEYS.paymentEntitlementReferences.key)).not.toContain('개인정보');
    expect(localStorage.getItem(APP_STORAGE_KEYS.paymentEntitlementReferences.key)).not.toContain('token-that');
    expect(localStorage.getItem(APP_STORAGE_KEYS.paymentEntitlementReferences.key)).not.toContain('claim-that');
  });

  it('deduplicates newest references and caps the list at 20', () => {
    installWindow();
    for (let sequence = 1; sequence <= 22; sequence += 1) {
      savePendingPayment(buildPayment(sequence));
    }
    savePendingPayment(buildPayment(10));

    const references = readPaymentEntitlementReferences();
    expect(references).toHaveLength(20);
    expect(references[0]?.orderId).toBe(buildPayment(10).orderId);
    expect(new Set(references.map((entry) => entry.orderId)).size).toBe(20);
  });

  it('removes malformed pending JSON', () => {
    const { sessionStorage } = installWindow();
    sessionStorage.setItem(APP_STORAGE_KEYS.pendingPayment.key, '{broken');
    expect(readPendingPayment()).toBeNull();
    expect(sessionStorage.getItem(APP_STORAGE_KEYS.pendingPayment.key)).toBeNull();
  });
});

describe('payment API error contract', () => {
  it('keeps server diagnostics internal and exposes a stable user message and code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'internal provider detail' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    ));

    const error = await requestPaymentOrderIntent({
      confirmEndpoint: 'https://api.example.com/api/payments/portone/confirm',
      authToken: 'auth-token',
      productId: 'general-signature',
      amount: 79_000
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'PAYMENT_API_HTTP_ERROR',
      status: 503,
      message: '결제 권한 처리 중 오류가 발생했습니다.',
      userMessage: '결제 권한 처리 중 오류가 발생했습니다.'
    });
    expect((error as ApiError).cause).toMatchObject({ message: 'internal provider detail' });
  });

  it('uses a contract code for a successful but mismatched response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    ));

    const error = await requestPaymentOrderIntent({
      confirmEndpoint: 'https://api.example.com/api/payments/portone/confirm',
      authToken: 'auth-token',
      orderId: 'UW-123456789012-order',
      productId: 'general-signature',
      amount: 79_000
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'PAYMENT_API_CONTRACT_VIOLATION',
      message: expect.stringContaining('무결성')
    });
  });
});

describe('payment facade compatibility', () => {
  it('re-exports the split payment implementations by reference', () => {
    expect(legacyAuth.savePendingPayment).toBe(savePendingPayment);
    expect(legacyAuth.readPendingPayment).toBe(readPendingPayment);
    expect(legacyAuth.requestPaymentOrderIntent).toBe(requestPaymentOrderIntent);
    expect(legacyAuth.getPortOnePaymentApiEndpoint).toBe(getPortOnePaymentApiEndpoint);
  });
});
