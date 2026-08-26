import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import { DisabledPaymentProvider, HyphenPaymentProvider } from '../../../cloudrun-api/src/domains/payments/paymentProvider.ts';

describe('payment provider fail-closed defaults', () => {
  it('defaults production to disabled and rejects operations', async () => {
    const config = loadConfig({ NODE_ENV: 'production' });
    expect(config.payment).toEqual({ provider: 'disabled', configured: false });
    await expect(new DisabledPaymentProvider().verifyPayment('p')).rejects.toMatchObject({ status: 503 });
  });
  it('keeps Hyphen unconfigured without inventing an API contract', async () => {
    const provider = new HyphenPaymentProvider();
    expect(provider.configured).toBe(false);
    await expect(provider.createPayment({ paymentId: 'p', productId: 'general-signature', amount: 1, currency: 'KRW', orderName: 'x' })).rejects.toMatchObject({ status: 503 });
  });
});
