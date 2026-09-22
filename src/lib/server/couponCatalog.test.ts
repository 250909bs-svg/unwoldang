import { describe, expect, it } from 'vitest';
import {
  COUPON_CATALOG,
  COUPON_MIN_PAYABLE_AMOUNT,
  evaluateCoupon,
  findCoupon,
  normalizeCouponCode,
  resolvePayableAmount,
  selfClaimableCoupons,
  type CouponDefinition
} from '../../../cloudrun-api/src/domains/coupons/couponCatalog.ts';

const NOW = Date.parse('2026-09-22T00:00:00.000Z');

const coupon = (overrides: Partial<CouponDefinition> = {}): CouponDefinition => ({
  code: 'TEST500',
  label: '테스트 500원',
  discount: 500,
  productIds: 'all',
  minOrderAmount: 600,
  expiresAt: '2027-01-01T00:00:00.000Z',
  perUserLimit: 1,
  selfClaimable: true,
  description: '',
  ...overrides
});

const catalog = [coupon()];

describe('쿠폰 원장', () => {
  it('코드를 대문자 영숫자로 정규화한다', () => {
    expect(normalizeCouponCode(' test-500 ')).toBe('TEST500');
    expect(normalizeCouponCode('welcome_500')).toBe('WELCOME500');
    expect(normalizeCouponCode(null)).toBe('');
    expect(normalizeCouponCode(500)).toBe('');
  });

  it('없는 코드는 찾지 않는다', () => {
    expect(findCoupon('NOPE', catalog)).toBeUndefined();
    expect(findCoupon('test500', catalog)?.code).toBe('TEST500');
  });

  it('정가에서 할인을 뺀 금액을 서버가 정한다', () => {
    const result = evaluateCoupon({
      code: 'TEST500',
      productId: 'general-signature',
      catalogAmount: 9900,
      redeemedCount: 0,
      now: NOW,
      catalog
    });

    expect(result).toMatchObject({ ok: true, discount: 500, payableAmount: 9400 });
  });

  it('0원 결제를 만들지 않는다 — 최소 결제액까지만 깎는다', () => {
    /* 990원 상품에 2,000원 쿠폰이 오는 상황이 실제로 생긴다. 결제대행사는 0원을
       처리하지 못하므로 최소 결제액을 남기고, 화면이 거짓말하지 않게 실제 할인액을
       함께 돌려준다. */
    const result = evaluateCoupon({
      code: 'BIG',
      productId: 'general-signature',
      catalogAmount: 990,
      redeemedCount: 0,
      now: NOW,
      catalog: [coupon({ code: 'BIG', discount: 2000, minOrderAmount: 100 })]
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payableAmount).toBe(COUPON_MIN_PAYABLE_AMOUNT);
      expect(result.discount).toBe(990 - COUPON_MIN_PAYABLE_AMOUNT);
      expect(result.discount).toBeLessThan(2000);
    }
  });

  it('결제액은 절대 음수나 0 이 되지 않는다', () => {
    for (const amount of [100, 101, 500, 990, 9900]) {
      const result = evaluateCoupon({
        code: 'BIG',
        productId: 'p',
        catalogAmount: amount,
        redeemedCount: 0,
        now: NOW,
        catalog: [coupon({ code: 'BIG', discount: 1_000_000, minOrderAmount: 0 })]
      });

      if (result.ok) {
        expect(result.payableAmount).toBeGreaterThanOrEqual(COUPON_MIN_PAYABLE_AMOUNT);
        expect(result.discount).toBeGreaterThan(0);
        expect(result.discount + result.payableAmount).toBe(amount);
      } else {
        // 최소 결제액에 이미 도달한 주문은 쿠폰을 거절한다. 깎을 여지가 없다.
        expect(amount).toBeLessThanOrEqual(COUPON_MIN_PAYABLE_AMOUNT);
      }
    }
  });

  it('기간이 지난 쿠폰은 거절한다', () => {
    const result = evaluateCoupon({
      code: 'TEST500',
      productId: 'p',
      catalogAmount: 9900,
      redeemedCount: 0,
      now: Date.parse('2027-01-01T00:00:01.000Z'),
      catalog
    });

    expect(result).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('상품 범위 밖이면 거절한다', () => {
    const result = evaluateCoupon({
      code: 'ONLY',
      productId: 'love-reunion',
      catalogAmount: 9900,
      redeemedCount: 0,
      now: NOW,
      catalog: [coupon({ code: 'ONLY', productIds: ['general-signature'] })]
    });

    expect(result).toMatchObject({ ok: false, reason: 'product-not-eligible' });
  });

  it('최소 주문 금액 미달이면 거절한다', () => {
    const result = evaluateCoupon({
      code: 'TEST500',
      productId: 'p',
      catalogAmount: 500,
      redeemedCount: 0,
      now: NOW,
      catalog
    });

    expect(result).toMatchObject({ ok: false, reason: 'below-minimum-order' });
  });

  it('사용 횟수를 넘기면 거절한다', () => {
    const args = {
      code: 'TEST500',
      productId: 'p',
      catalogAmount: 9900,
      now: NOW,
      catalog
    };

    expect(evaluateCoupon({ ...args, redeemedCount: 0 }).ok).toBe(true);
    expect(evaluateCoupon({ ...args, redeemedCount: 1 })).toMatchObject({
      ok: false,
      reason: 'per-user-limit-reached'
    });
  });

  it('쿠폰이 없으면 정가 그대로다', () => {
    for (const code of [undefined, '', '   ', null]) {
      expect(
        resolvePayableAmount({ code, productId: 'p', catalogAmount: 9900, redeemedCount: 0, now: NOW })
      ).toEqual({ payableAmount: 9900, coupon: null, discount: 0 });
    }
  });

  it('쓸 수 없는 쿠폰을 보내면 조용히 정가로 넘어가지 않는다', () => {
    /* 조용히 정가를 청구하면 손님은 할인을 기대하고 결제한다. 오류로 세워야 한다. */
    const result = resolvePayableAmount({
      code: 'NOPE',
      productId: 'p',
      catalogAmount: 9900,
      redeemedCount: 0,
      now: NOW
    });

    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error.reason).toBe('unknown-code');
  });

  it('실제 원장의 쿠폰은 전부 유효한 값이다', () => {
    const codes = new Set<string>();

    for (const item of COUPON_CATALOG) {
      expect(item.code).toBe(normalizeCouponCode(item.code));
      expect(codes.has(item.code), `${item.code} 중복`).toBe(false);
      codes.add(item.code);

      expect(item.discount).toBeGreaterThan(0);
      expect(Number.isSafeInteger(item.discount)).toBe(true);
      expect(item.perUserLimit).toBeGreaterThan(0);
      // 최소 주문 금액은 할인 뒤에도 최소 결제액이 남는 값이어야 한다.
      expect(item.minOrderAmount).toBeGreaterThanOrEqual(COUPON_MIN_PAYABLE_AMOUNT);
      expect(Number.isFinite(Date.parse(item.expiresAt))).toBe(true);
    }
  });

  it('스스로 받을 수 있는 쿠폰만 골라낸다', () => {
    const claimable = selfClaimableCoupons();

    expect(claimable.length).toBeGreaterThan(0);
    expect(claimable.every((item) => item.selfClaimable)).toBe(true);
    // 초대 보상 쿠폰은 스스로 받을 수 없어야 한다 — 받으면 초대 없이도 할인이 된다.
    expect(claimable.some((item) => item.code === 'FRIEND300')).toBe(false);
  });
});
