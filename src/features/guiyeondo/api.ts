import { CLOUD_RUN_API_BASE_URL } from '../../shared/api/runtimeConfig';
import type {
  GuiyeondoBirthProfile,
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

export async function createGuiyeondoInviteRemote(ownerProfile: GuiyeondoBirthProfile) {
  const payload = await requestJson<{ invite: GuiyeondoInvite; ownerKey: string }>(inviteEndpoint(), {
    method: 'POST',
    body: JSON.stringify({ ownerProfile })
  });
  return { ...payload.invite, ownerKey: payload.ownerKey } satisfies GuiyeondoOwnedInvite;
}

export async function fetchGuiyeondoInvite(publicId: string) {
  return requestJson<{ invite: GuiyeondoInvite }>(inviteEndpoint(publicId));
}

export async function submitGuiyeondoInviteResponse(options: {
  publicId: string;
  guestProfile: GuiyeondoBirthProfile;
  idempotencyKey: string;
}) {
  return requestJson<{ person: GuiyeondoPerson }>(`${inviteEndpoint(options.publicId)}/responses`, {
    method: 'POST',
    body: JSON.stringify({
      guestProfile: options.guestProfile,
      idempotencyKey: options.idempotencyKey,
      consentVersion: 'guiyeondo-share-v1'
    })
  });
}

export async function fetchGuiyeondoInviteResponses(invite: GuiyeondoOwnedInvite) {
  return requestJson<{ people: GuiyeondoPerson[] }>(`${inviteEndpoint(invite.publicId)}/responses`, {
    headers: { Authorization: `Bearer ${invite.ownerKey}` }
  });
}

export async function revokeGuiyeondoInvite(invite: GuiyeondoOwnedInvite) {
  return requestJson<{ ok: true; publicId: string; revokedAt: string }>(`${inviteEndpoint(invite.publicId)}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${invite.ownerKey}` }
  });
}
