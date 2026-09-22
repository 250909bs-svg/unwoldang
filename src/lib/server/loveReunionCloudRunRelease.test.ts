import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import { SERVER_PRODUCT_CATALOG } from '../../../cloudrun-api/src/contracts/products.ts';
import { TokenService } from '../../../cloudrun-api/src/domains/auth/tokenService.ts';
import type {
  NormalizedPaymentResult,
  PaymentCreateInput,
  PaymentProvider
} from '../../../cloudrun-api/src/domains/payments/paymentProvider.ts';
import {
  PaymentService,
  type ConfirmedPaymentLedgerRecord,
  type PaymentLedgerRepository
} from '../../../cloudrun-api/src/domains/payments/paymentService.ts';
import { assertReportAccess } from '../../../cloudrun-api/src/middleware/auth.ts';
import {
  REUNION_CONTEXT_VERSION,
  type ReunionContext
} from '../reunion';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import {
  assertLoveReunionReportSafety,
  buildSajuReport,
  findLoveReunionSafetyViolations
} from '../saju/reportBuilder';
import {
  assertCommercialReportRequest,
  buildGeminiRequestPayload,
  toFormData,
  type ReportRequestBody
} from './geminiReportService';

const PRODUCT_ID = 'love-reunion';
const PRODUCT_PRICE = 990;
const ORDER_ID = 'UW-20260915-love-reunion-0001';
const USER = { userId: 'love-reunion-release-user' };

const config = loadConfig({
  NODE_ENV: 'production',
  PAYMENT_PROVIDER: 'legacy-portone',
  PORTONE_API_SECRET: 'fixture-portone-secret',
  PORTONE_STORE_ID: 'fixture-store',
  REPORT_ACCESS_SECRET: 'fixture-report-secret',
  USER_ACCESS_SECRET: 'fixture-user-secret',
  ADMIN_ACCESS_SECRET: 'fixture-admin-secret'
});

class FakePaymentProvider implements PaymentProvider {
  readonly name = 'legacy-portone' as const;
  readonly configured = true;

  createPayment(_input: PaymentCreateInput): Promise<unknown> {
    throw new Error('not used');
  }

  verifyPayment(_paymentId: string): Promise<NormalizedPaymentResult> {
    throw new Error('verification must not run for a rejected request');
  }

  getPaymentStatus(_paymentId: string): Promise<string> {
    throw new Error('not used');
  }

  cancelPayment(_paymentId: string): Promise<unknown> {
    throw new Error('not used');
  }

  normalizePaymentResult(raw: unknown) {
    return raw as NormalizedPaymentResult;
  }
}

class FakeLedgerRepository implements PaymentLedgerRepository {
  async createPaymentLedger(_record: ConfirmedPaymentLedgerRecord) {}
  async getPaymentLedger(_entitlementId: string) { return null; }
  async listPaymentLedgersByUserId(_userId: string, _limit: number) { return []; }
}

function createPaymentService(tokenService: TokenService) {
  return new PaymentService({
    config: {
      storeId: 'fixture-store',
      orderClaimTtlMs: config.report.orderClaimTtlMs,
      reportAccessTokenTtlMs: config.report.accessTokenTtlMs
    },
    paymentProvider: new FakePaymentProvider(),
    ledgerRepository: new FakeLedgerRepository(),
    tokenService,
    now: () => Date.parse('2026-09-15T00:00:00.000Z'),
    randomBytes: (size) => Buffer.alloc(size, 9)
  });
}

function reportRequest(token: string) {
  return {
    headers: { authorization: `Bearer ${token}` }
  } as IncomingMessage;
}

const reunionFormData = {
  name: '재회 검증자',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  relationshipStatus: 'breakup-reunion' as const,
  partner: {
    name: '상대 검증자',
    gender: 'male' as const,
    calendar: 'solar' as const,
    isLeapMonth: false,
    birthDate: '1991-05-14',
    birthTime: '08:30',
    isUnknownTime: false
  },
  q1: '다시 연락해도 될까요?',
  q2: '답이 없으면 언제 멈춰야 하나요?'
};

const reunionContext: ReunionContext = {
  schemaVersion: REUNION_CONTEXT_VERSION,
  breakupDuration: 'oneTo3m',
  contactStatus: 'no-contact',
  lastContactAt: '2026-08-01',
  breakupReason: '대화 방식의 차이로 헤어졌어요.',
  desiredOutcome: 'clarity',
  notes: '돌려받을 물건이 있어요.',
  consentToUsePartnerData: true
};

function reunionRequestBody(
  overrides: Partial<NonNullable<ReportRequestBody['payload']>> = {}
): ReportRequestBody {
  return {
    serviceId: PRODUCT_ID,
    payload: {
      user: { name: reunionFormData.name, gender: reunionFormData.gender },
      birth: {
        calendar: reunionFormData.calendar,
        isLeapMonth: reunionFormData.isLeapMonth,
        date: reunionFormData.birthDate,
        time: reunionFormData.birthTime,
        isUnknownTime: reunionFormData.isUnknownTime
      },
      partner: reunionFormData.partner,
      reunionContext,
      questions: [reunionFormData.q1, reunionFormData.q2],
      ...overrides
    }
  };
}

describe('love-reunion Cloud Run release contract', () => {
  it('round-trips and validates the structured reunion context at the server boundary', () => {
    const request = reunionRequestBody();
    const restored = toFormData(request);
    expect(restored.reunionContext).toEqual(reunionContext);
    expect(() => assertCommercialReportRequest(PRODUCT_ID, restored, {
      reunionContext: request.payload?.reunionContext
    })).not.toThrow();
  });

  it('rejects a missing partner before a paid reunion report can be generated', () => {
    const request = reunionRequestBody({ partner: null });
    const restored = toFormData(request);
    expect(() => assertCommercialReportRequest(PRODUCT_ID, restored, { reunionContext }))
      .toThrow(expect.objectContaining({ status: 422 }));
  });

  it('rejects missing context and consent=false with 422', () => {
    for (const value of [undefined, { ...reunionContext, consentToUsePartnerData: false }]) {
      const request = reunionRequestBody({ reunionContext: value });
      const restored = toFormData(request);
      expect(() => assertCommercialReportRequest(PRODUCT_ID, restored, {
        reunionContext: request.payload?.reunionContext
      })).toThrow(expect.objectContaining({ status: 422 }));
    }
  });

  it('keeps the server-authoritative catalog archived at exactly 990 KRW', () => {
    expect(SERVER_PRODUCT_CATALOG[PRODUCT_ID]).toEqual({
      amount: PRODUCT_PRICE,
      currency: 'KRW',
      status: 'archived'
    });
  });

  it('rejects new orders while the product is available only in local preview', async () => {
    const tokenService = new TokenService(config);
    const payments = createPaymentService(tokenService);

    /* 쿠폰 조회가 붙으면서 주문 생성이 비동기가 됐다. 거부는 이제 Promise 거부다. */
    await expect(payments.createOrderIntent(USER, {
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE
    })).rejects.toThrow(expect.objectContaining({
      status: 409,
      message: '현재 신규 판매 중인 상품이 아닙니다.'
    }));
  });

  it('keeps historical report access bound to the signed reunion entitlement', () => {
    const tokenService = new TokenService(config);
    const reportToken = tokenService.createReportAccessToken({
      userId: USER.userId,
      orderId: ORDER_ID,
      paymentId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      entitlementId: 'fixture-love-reunion-entitlement'
    });
    const request = reportRequest(reportToken);

    expect(assertReportAccess(request, {
      serviceId: PRODUCT_ID,
      orderId: ORDER_ID
    }, config, tokenService)).toMatchObject({
      productId: PRODUCT_ID,
      orderId: ORDER_ID,
      amount: PRODUCT_PRICE
    });
    expect(() => assertReportAccess(request, {
      serviceId: 'love-reading',
      orderId: ORDER_ID
    }, config, tokenService)).toThrow('Report token does not match this product.');
    expect(() => assertReportAccess(request, {
      serviceId: PRODUCT_ID,
      orderId: `${ORDER_ID}-other`
    }, config, tokenService)).toThrow('Report token does not match this order.');
  });

  it('applies the reunion-only Gemini override without changing love-reading prompts', () => {
    const reunionBasis = buildDeterministicSajuBasis(PRODUCT_ID, reunionFormData);
    const reunionReport = buildSajuReport(PRODUCT_ID, reunionFormData, reunionBasis);
    const reunionPrompt = JSON.stringify(buildGeminiRequestPayload(reunionReport, reunionBasis));
    const loveBasis = buildDeterministicSajuBasis('love-reading', reunionFormData);
    const loveReport = buildSajuReport('love-reading', reunionFormData, loveBasis);
    const lovePrompt = JSON.stringify(buildGeminiRequestPayload(loveReport, loveBasis));

    expect(reunionPrompt).toContain('LOVE-REUNION SAFETY OVERRIDE');
    expect(reunionPrompt).toContain('Never claim to know the partner');
    expect(reunionPrompt).toContain('Never present a year, month, day, or date as guaranteed');
    expect(lovePrompt).not.toContain('LOVE-REUNION SAFETY OVERRIDE');
  });

  it('keeps the raw generated report free of fabricated probability, partner thoughts, and guaranteed timing', () => {
    const basis = buildDeterministicSajuBasis(PRODUCT_ID, reunionFormData);
    const report = buildSajuReport(PRODUCT_ID, reunionFormData, basis);

    expect(findLoveReunionSafetyViolations(report)).toEqual([]);
    expect(report.legalNotice.join(' ')).toContain('재회 확률이나 상대의 속마음');
    expect(report.legalNotice.join(' ')).toContain('연락 동의나 재회를 보장하지 않습니다');
    expect(report.sections.flatMap((section) => section.cards || []))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ title: '상대가 느끼는 나' })]));

    expect(() => assertLoveReunionReportSafety({
      ...report,
      heroNote: '재회 가능성은 93%입니다.'
    })).toThrow('재회 확률 수치');
    expect(() => assertLoveReunionReportSafety({
      ...report,
      heroNote: '재회 가능성이 매우 높습니다.'
    })).toThrow('재회 가능성 등급');
    expect(() => assertLoveReunionReportSafety({
      ...report,
      heroNote: '상대는 당신을 아직 사랑하고 있다고 느낍니다.'
    })).toThrow('상대 속마음 단정');
    expect(() => assertLoveReunionReportSafety({
      ...report,
      heroNote: '상대방은 아직 미련이 있습니다.'
    })).toThrow('상대 속마음 단정');
    expect(() => assertLoveReunionReportSafety({
      ...report,
      heroNote: '반드시 재회합니다.'
    })).toThrow('재회 결과 보장');
    expect(() => assertLoveReunionReportSafety({
      ...report,
      heroNote: '2026년 10월 3일에 재회합니다.'
    })).toThrow('근거 없는 정확 날짜 단정');
  });
});
