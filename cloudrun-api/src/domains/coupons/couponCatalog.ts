/**
 * 쿠폰 원장 — 서버가 소유한다.
 *
 * **클라이언트는 할인 금액을 말하지 않는다.** 어떤 쿠폰 코드인지만 말하고, 깎이는 금액과
 * 최종 결제액은 전부 서버가 이 표에서 다시 계산한다. 결제 서비스가 이미 같은 원칙으로
 * 돌아간다(상품 ID 로 정가를 재계산해 요청 금액과 대조). 쿠폰이 그 원칙에 구멍을 내면
 * 안 되므로, 할인도 같은 자리에서 서버가 정한다.
 *
 * 쿠폰 정의를 코드에 두는 이유: 깃 이력에 남고, 관리 화면 없이도 감사 가능하고, 관리자
 * 계정이 털려도 임의 할인이 새로 생기지 않는다. 사용 이력만 Firestore 에 쌓는다.
 */

export const COUPON_MIN_PAYABLE_AMOUNT = 100;

export type CouponDefinition = {
  code: string;
  label: string;
  /** 정액 할인(원). 정률은 쓰지 않는다 — 990원 상품에서 반올림 분쟁만 만든다. */
  discount: number;
  /** 'all' 또는 적용 가능한 상품 ID 목록. */
  productIds: 'all' | readonly string[];
  /** 이 정가 이상일 때만 쓸 수 있다. */
  minOrderAmount: number;
  /** ISO 8601. 이 시각 이후로는 쓸 수 없다. */
  expiresAt: string;
  /** 한 사람이 몇 번 쓸 수 있는가. 기본 1회. */
  perUserLimit: number;
  /** 사용자가 스스로 받을 수 있는 쿠폰인가. false 면 운영이 직접 넣어 준 것만 쓴다. */
  selfClaimable: boolean;
  description: string;
};

export const COUPON_CATALOG: readonly CouponDefinition[] = Object.freeze([
  Object.freeze({
    code: 'WELCOME500',
    label: '첫 리포트 500원 할인',
    discount: 500,
    productIds: 'all' as const,
    minOrderAmount: 600,
    expiresAt: '2027-12-31T14:59:59.000Z',
    perUserLimit: 1,
    selfClaimable: true,
    description: '운월당에 처음 오신 분께 한 번 드리는 쿠폰입니다.'
  }),
  Object.freeze({
    code: 'FRIEND300',
    label: '인연 초대 300원 할인',
    discount: 300,
    productIds: 'all' as const,
    minOrderAmount: 400,
    expiresAt: '2027-12-31T14:59:59.000Z',
    perUserLimit: 3,
    selfClaimable: false,
    description: '귀연도 초대에 답이 오면 드리는 쿠폰입니다.'
  })
]);

export type CouponRejection =
  | 'unknown-code'
  | 'expired'
  | 'product-not-eligible'
  | 'below-minimum-order'
  | 'per-user-limit-reached';

export type CouponAcceptance = {
  /*
   * 문자열 판별자를 쓴다. cloudrun-api 는 strict: false 로 컴파일되는데, 그 모드에서는
   * 객체 리터럴의 `ok: true` 가 boolean 으로 넓어져 판별 유니온 좁히기가 깨진다.
   * 문자열 리터럴은 그 모드에서도 좁혀진다.
   */
  kind: 'accepted';
  ok: true;
  coupon: CouponDefinition;
  /** 실제로 깎인 금액. 최소 결제액 때문에 정의보다 작을 수 있다. */
  discount: number;
  payableAmount: number;
};

export type CouponRejectionResult = {
  kind: 'rejected';
  ok: false;
  reason: CouponRejection;
  message: string;
};

export type CouponEvaluation = CouponAcceptance | CouponRejectionResult;

const REJECTION_MESSAGES: Record<CouponRejection, string> = {
  'unknown-code': '없는 쿠폰 코드입니다.',
  expired: '사용 기간이 지난 쿠폰입니다.',
  'product-not-eligible': '이 상품에는 쓸 수 없는 쿠폰입니다.',
  'below-minimum-order': '이 쿠폰을 쓸 수 있는 최소 주문 금액이 아닙니다.',
  'per-user-limit-reached': '이미 사용한 쿠폰입니다.'
};

/** 코드를 대문자·영숫자로만 정규화한다. 사용자가 소문자나 공백을 넣어도 찾게. */
export function normalizeCouponCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
}

export function findCoupon(code: unknown, catalog: readonly CouponDefinition[] = COUPON_CATALOG) {
  const normalized = normalizeCouponCode(code);

  return normalized ? catalog.find((coupon) => coupon.code === normalized) : undefined;
}

function reject(reason: CouponRejection): CouponRejectionResult {
  return { kind: 'rejected', ok: false, reason, message: REJECTION_MESSAGES[reason] };
}

/**
 * 쿠폰을 적용한 결제액을 정한다. 이 함수의 결과만 결제에 쓴다.
 *
 * 할인이 정가보다 크거나 같아도 0원 결제를 만들지 않는다. 결제대행사는 0원을 처리하지
 * 못하고, 무료로 줄 물건이라면 쿠폰이 아니라 상품 가격으로 정해야 할 일이다. 그래서
 * 최소 결제액까지만 깎고 실제로 깎인 금액을 함께 돌려준다 — 화면이 "500원 할인" 이라고
 * 써 놓고 400원만 깎이는 일이 없게.
 */
export function evaluateCoupon(input: {
  code: unknown;
  productId: string;
  catalogAmount: number;
  redeemedCount: number;
  now?: number;
  catalog?: readonly CouponDefinition[];
}): CouponEvaluation {
  const coupon = findCoupon(input.code, input.catalog);
  if (!coupon) return reject('unknown-code');

  const now = input.now ?? Date.now();
  if (Date.parse(coupon.expiresAt) <= now) return reject('expired');

  if (coupon.productIds !== 'all' && !coupon.productIds.includes(input.productId)) {
    return reject('product-not-eligible');
  }

  if (!Number.isSafeInteger(input.catalogAmount) || input.catalogAmount < coupon.minOrderAmount) {
    return reject('below-minimum-order');
  }

  if (input.redeemedCount >= coupon.perUserLimit) return reject('per-user-limit-reached');

  const maxDiscount = input.catalogAmount - COUPON_MIN_PAYABLE_AMOUNT;
  const discount = Math.max(0, Math.min(coupon.discount, maxDiscount));

  if (discount <= 0) return reject('below-minimum-order');

  return {
    kind: 'accepted',
    ok: true,
    coupon,
    discount,
    payableAmount: input.catalogAmount - discount
  };
}

/**
 * 결제에 쓸 최종 금액. 쿠폰이 없으면 정가 그대로.
 *
 * 결제 서비스는 이 한 함수만 부른다. 쿠폰 규칙이 늘어나도 결제 코드가 그것을 알 필요가
 * 없고, 결제대행사가 바뀌어도 이 계산은 그대로 쓴다.
 */


export function resolvePayableAmount(input: {
  code?: unknown;
  productId: string;
  catalogAmount: number;
  redeemedCount: number;
  now?: number;
  catalog?: readonly CouponDefinition[];
}):
  | { payableAmount: number; coupon: null; discount: 0 }
  | { payableAmount: number; coupon: CouponDefinition; discount: number }
  | { error: CouponRejectionResult } {
  if (!normalizeCouponCode(input.code)) {
    return { payableAmount: input.catalogAmount, coupon: null, discount: 0 };
  }

  const evaluation = evaluateCoupon({ ...input, code: input.code });
  if (evaluation.kind === 'rejected') return { error: evaluation };

  return {
    payableAmount: evaluation.payableAmount,
    coupon: evaluation.coupon,
    discount: evaluation.discount
  };
}

/** 화면에 내보낼 쿠폰 정보. `perUserLimit` 등 내부 값은 그대로 보내도 해롭지 않다. */
export function describeCoupon(coupon: CouponDefinition) {
  return {
    code: coupon.code,
    label: coupon.label,
    discount: coupon.discount,
    description: coupon.description,
    expiresAt: coupon.expiresAt,
    productIds: coupon.productIds,
    minOrderAmount: coupon.minOrderAmount,
    perUserLimit: coupon.perUserLimit
  };
}

export function selfClaimableCoupons(catalog: readonly CouponDefinition[] = COUPON_CATALOG) {
  return catalog.filter((coupon) => coupon.selfClaimable);
}
