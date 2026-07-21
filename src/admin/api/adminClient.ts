import type { ReportArchiveEntry } from '../../lib/reportArchive';
import {
  getAdminLoginEndpoint,
  getAdminReportsEndpoint
} from '../../shared/api/runtimeConfig';

export type AdminLoginResult = {
  adminAccessToken: string;
  expiresInMs?: number;
};

type AdminLoginResponse = {
  adminAccessToken?: string;
  expiresInMs?: number;
};

type AdminReportsResponse = {
  entries?: ReportArchiveEntry[];
};

export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

function loginErrorMessage(status: number) {
  if (status === 401 || status === 403) {
    return '아이디 또는 비밀번호가 올바르지 않습니다.';
  }

  if (status === 429) {
    return '로그인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (status === 503) {
    return '관리자 로그인 서비스를 현재 사용할 수 없습니다.';
  }

  return '관리자 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

function reportsErrorMessage(status: number) {
  if (status === 401 || status === 403) {
    return '관리자 세션이 만료되었습니다. 다시 로그인해 주세요.';
  }

  return '관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export function isAdminSessionError(error: unknown) {
  return error instanceof AdminApiError && (error.status === 401 || error.status === 403);
}

export function resolveAdminLoginEndpoint() {
  return getAdminLoginEndpoint();
}

export function resolveAdminReportsEndpoint() {
  return getAdminReportsEndpoint();
}

export async function loginAdmin(
  adminId: string,
  password: string,
  endpoint = resolveAdminLoginEndpoint()
): Promise<AdminLoginResult> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        adminId,
        password
      })
    });
  } catch {
    throw new AdminApiError(0, loginErrorMessage(0));
  }

  const payload = (await response.json().catch(() => null)) as AdminLoginResponse | null;

  if (!response.ok) {
    throw new AdminApiError(response.status, loginErrorMessage(response.status));
  }

  if (!payload?.adminAccessToken || typeof payload.adminAccessToken !== 'string') {
    throw new AdminApiError(502, loginErrorMessage(502));
  }

  return {
    adminAccessToken: payload.adminAccessToken,
    expiresInMs: Number.isFinite(payload.expiresInMs) ? payload.expiresInMs : undefined
  };
}

export async function fetchAdminReports(
  adminAccessToken: string,
  endpoint = resolveAdminReportsEndpoint()
): Promise<ReportArchiveEntry[]> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminAccessToken}`
      }
    });
  } catch {
    throw new AdminApiError(0, reportsErrorMessage(0));
  }

  const payload = (await response.json().catch(() => null)) as AdminReportsResponse | null;

  if (!response.ok) {
    throw new AdminApiError(response.status, reportsErrorMessage(response.status));
  }

  if (!Array.isArray(payload?.entries)) {
    throw new AdminApiError(502, reportsErrorMessage(502));
  }

  return payload.entries;
}
