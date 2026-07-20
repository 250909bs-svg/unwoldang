import {
  fetchAdminReportArchiveEntries,
  type ReportArchiveEntry
} from '../../lib/reportArchive';
import { getAdminLoginEndpoint } from '../../lib/runtimeConfig';

export type AdminLoginResult = {
  adminAccessToken: string;
  expiresInMs?: number;
};

type AdminLoginResponse = {
  adminAccessToken?: string;
  expiresInMs?: number;
  message?: string;
};

export function resolveAdminLoginEndpoint() {
  return getAdminLoginEndpoint();
}

export async function loginAdmin(
  adminId: string,
  password: string,
  endpoint = resolveAdminLoginEndpoint()
): Promise<AdminLoginResult> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      adminId,
      password
    })
  });
  const payload = (await response.json().catch(() => null)) as AdminLoginResponse | null;

  if (!response.ok || !payload?.adminAccessToken) {
    throw new Error(payload?.message || '관리자 로그인에 실패했습니다.');
  }

  return {
    adminAccessToken: payload.adminAccessToken,
    expiresInMs: payload.expiresInMs
  };
}

export function fetchAdminReports(adminAccessToken?: string): Promise<ReportArchiveEntry[]> {
  return fetchAdminReportArchiveEntries(adminAccessToken);
}
