import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import { API_ERROR_CODE } from '../../../cloudrun-api/src/contracts/api.ts';
import { toPublicApiError } from '../../../cloudrun-api/src/contracts/errors.ts';
import { ArchiveService } from '../../../cloudrun-api/src/domains/archives/archiveService.ts';
import { PortOneClient } from '../../../cloudrun-api/src/domains/payments/portoneClient.ts';
import { sendJson } from '../../../cloudrun-api/src/middleware/error.ts';
import { FirestoreRepository } from '../../../cloudrun-api/src/repositories/firestoreRepository.ts';
import { ReportArchiveRepository } from '../../../cloudrun-api/src/repositories/reportArchiveRepository.ts';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

async function listenWithPayload(status: number, payload: unknown) {
  const server = createServer((_req, res) => sendJson(res, status, payload));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${address.port}/fixture`);
}

describe('public API error safety', () => {
  it('allows only stable public fields and removes stack, cause, provider bodies, and tokens', async () => {
    const response = await listenWithPayload(500, {
      code: 'UNTRUSTED_INTERNAL_CODE',
      message: 'provider raw message private@example.com',
      stack: 'stack with reportAccessToken=secret-report-token',
      cause: { orderClaim: 'secret-order-claim' },
      providerResponse: { apiSecret: 'secret-provider-key' }
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: API_ERROR_CODE.INTERNAL_ERROR,
      message: '요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    });
  });

  it('keeps compatibility routes but strips arbitrary 4xx details', async () => {
    const response = await listenWithPayload(404, {
      code: API_ERROR_CODE.UNSUPPORTED_ROUTE,
      message: '지원하지 않는 경로입니다.',
      routes: ['GET /health', 42],
      details: { email: 'private@example.com' }
    });

    expect(await response.json()).toEqual({
      code: API_ERROR_CODE.UNSUPPORTED_ROUTE,
      message: '지원하지 않는 경로입니다.',
      routes: ['GET /health']
    });
  });

  it('does not expose PortOne or Firestore provider response text', async () => {
    const rawProviderText =
      'private@example.com birthDate=1990-01-01 reportAccessToken=secret-token';
    const portOne = new PortOneClient(
      { apiBaseUrl: 'https://payments.fixture.test', apiSecret: 'fixture-secret' },
      vi.fn(async () =>
        new Response(JSON.stringify({ message: rawProviderText }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    let portOneError: unknown;
    try {
      await portOne.requestAccessToken();
    } catch (error) {
      portOneError = error;
    }

    const publicPortOneError = toPublicApiError(portOneError, {
      code: API_ERROR_CODE.INTERNAL_ERROR,
      message: '결제 서비스를 사용할 수 없습니다.'
    });
    expect(publicPortOneError.body.code).toBe(API_ERROR_CODE.PAYMENT_PROVIDER_FAILED);
    expect(JSON.stringify(publicPortOneError)).not.toContain(rawProviderText);

    const firestoreConfig = loadConfig({
      ENABLE_FIRESTORE_ARCHIVE: 'true',
      FIRESTORE_PROJECT_ID: 'fixture-project',
      FIRESTORE_ACCESS_TOKEN: 'fixture-access-token'
    }).firestore;
    const firestore = new FirestoreRepository(
      firestoreConfig,
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: rawProviderText } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    let firestoreError: unknown;
    try {
      await firestore.request('/reportArchives/fixture');
    } catch (error) {
      firestoreError = error;
    }

    const publicFirestoreError = toPublicApiError(firestoreError, {
      code: API_ERROR_CODE.INTERNAL_ERROR,
      message: '저장소를 사용할 수 없습니다.'
    });
    expect(publicFirestoreError.body.code).toBe(API_ERROR_CODE.DATASTORE_UNAVAILABLE);
    expect(JSON.stringify(publicFirestoreError)).not.toContain(rawProviderText);
  });
});

describe('runtime archive ownership boundary', () => {
  it('queries only the authenticated owner and keeps archived history while excluding unknown data', async () => {
    const list = vi.fn(async (ownerUserId?: string) => [
      { id: 'archived-report', productId: 'life-flow', ownerUserId },
      { id: 'unknown-report', productId: 'unknown-product', ownerUserId }
    ]);

    const service = new ArchiveService(
      loadConfig(),
      { upsert: vi.fn(), list },
      {
        verifyReportAccessToken: vi.fn(),
        createUserBinding: (userId: string) => `binding:${userId}`
      }
    );

    const entries = await service.list('owner-user-001');
    expect(list).toHaveBeenCalledWith('owner-user-001');
    expect(entries.map((entry) => entry.id)).toEqual(['archived-report']);
  });

  it('forces report-token verification in production even when the dev toggle is false', () => {
    expect(loadConfig({
      NODE_ENV: 'production',
      REQUIRE_REPORT_TOKEN_FOR_ARCHIVE: 'false'
    }).report.requireTokenForArchive).toBe(true);
    expect(loadConfig({
      NODE_ENV: 'development',
      REQUIRE_REPORT_TOKEN_FOR_ARCHIVE: 'false'
    }).report.requireTokenForArchive).toBe(false);
  });

  it('rejects another user binding before any archive write', async () => {
    const upsert = vi.fn();
    const service = new ArchiveService(
      loadConfig({ REQUIRE_REPORT_TOKEN_FOR_ARCHIVE: 'true' }),
      { upsert, list: vi.fn(async () => []) },
      {
        verifyReportAccessToken: vi.fn(() => ({
          orderId: 'UW-123456789012',
          paymentId: 'UW-123456789012',
          productId: 'general-signature',
          amount: 79_000,
          userBinding: 'binding:another-user',
          entitlementId: 'a'.repeat(64)
        })),
        createUserBinding: (userId: string) => `binding:${userId}`
      }
    );

    await expect(
      service.save('owner-user-001', {
        reportAccessToken: 'fixture-report-token',
        entry: {
          id: 'general-signature:UW-123456789012',
          productId: 'general-signature',
          orderId: 'UW-123456789012',
          reportData: { fixture: true }
        }
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects credential fields before persisting an archive entry', async () => {
    const upsert = vi.fn();
    const service = new ArchiveService(
      loadConfig({ REQUIRE_REPORT_TOKEN_FOR_ARCHIVE: 'false' }),
      { upsert, list: vi.fn(async () => []) },
      {
        verifyReportAccessToken: vi.fn(),
        createUserBinding: (userId: string) => `binding:${userId}`
      }
    );

    await expect(
      service.save('owner-user-001', {
        entry: {
          id: 'general-signature:UW-123456789012',
          productId: 'general-signature',
          reportData: {
            title: 'fixture',
            reportAccessToken: 'must-never-be-stored'
          }
        }
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('keeps archive IDs bound to their original order and product with a write precondition', async () => {
    const request = vi.fn(async (path: string) => {
      if (!path.includes('?')) {
        return {
          updateTime: '2026-07-22T00:00:00.000Z',
          fields: {
            userId: { stringValue: 'owner-user-001' },
            archiveId: { stringValue: 'archive-001' },
            orderId: { stringValue: 'UW-123456789012' },
            productId: { stringValue: 'general-signature' }
          }
        };
      }
      return {};
    });
    const repository = new ReportArchiveRepository(
      { request } as unknown as FirestoreRepository,
      'reportArchives'
    );
    const baseEntry = {
      id: 'archive-001',
      orderId: 'UW-123456789012',
      productId: 'general-signature',
      customerName: 'fixture-user',
      title: 'fixture-title',
      createdAt: '2026-07-22T00:00:00.000Z'
    };

    await expect(
      repository.saveForUser('owner-user-001', {
        ...baseEntry,
        orderId: 'UW-999999999999'
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(request).toHaveBeenCalledTimes(1);

    request.mockClear();
    await expect(
      repository.saveForUser('owner-user-001', baseEntry)
    ).resolves.toEqual(baseEntry);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toContain(
      'currentDocument.updateTime=2026-07-22T00%3A00%3A00.000Z'
    );
  });
});

describe('runtime source logging policy', () => {
  it('logs only a stable code when Gemini draft generation fails', () => {
    const source = readFileSync(
      new URL('./geminiReportService.ts', import.meta.url),
      'utf8'
    );

    expect(source).toContain("console.error('GEMINI_REPORT_DRAFT_FAILED')");
    expect(source).not.toMatch(/console\.error\([^\n]+,\s*(?:error|\w+Error)\b/i);
  });
});
