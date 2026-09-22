import { PaymentRequestError } from '../../contracts/errors.ts';
import type { CouponGrant, CouponRepository } from '../../repositories/couponRepository.ts';
import {
  COUPON_CATALOG,
  describeCoupon,
  findCoupon,
  normalizeCouponCode,
  resolvePayableAmount,
  selfClaimableCoupons,
  type CouponDefinition
} from './couponCatalog.ts';

/**
 * 쿠폰 서비스.
 *
 * 하는 일은 셋뿐이다 — 내 지갑 보여 주기, 받을 수 있는 쿠폰 받기, 결제에 쓸 금액 정하기.
 * 할인 금액은 전부 `couponCatalog` 가 정하고, 이 서비스는 "이 사람이 몇 번 썼는가" 만
 * 저장소에서 가져와 붙인다.
 *
 * Firestore 가 꺼져 있으면(로컬) 쿠폰 기능은 조용히 비활성이다. 저장할 곳 없이 할인을
 * 내주면 한 쿠폰을 무한히 쓸 수 있다.
 */

export type CouponServiceDependencies = {
  repository: CouponRepository | null;
  now?: () => number;
  catalog?: readonly CouponDefinition[];
};

export type ResolvedOrderPricing = {
  catalogAmount: number;
  payableAmount: number;
  discount: number;
  couponCode: string;
};

export class CouponService {
  private readonly now: () => number;
  private readonly catalog: readonly CouponDefinition[];

  constructor(private readonly dependencies: CouponServiceDependencies) {
    this.now = dependencies.now || Date.now;
    this.catalog = dependencies.catalog || COUPON_CATALOG;
  }

  get enabled() {
    return Boolean(this.dependencies.repository);
  }

  private requireRepository() {
    if (!this.dependencies.repository) {
      throw new PaymentRequestError(503, '쿠폰 보관소가 준비되지 않아 쿠폰을 사용할 수 없습니다.');
    }

    return this.dependencies.repository;
  }

  /** 내 지갑. 받은 쿠폰과 아직 받을 수 있는 쿠폰을 함께 돌려준다. */
  async listWallet(userId: string) {
    if (!this.enabled) {
      return { enabled: false as const, wallet: [], claimable: [] };
    }

    const grants = await this.requireRepository().listByUser(userId);
    const byCode = new Map(grants.map((grant) => [grant.code, grant]));
    const now = this.now();

    const wallet = grants
      .map((grant) => {
        const coupon = findCoupon(grant.code, this.catalog);
        if (!coupon) return null;

        const expired = Date.parse(coupon.expiresAt) <= now;
        const usedUp = grant.redeemedCount >= coupon.perUserLimit;

        return {
          ...describeCoupon(coupon),
          redeemedCount: grant.redeemedCount,
          remaining: Math.max(0, coupon.perUserLimit - grant.redeemedCount),
          /* 화면이 판단을 다시 하지 않게 상태를 서버가 정해 준다. */
          state: usedUp ? ('used' as const) : expired ? ('expired' as const) : ('usable' as const)
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => {
        const order = { usable: 0, expired: 1, used: 2 };
        if (order[left.state] !== order[right.state]) return order[left.state] - order[right.state];
        return left.code.localeCompare(right.code);
      });

    const claimable = selfClaimableCoupons(this.catalog)
      .filter((coupon) => !byCode.has(coupon.code) && Date.parse(coupon.expiresAt) > now)
      .map(describeCoupon);

    return { enabled: true as const, wallet, claimable };
  }

  /** 스스로 받을 수 있는 쿠폰을 받는다. 이미 받았으면 그렇게 말한다. */
  async claim(userId: string, rawCode: unknown) {
    const repository = this.requireRepository();
    const code = normalizeCouponCode(rawCode);
    const coupon = findCoupon(code, this.catalog);

    if (!coupon) throw new PaymentRequestError(404, '없는 쿠폰 코드입니다.');
    if (!coupon.selfClaimable) {
      /* 초대 보상 쿠폰을 직접 받아 가면 초대 없이도 할인이 된다. */
      throw new PaymentRequestError(403, '직접 받을 수 있는 쿠폰이 아닙니다.');
    }
    if (Date.parse(coupon.expiresAt) <= this.now()) {
      throw new PaymentRequestError(410, '사용 기간이 지난 쿠폰입니다.');
    }

    const result = await repository.grant(userId, coupon.code, new Date(this.now()).toISOString());

    return {
      claimed: result.granted,
      coupon: describeCoupon(coupon),
      message: result.granted ? '쿠폰을 받았습니다.' : '이미 받은 쿠폰입니다.'
    };
  }

  /**
   * 결제에 쓸 금액을 정한다. **결제 서비스는 이 함수만 믿는다.**
   *
   * 클라이언트가 보낸 금액은 쓰지 않는다. 정가는 상품 원장에서, 할인은 쿠폰 원장에서,
   * 사용 횟수는 Firestore 에서 가져와 서버가 계산한다.
   */
  async resolvePricing(input: {
    userId: string;
    productId: string;
    catalogAmount: number;
    couponCode?: unknown;
  }): Promise<ResolvedOrderPricing> {
    const code = normalizeCouponCode(input.couponCode);

    if (!code) {
      return {
        catalogAmount: input.catalogAmount,
        payableAmount: input.catalogAmount,
        discount: 0,
        couponCode: ''
      };
    }

    const repository = this.requireRepository();
    const grant = await repository.get(input.userId, code);

    if (!grant) {
      /* 받지 않은 쿠폰은 쓸 수 없다. 코드를 아는 것만으로 할인이 되면 코드가 새는 순간
         전원이 할인을 받는다. */
      throw new PaymentRequestError(403, '보유하지 않은 쿠폰입니다.');
    }

    const resolved = resolvePayableAmount({
      code,
      productId: input.productId,
      catalogAmount: input.catalogAmount,
      redeemedCount: grant.redeemedCount,
      now: this.now(),
      catalog: this.catalog
    });

    if ('error' in resolved) throw new PaymentRequestError(409, resolved.error.message);

    return {
      catalogAmount: input.catalogAmount,
      payableAmount: resolved.payableAmount,
      discount: resolved.discount,
      couponCode: code
    };
  }

  /**
   * 결제가 확정된 뒤 쿠폰을 소모한다.
   *
   * 동시에 두 번 들어오면 저장소의 전제조건이 뒤쪽을 떨어뜨린다. 그 실패를 삼키면 한
   * 쿠폰으로 두 번 할인받게 되므로 그대로 올린다.
   */
  async redeem(userId: string, code: string, orderId: string) {
    if (!code) return null;

    const repository = this.requireRepository();
    const grant = await repository.get(userId, code);
    if (!grant) throw new PaymentRequestError(403, '보유하지 않은 쿠폰입니다.');

    return repository.redeem(grant, orderId, new Date(this.now()).toISOString());
  }

  /** 지갑에 없는 쿠폰을 운영이 넣어 줄 때 쓴다(초대 보상 등). */
  async grantReward(userId: string, rawCode: unknown): Promise<CouponGrant | null> {
    const code = normalizeCouponCode(rawCode);
    const coupon = findCoupon(code, this.catalog);
    if (!coupon || !this.enabled) return null;

    const result = await this.requireRepository().grant(
      userId,
      coupon.code,
      new Date(this.now()).toISOString()
    );

    return result.grant;
  }
}
