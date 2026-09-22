import { describe, expect, it } from 'vitest';
import { CouponService } from '../../../cloudrun-api/src/domains/coupons/couponService.ts';
import type { CouponGrant } from '../../../cloudrun-api/src/repositories/couponRepository.ts';

/**
 * 쿠폰 서비스의 보안 경계.
 *
 * 지켜야 할 것은 하나다 — **코드를 아는 것만으로는 할인이 되지 않는다.** 쿠폰 코드는
 * 짧고 공유되기 쉬워서, 코드만으로 깎이면 한 사람에게 준 쿠폰이 곧 전원 할인이 된다.
 * 그래서 지갑에 실제로 지급된 쿠폰만 결제에 쓸 수 있다.
 */
const NOW = Date.parse('2026-09-22T00:00:00.000Z');

function grant(overrides: Partial<CouponGrant> = {}): CouponGrant {
  return {
    documentId: 'doc',
    path: '/couponGrants/doc',
    userId: 'user-1',
    code: 'WELCOME500',
    grantedAt: '2026-09-01T00:00:00.000Z',
    redeemedCount: 0,
    lastOrderId: '',
    lastRedeemedAt: '',
    updateTime: '2026-09-01T00:00:00.000Z',
    ...overrides
  };
}

function createService(options: { grants?: Record<string, CouponGrant> } = {}) {
  const grants = options.grants || {};
  const redeemed: Array<{ code: string; orderId: string }> = [];

  const repository = {
    async grant(userId: string, code: string) {
      const existing = grants[code];
      if (existing) return { granted: false as const, grant: existing };
      grants[code] = grant({ userId, code });
      return { granted: true as const, grant: grants[code] };
    },
    async get(_userId: string, code: string) {
      return grants[code] || null;
    },
    async listByUser() {
      return Object.values(grants);
    },
    async redeem(item: CouponGrant, orderId: string) {
      redeemed.push({ code: item.code, orderId });
      return { ...item, redeemedCount: item.redeemedCount + 1 };
    }
  };

  return {
    service: new CouponService({
      repository: repository as never,
      now: () => NOW
    }),
    grants,
    redeemed
  };
}

describe('쿠폰 서비스', () => {
  it('지갑에 없는 쿠폰은 코드를 알아도 쓸 수 없다', async () => {
    const { service } = createService();

    await expect(
      service.resolvePricing({
        userId: 'user-1',
        productId: 'general-signature',
        catalogAmount: 9900,
        couponCode: 'WELCOME500'
      })
    ).rejects.toThrow('보유하지 않은 쿠폰입니다.');
  });

  it('지갑에 있으면 서버가 계산한 금액이 나온다', async () => {
    const { service } = createService({ grants: { WELCOME500: grant() } });

    await expect(
      service.resolvePricing({
        userId: 'user-1',
        productId: 'general-signature',
        catalogAmount: 9900,
        couponCode: 'WELCOME500'
      })
    ).resolves.toEqual({
      catalogAmount: 9900,
      payableAmount: 9400,
      discount: 500,
      couponCode: 'WELCOME500'
    });
  });

  it('쿠폰이 없으면 정가 그대로이고 저장소를 부르지 않는다', async () => {
    const { service } = createService();

    for (const couponCode of [undefined, '', '   ']) {
      await expect(
        service.resolvePricing({
          userId: 'user-1',
          productId: 'general-signature',
          catalogAmount: 9900,
          couponCode
        })
      ).resolves.toMatchObject({ payableAmount: 9900, discount: 0, couponCode: '' });
    }
  });

  it('이미 다 쓴 쿠폰은 거절한다', async () => {
    const { service } = createService({ grants: { WELCOME500: grant({ redeemedCount: 1 }) } });

    await expect(
      service.resolvePricing({
        userId: 'user-1',
        productId: 'general-signature',
        catalogAmount: 9900,
        couponCode: 'WELCOME500'
      })
    ).rejects.toThrow('이미 사용한 쿠폰입니다.');
  });

  it('직접 받을 수 없는 쿠폰은 받기로도 가져갈 수 없다', async () => {
    /* FRIEND300 은 초대 보상이다. 스스로 받아 갈 수 있으면 초대 없이도 할인이 된다. */
    const { service } = createService();

    await expect(service.claim('user-1', 'FRIEND300')).rejects.toThrow(
      '직접 받을 수 있는 쿠폰이 아닙니다.'
    );
  });

  it('같은 쿠폰을 두 번 받아도 한 장만 생긴다', async () => {
    const { service, grants } = createService();

    await expect(service.claim('user-1', 'WELCOME500')).resolves.toMatchObject({ claimed: true });
    await expect(service.claim('user-1', 'welcome-500')).resolves.toMatchObject({
      claimed: false,
      message: '이미 받은 쿠폰입니다.'
    });
    expect(Object.keys(grants)).toEqual(['WELCOME500']);
  });

  it('저장소가 없으면 쿠폰을 쓰지 못하게 막는다', async () => {
    /* Firestore 가 꺼진 채로 할인을 내주면 사용 이력이 남지 않아 무한히 쓸 수 있다. */
    const service = new CouponService({ repository: null, now: () => NOW });

    expect(service.enabled).toBe(false);
    await expect(service.listWallet('user-1')).resolves.toEqual({
      enabled: false,
      wallet: [],
      claimable: []
    });
    await expect(
      service.resolvePricing({
        userId: 'user-1',
        productId: 'general-signature',
        catalogAmount: 9900,
        couponCode: 'WELCOME500'
      })
    ).rejects.toThrow('쿠폰 보관소가 준비되지 않아');
  });

  it('지갑은 쓸 수 있는 쿠폰을 위로 올리고 상태를 서버가 정한다', async () => {
    const { service } = createService({
      grants: {
        WELCOME500: grant({ redeemedCount: 1 }),
        FRIEND300: grant({ code: 'FRIEND300', redeemedCount: 0 })
      }
    });

    const wallet = await service.listWallet('user-1');

    expect(wallet.wallet.map((item) => [item.code, item.state])).toEqual([
      ['FRIEND300', 'usable'],
      ['WELCOME500', 'used']
    ]);
    expect(wallet.wallet[0].remaining).toBe(3);
  });
});
