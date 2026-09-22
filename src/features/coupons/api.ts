import { getPortOneConfirmEndpoint } from '../../lib/runtimeConfig';

/**
 * 쿠폰 지갑.
 *
 * 화면은 할인 금액을 계산하지 않는다. 서버가 준 값을 그대로 보여 주기만 하고, 결제할
 * 때도 코드만 보낸다 — 얼마가 깎이는지는 결제 시점에 서버가 다시 정한다.
 */

export type CouponState = 'usable' | 'expired' | 'used';

export type WalletCoupon = {
  code: string;
  label: string;
  discount: number;
  description: string;
  expiresAt: string;
  minOrderAmount: number;
  perUserLimit: number;
  redeemedCount: number;
  remaining: number;
  state: CouponState;
};

export type ClaimableCoupon = {
  code: string;
  label: string;
  discount: number;
  description: string;
  expiresAt: string;
  minOrderAmount: number;
  perUserLimit: number;
};

export type CouponWallet = {
  enabled: boolean;
  wallet: WalletCoupon[];
  claimable: ClaimableCoupon[];
};

function couponEndpoint(path: string) {
  const base = getPortOneConfirmEndpoint();
  if (!base) return '';

  /* 결제 확인 엔드포인트와 같은 서버다. `/api/payments/...` 에서 호스트만 떼어 쓴다. */
  try {
    const url = new URL(base);
    return `${url.origin}/api/coupons${path}`;
  } catch {
    return '';
  }
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function fetchCouponWallet(authToken: string): Promise<CouponWallet> {
  const endpoint = couponEndpoint('');
  if (!endpoint) return { enabled: false, wallet: [], claimable: [] };

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  if (!response.ok) {
    const body = await readJson(response);
    throw new Error(
      typeof body.message === 'string' ? body.message : '쿠폰을 불러오지 못했습니다.'
    );
  }

  const body = (await readJson(response)) as Partial<CouponWallet>;

  return {
    enabled: Boolean(body.enabled),
    wallet: Array.isArray(body.wallet) ? body.wallet : [],
    claimable: Array.isArray(body.claimable) ? body.claimable : []
  };
}

export async function claimCoupon(authToken: string, code: string) {
  const endpoint = couponEndpoint('/claim');
  if (!endpoint) throw new Error('쿠폰 서버에 연결할 수 없습니다.');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code })
  });

  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      typeof body.message === 'string' ? body.message : '쿠폰을 받지 못했습니다.'
    );
  }

  return {
    claimed: Boolean(body.claimed),
    message: typeof body.message === 'string' ? body.message : '쿠폰을 받았습니다.'
  };
}

/** 이 주문에 쓸 수 있는 쿠폰만. 판단 기준은 서버가 준 값뿐이다. */
export function usableCouponsForOrder(wallet: WalletCoupon[], productId: string, amount: number) {
  return wallet.filter(
    (coupon) => coupon.state === 'usable' && amount >= coupon.minOrderAmount && productId
  );
}
