import { describe, expect, it } from 'vitest';
import { evaluateReportAccess, isLoopbackHostname, isValidPaymentOrderId } from './reportAccessGate';

const ORDER_ID = 'UW-1710000000000-0123456789abcdef0123456789abcdef';

const makeReport = (serviceId = 'love-reading') => ({
  serviceId,
  serialNumber: 'UW-RPT-001',
  title: '팩폭 연애운',
  customerName: '테스트',
  createdAt: '2026-07-17T00:00:00.000Z',
  sections: [],
  keyTakeaways: [],
  yearLuck: [],
  monthLuck: [],
  pillars: { year: '갑자', month: '을축', day: '병인', hour: null }
});

const evaluate = (overrides: Partial<Parameters<typeof evaluateReportAccess>[0]> = {}) =>
  evaluateReportAccess({
    hostname: 'unwoldang.vercel.app',
    isDevelopment: false,
    expectedServiceId: 'love-reading',
    ...overrides
  });

describe('report access gate', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])('recognizes loopback host %s', (hostname) => {
    expect(isLoopbackHostname(hostname)).toBe(true);
  });

  it.each(['unwoldang.com', 'www.unwoldang.com', 'unwoldang.vercel.app', '192.168.0.10']) (
    'does not treat %s as loopback',
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(false);
    }
  );

  it('allows a hardcoded preview only on a loopback development server', () => {
    expect(evaluate({ hostname: '127.0.0.1', isDevelopment: true })).toMatchObject({
      mode: 'local-preview',
      canRender: true,
      canArchive: false,
      usesPreviewData: true
    });
    expect(evaluate({ hostname: '127.0.0.1', isDevelopment: false }).canRender).toBe(false);
    expect(evaluate({ hostname: 'unwoldang.vercel.app', isDevelopment: true }).canRender).toBe(false);
  });

  it('blocks every non-local direct access that lacks a real report and payment order', () => {
    expect(evaluate()).toMatchObject({ mode: 'locked', canRender: false, canArchive: false });
    expect(evaluate({ orderId: ORDER_ID })).toMatchObject({ mode: 'locked', reason: 'invalid-report-data' });
    expect(evaluate({ reportData: makeReport() })).toMatchObject({ mode: 'locked', reason: 'missing-order' });
  });

  it('keeps archive replay working without a bearer token', () => {
    expect(evaluate({ orderId: ORDER_ID, reportData: makeReport() })).toEqual({
      mode: 'archive-replay',
      canRender: true,
      canArchive: true,
      usesPreviewData: false
    });
  });

  it('keeps newly generated reports with a token working', () => {
    expect(
      evaluate({ orderId: ORDER_ID, reportData: makeReport(), reportAccessToken: 'opaque-server-token' })
    ).toMatchObject({ mode: 'new-generation', canRender: true, canArchive: true, usesPreviewData: false });
  });

  it('rejects route/report service mismatches and malformed order ids', () => {
    expect(evaluate({ orderId: ORDER_ID, reportData: makeReport('general-signature') })).toMatchObject({
      mode: 'locked',
      reason: 'report-service-mismatch'
    });
    expect(isValidPaymentOrderId('UW-short')).toBe(false);
    expect(evaluate({ orderId: 'UW-short', reportData: makeReport() })).toMatchObject({
      mode: 'locked',
      canArchive: false
    });
  });
});
