import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeProducts } from './registry';

const serverSource = readFileSync(
  new URL('../../cloudrun-api/src/index.ts', import.meta.url),
  'utf8'
);

function sourceBetween(start: string, end: string) {
  const startIndex = serverSource.indexOf(start);
  const endIndex = serverSource.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return serverSource.slice(startIndex, endIndex);
}

describe('server product sale status contract', () => {
  it('uses the shared manifest for new order availability', () => {
    expect(serverSource).toContain(
      "import productManifest from '../../src/products/manifest.json'"
    );
    expect(serverSource).toContain(".filter(([, status]) => status === 'active')");

    const orderIntentSource = sourceBetween(
      'function createPaymentOrderIntent',
      'function verifyAdminAccess'
    );
    expect(orderIntentSource).toContain('assertProductAvailableForNewOrder(productId)');
  });

  it('keeps existing prices available for payment confirmation and entitlement renewal', () => {
    const confirmationSource = sourceBetween(
      'async function confirmPortOnePayment',
      'async function renewReportEntitlement'
    );
    const renewalSource = sourceBetween(
      'async function renewReportEntitlement',
      'async function queryPaymentEntitlements'
    );

    expect(confirmationSource).not.toContain('assertProductAvailableForNewOrder');
    expect(confirmationSource).toContain('getCatalogAmount(productId)');
    expect(renewalSource).toContain('getCatalogAmount(productId)');
  });

  it('matches every active registry price in the retained server price table', () => {
    const normalizedServerSource = serverSource.replaceAll('_', '');

    activeProducts.forEach((product) => {
      expect(normalizedServerSource).toContain(`'${product.id}': ${product.price}`);
    });
  });
});
