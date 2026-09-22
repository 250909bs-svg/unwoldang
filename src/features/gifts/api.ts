import { getPortOneConfirmEndpoint } from '../../lib/runtimeConfig';

/**
 * 선물하기 클라이언트.
 *
 * 링크를 받은 사람은 아직 로그인하지 않았으므로 조회는 공개다. 대신 서버가 주문번호나
 * 권한 ID 는 돌려주지 않는다 — 그 값들은 결제 원장을 가리키는 키다.
 */

export type GiftState = 'open' | 'used' | 'expired';

export type GiftSummary = {
  code: string;
  productId: string;
  buyerName: string;
  message: string;
  expiresAt: string;
  state: GiftState;
};

export type RedeemedGift = {
  productId: string;
  buyerName: string;
  message: string;
  reportAccessToken: string;
  reportAccessTokenExpiresAt: string;
};

function giftEndpoint(path: string) {
  const base = getPortOneConfirmEndpoint();
  if (!base) return '';

  try {
    return `${new URL(base).origin}/api/gifts${path}`;
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

function fail(body: Record<string, unknown>, fallback: string) {
  return new Error(typeof body.message === 'string' ? body.message : fallback);
}

export function isGiftAvailable() {
  return Boolean(giftEndpoint(''));
}

export async function fetchGift(code: string): Promise<GiftSummary> {
  const endpoint = giftEndpoint(`/${encodeURIComponent(code)}`);
  if (!endpoint) throw new Error('선물 서버에 연결할 수 없습니다.');

  const response = await fetch(endpoint);
  const body = await readJson(response);

  if (!response.ok) throw fail(body, '선물을 불러오지 못했습니다.');

  return body as unknown as GiftSummary;
}

export async function redeemGift(code: string, authToken: string): Promise<RedeemedGift> {
  const endpoint = giftEndpoint(`/${encodeURIComponent(code)}/redeem`);
  if (!endpoint) throw new Error('선물 서버에 연결할 수 없습니다.');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const body = await readJson(response);

  if (!response.ok) throw fail(body, '선물을 받지 못했습니다.');

  if (typeof body.reportAccessToken !== 'string' || body.reportAccessToken.length < 40) {
    /* 토큰 없이 통과하면 다음 화면이 리포트를 만들려다 401 로 떨어진다. 여기서 세운다. */
    throw new Error('선물 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  return body as unknown as RedeemedGift;
}

/** 받는 사람에게 보낼 링크. 도메인은 지금 보고 있는 곳을 쓴다. */
export function buildGiftUrl(code: string) {
  const origin = typeof window === 'undefined' ? 'https://unwoldang.com' : window.location.origin;

  return `${origin}/gift/${code}`;
}
