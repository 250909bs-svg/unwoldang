import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdminApiError,
  fetchAdminReports,
  loginAdmin
} from './adminClient';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin API client contracts', () => {
  it('preserves the login body and token response contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      adminAccessToken: 'token-value',
      expiresInMs: 43_200_000
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginAdmin('operator', 'secret', '/api/admin/login')).resolves.toEqual({
      adminAccessToken: 'token-value',
      expiresInMs: 43_200_000
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'operator', password: 'secret' })
    });
  });

  it('never exposes raw server configuration errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      message: 'ADMIN_CREDENTIAL_HASH is not configured.'
    }, 503)));

    const error = await loginAdmin('operator', 'secret', '/api/admin/login').catch((value) => value);
    expect(error).toBeInstanceOf(AdminApiError);
    expect(error).toMatchObject({
      status: 503,
      message: '관리자 로그인 서비스를 현재 사용할 수 없습니다.'
    });
    expect(String(error.message)).not.toContain('ADMIN_CREDENTIAL_HASH');
  });

  it('uses the bearer token and validates the reports envelope', async () => {
    const entries = [{ id: 'archive-1' }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ entries }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAdminReports('admin-token', '/api/admin/reports')).resolves.toEqual(entries);
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/reports', {
      method: 'GET',
      headers: { Authorization: 'Bearer admin-token' }
    });
  });

  it('maps expired sessions and malformed responses to safe errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ message: 'Invalid admin token internals' }, 401)));
    await expect(fetchAdminReports('expired', '/api/admin/reports')).rejects.toMatchObject({
      status: 401,
      message: '관리자 세션이 만료되었습니다. 다시 로그인해 주세요.'
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ entries: null })));
    await expect(fetchAdminReports('token', '/api/admin/reports')).rejects.toMatchObject({
      status: 502,
      message: '관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    });
  });
});
