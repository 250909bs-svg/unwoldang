import { CLOUD_RUN_API_BASE_URL } from '../../shared/api/runtimeConfig';
import type {
  GuiyeondoBirthProfile,
  GuiyeondoConnection,
  GuiyeondoInvite,
  GuiyeondoOwnedInvite,
  GuiyeondoPerson
} from './types';

const REQUEST_TIMEOUT_MS = 15_000;

type ApiErrorPayload = { message?: string };

function apiBaseUrl() {
  return (import.meta.env.VITE_GUIYEONDO_API_BASE_URL?.trim() || CLOUD_RUN_API_BASE_URL)
    .replace(/\/$/, '');
}

function inviteEndpoint(publicId = '') {
  const suffix = publicId ? `/${encodeURIComponent(publicId)}` : '';
  return `${apiBaseUrl()}/api/guiyeondo/invites${suffix}`;
}

function connectionEndpoint(path = '') {
  return `${apiBaseUrl()}/api/guiyeondo/connections${path}`;
}

/**
 * 손님이 영구 보관에 동의한 버전.
 *
 * `v1` 은 "초대 만료일(최대 14일)까지" 를 받은 동의라, 지금 새로 받는 동의와는 문구가
 * 다르다. 서버는 두 버전을 모두 받되 보관 기간을 다르게 적용한다 — 이미 받은 동의의
 * 범위를 나중에 넓히지는 않기 때문이다.
 */
export const GUIYEONDO_KEEP_CONSENT_VERSION = 'guiyeondo-share-v2';

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
    const payload = (await response.json().catch(() => null)) as (T & ApiErrorPayload) | null;
    if (!response.ok || !payload) {
      throw new Error(payload?.message || '귀연도 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('귀연도 서버 응답이 늦어지고 있습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function createGuiyeondoInviteRemote(ownerProfile: GuiyeondoBirthProfile, authToken: string) {
  const payload = await requestJson<{ invite: GuiyeondoInvite }>(inviteEndpoint(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ ownerProfile })
  });
  return payload.invite satisfies GuiyeondoOwnedInvite;
}

export async function fetchGuiyeondoOwnedInvites(authToken: string) {
  return requestJson<{ invites: GuiyeondoOwnedInvite[] }>(inviteEndpoint(), {
    headers: { Authorization: `Bearer ${authToken}` }
  });
}

export async function fetchGuiyeondoInvite(publicId: string) {
  return requestJson<{ invite: GuiyeondoInvite }>(inviteEndpoint(publicId));
}

export async function submitGuiyeondoInviteResponse(options: {
  publicId: string;
  guestProfile: GuiyeondoBirthProfile;
  idempotencyKey: string;
}) {
  return requestJson<{ person: GuiyeondoPerson; keepable?: boolean }>(
    `${inviteEndpoint(options.publicId)}/responses`,
    {
      method: 'POST',
      body: JSON.stringify({
        guestProfile: options.guestProfile,
        idempotencyKey: options.idempotencyKey,
        consentVersion: GUIYEONDO_KEEP_CONSENT_VERSION
      })
    }
  );
}

export async function fetchGuiyeondoInviteResponses(invite: GuiyeondoOwnedInvite, authToken: string) {
  return requestJson<{ people: GuiyeondoPerson[] }>(`${inviteEndpoint(invite.publicId)}/responses`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
}

export async function revokeGuiyeondoInvite(invite: GuiyeondoOwnedInvite, authToken: string) {
  return requestJson<{ ok: true; publicId: string; revokedAt: string }>(`${inviteEndpoint(invite.publicId)}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` }
  });
}

/** 계정에 남아 있는 인연. 기기를 바꿔도 이것이 지도를 다시 채운다. */
export async function fetchGuiyeondoConnections(authToken: string) {
  return requestJson<{ connections: GuiyeondoConnection[] }>(connectionEndpoint(), {
    headers: { Authorization: `Bearer ${authToken}` }
  });
}

/** 초대에 응답한 사람이 로그인한 뒤 자기 몫을 가져간다. */
export async function claimGuiyeondoConnection(options: {
  publicId: string;
  idempotencyKey: string;
  authToken: string;
}) {
  return requestJson<{ connection: GuiyeondoConnection }>(connectionEndpoint('/claim'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.authToken}` },
    body: JSON.stringify({ publicId: options.publicId, idempotencyKey: options.idempotencyKey })
  });
}

/**
 * 직접 넣은 사람을 계정에 남긴다.
 *
 * 두 출생정보를 보내지만 서버는 계산에만 쓰고 버린다 — 초대 응답과 같은 처리다.
 * 그래서 기기를 바꿔도 사람은 돌아오고, 상대의 생년월일시는 서버에 남지 않는다.
 */
export async function createGuiyeondoDirectConnection(options: {
  ownerProfile: GuiyeondoBirthProfile;
  guestProfile: GuiyeondoBirthProfile;
  idempotencyKey: string;
  authToken: string;
}) {
  return requestJson<{ connection: GuiyeondoConnection }>(connectionEndpoint('/direct'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.authToken}` },
    body: JSON.stringify({
      ownerProfile: options.ownerProfile,
      guestProfile: options.guestProfile,
      idempotencyKey: options.idempotencyKey
    })
  });
}

/* DELETE 가 아니라 POST 인 이유는 CORS 허용 메서드가 GET,POST,OPTIONS 이기 때문이다. */
export async function removeGuiyeondoConnection(connectionId: string, authToken: string) {
  return requestJson<{ ok: true; connectionId: string }>(
    connectionEndpoint(`/${encodeURIComponent(connectionId)}/remove`),
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    }
  );
}
