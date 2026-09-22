import { createHash } from 'node:crypto';
import { PaymentRequestError } from '../../contracts/errors.ts';
import type { GiftRecord, GiftRepository } from '../../repositories/giftRepository.ts';
import { createGiftCode } from '../../repositories/giftRepository.ts';

/**
 * 선물하기.
 *
 * 산 사람이 결제하면 코드가 생기고, 받은 사람이 그 코드로 리포트를 한 번 만든다.
 *
 * **리포트 접근 토큰은 산 사람의 사용자 결속(userBinding)으로 발급한다.** 결제 원장이
 * 그 결속으로 잠겨 있어서(`reportService.assertLedgerMatchesClaims`), 받는 사람의
 * 결속으로 발급하면 원장과 맞지 않아 리포트가 거절된다. 대신 그 토큰은 30분짜리이고,
 * 받은 사람이 로그인해 선물을 소모한 **뒤에만** 나가며, 선물은 한 번만 소모된다.
 * 그래서 결제·리포트 코드를 한 줄도 고치지 않고 선물이 성립한다.
 */

export const GIFT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const GIFT_MESSAGE_MAX_LENGTH = 200;

export type GiftServiceDependencies = {
  repository: GiftRepository | null;
  tokenService: {
    createUserBinding(userId: string): string;
    createReportAccessToken(input: {
      userId: string;
      orderId: string;
      paymentId: string;
      productId: string;
      amount: number;
      entitlementId: string;
    }): string;
  };
  reportAccessTokenTtlMs: number;
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
};

export function sanitizeGiftMessage(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, GIFT_MESSAGE_MAX_LENGTH)
    : '';
}

/** 코드를 대문자·영숫자로만 정규화한다. 링크에서 잘려 오거나 소문자로 와도 찾게. */
export function normalizeGiftCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32) : '';
}

export class GiftService {
  private readonly now: () => number;

  constructor(private readonly dependencies: GiftServiceDependencies) {
    this.now = dependencies.now || Date.now;
  }

  get enabled() {
    return Boolean(this.dependencies.repository);
  }

  private requireRepository() {
    if (!this.dependencies.repository) {
      throw new PaymentRequestError(503, '선물 보관소가 준비되지 않아 선물을 만들 수 없습니다.');
    }

    return this.dependencies.repository;
  }

  /** 결제가 확정된 뒤 선물을 만든다. 같은 결제로 두 번 들어오면 같은 선물을 돌려준다. */
  async createForPayment(input: {
    orderId: string;
    paymentId: string;
    productId: string;
    amount: number;
    entitlementId: string;
    buyerUserId: string;
    buyerName: string;
    message: unknown;
  }) {
    const repository = this.requireRepository();
    const now = this.now();
    /* 코드를 주문번호에서 결정론적으로 만든다. 같은 결제를 두 번 확인해도 같은 코드가
       나와야 Firestore 의 409 가 "이미 만든 선물" 로 읽힌다. 주문번호 자체가 난수
       16바이트를 담고 있어(`UW-<시각>-<base64url>`) 코드가 추측되지는 않는다. */
    const code = createGiftCode((size) =>
      createHash('sha256').update(`gift-code:${input.orderId}`).digest().subarray(0, size)
    );

    const result = await repository.create({
      code,
      orderId: input.orderId,
      paymentId: input.paymentId,
      productId: input.productId,
      amount: input.amount,
      entitlementId: input.entitlementId,
      buyerUserId: input.buyerUserId,
      buyerName: sanitizeGiftMessage(input.buyerName).slice(0, 20) || '운월당 회원',
      message: sanitizeGiftMessage(input.message),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + GIFT_TTL_MS).toISOString()
    });

    return { code: result.gift.code, expiresAt: result.gift.expiresAt };
  }

  /**
   * 받은 사람이 링크를 열었을 때 보여 줄 것.
   *
   * 로그인 전이므로 **누가 봐도 괜찮은 값만** 내보낸다. 산 사람의 사용자 ID, 주문번호,
   * 권한 ID 는 나가지 않는다 — 그 값들은 결제 원장을 가리키는 키다.
   */
  async describe(rawCode: unknown) {
    const code = normalizeGiftCode(rawCode);
    const gift = code ? await this.requireRepository().find(code) : null;

    if (!gift) throw new PaymentRequestError(404, '사용할 수 없는 선물입니다. 보낸 분께 새 링크를 요청해 주세요.');

    const expired = Date.parse(gift.expiresAt) <= this.now();

    return {
      code: gift.code,
      productId: gift.productId,
      buyerName: gift.buyerName,
      message: gift.message,
      expiresAt: gift.expiresAt,
      state: gift.redeemedByUserId ? ('used' as const) : expired ? ('expired' as const) : ('open' as const)
    };
  }

  /**
   * 선물을 받는다. 받은 사람이 로그인한 상태여야 한다.
   *
   * 로그인을 요구하는 이유: 누가 받았는지 남아야 분쟁이 정리되고, 만들어진 리포트가
   * 그 사람 보관함에 들어간다. 익명으로 열면 둘 다 안 된다.
   */
  async redeem(userId: string, rawCode: unknown) {
    const repository = this.requireRepository();
    const code = normalizeGiftCode(rawCode);
    const gift = code ? await repository.find(code) : null;

    if (!gift) throw new PaymentRequestError(404, '사용할 수 없는 선물입니다.');

    if (gift.redeemedByUserId) {
      /* 받은 사람이 자기 것을 다시 열었다면 토큰을 다시 내준다 — 30분이 지나 만료된
         경우가 실제로 있다. 남이 열었다면 이미 쓰인 선물이다. */
      if (gift.redeemedByUserId !== userId) {
        throw new PaymentRequestError(409, '이미 사용된 선물입니다.');
      }
    } else {
      if (Date.parse(gift.expiresAt) <= this.now()) {
        throw new PaymentRequestError(410, '사용 기간이 지난 선물입니다.');
      }

      await repository.redeem(gift, userId, new Date(this.now()).toISOString());
    }

    return {
      productId: gift.productId,
      buyerName: gift.buyerName,
      message: gift.message,
      /* 산 사람의 결속으로 발급한다. 이유는 파일 머리에 적었다. */
      reportAccessToken: this.dependencies.tokenService.createReportAccessToken({
        userId: gift.buyerUserId,
        orderId: gift.orderId,
        paymentId: gift.paymentId,
        productId: gift.productId,
        amount: gift.amount,
        entitlementId: gift.entitlementId
      }),
      reportAccessTokenExpiresAt: new Date(
        this.now() + this.dependencies.reportAccessTokenTtlMs
      ).toISOString()
    };
  }
}

export type { GiftRecord };
