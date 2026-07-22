import { describe, expect, it, vi } from 'vitest';
import {
  DATA_SCHEMA_VERSION,
  assertNoSensitiveKeys,
  createSafeOperationalLog,
  getSafeErrorDiagnostics,
  validateAdminAuditEventForPersistence,
  writeSafeOperationalLog,
  type AdminAuditEvent,
  type SafeOperationalLogInput
} from '../../../cloudrun-api/src/contracts/index.ts';

const NOW = '2026-07-22T00:00:00.000Z';
const HASH = 'a'.repeat(64);

function buildAuditEvent(overrides: Partial<AdminAuditEvent> = {}): AdminAuditEvent {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    eventId: 'audit-contract-event-001',
    actorAdminId: 'admin-contract-001',
    ownerUserId: 'kakao-owner-001',
    productId: 'general-signature',
    status: 'succeeded',
    action: 'report.list',
    resourceType: 'reportArchive',
    resourceIdHash: HASH,
    requestId: 'request-contract-001',
    metadata: {
      resultCount: 2,
      durationMs: 15,
      source: 'admin-api'
    },
    createdAt: NOW,
    updatedAt: NOW,
    idempotencyKey: `request-contract-001:report.list:${HASH}`,
    ...overrides
  };
}

function buildOperationalLog(): SafeOperationalLogInput {
  return {
    event: 'report.generation.completed',
    level: 'info',
    timestamp: NOW,
    code: 'REPORT_COMPLETED',
    status: 200,
    requestId: 'request-contract-001',
    resourceType: 'reportGenerationJob',
    resourceIdHash: HASH,
    productId: 'general-signature',
    attemptCount: 1,
    durationMs: 25
  };
}

describe('AdminAuditEvent privacy contract', () => {
  it('accepts only actor/action/resource/outcome and approved scalar metadata', () => {
    expect(validateAdminAuditEventForPersistence(buildAuditEvent())).toEqual(
      buildAuditEvent()
    );
  });

  it.each([
    ['name', '실명'],
    ['email', 'private@example.com'],
    ['birthDate', '1990-01-01'],
    ['birthTime', '08:30'],
    ['userQuestion', '개인적인 질문'],
    ['authToken', 'secret-user-token'],
    ['reportAccessToken', 'secret-report-token'],
    ['orderClaim', 'secret-order-claim'],
    ['portOneApiSecret', 'secret-portone-key'],
    ['password', 'secret-admin-password'],
    ['adminCredentialHash', 'secret-admin-hash'],
    ['reportData', 'private-report']
  ])('rejects sensitive audit metadata key %s', (field, sensitiveValue) => {
    expect(() =>
      validateAdminAuditEventForPersistence(
        buildAuditEvent({ metadata: { [field]: sensitiveValue } })
      )
    ).toThrowError(expect.objectContaining({ code: 'SENSITIVE_FIELD_FORBIDDEN' }));
  });

  it('rejects unapproved metadata even when its key is not explicitly sensitive', () => {
    expect(() =>
      validateAdminAuditEventForPersistence(
        buildAuditEvent({ metadata: { detail: 'arbitrary text' } })
      )
    ).toThrowError(
      expect.objectContaining({ code: 'ADMIN_AUDIT_METADATA_FIELD_FORBIDDEN' })
    );
  });

  it('rejects unknown top-level fields and free-form text in allowlisted metadata', () => {
    expect(() =>
      validateAdminAuditEventForPersistence({
        ...buildAuditEvent(),
        password: 'must-never-be-persisted'
      })
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_CONTRACT_UNKNOWN_FIELD' })
    );

    expect(() =>
      validateAdminAuditEventForPersistence(
        buildAuditEvent({
          metadata: {
            reasonCode: 'birthDate=1990-01-01 question=private',
            source: 'provider raw private@example.com'
          }
        })
      )
    ).toThrowError(expect.objectContaining({ code: 'UNSAFE_LOG_VALUE' }));
  });

  it('keeps audit events append-only', () => {
    expect(() =>
      validateAdminAuditEventForPersistence(
        buildAuditEvent({ updatedAt: '2026-07-22T00:00:01.000Z' })
      )
    ).toThrowError(expect.objectContaining({ code: 'ADMIN_AUDIT_EVENT_IMMUTABLE' }));
  });
});

describe('safe operational logging', () => {
  it('emits only an allowlisted structured event', () => {
    const info = vi.fn();
    const writer = { info, warn: vi.fn(), error: vi.fn() };
    const entry = writeSafeOperationalLog(writer, buildOperationalLog());

    expect(entry).toEqual({
      ...buildOperationalLog(),
      schemaVersion: 1
    });
    expect(info).toHaveBeenCalledWith(entry);
    expect(JSON.stringify(entry)).not.toMatch(/message|stack|token|claim|email|password/i);
  });

  it.each([
    ['name', '실명'],
    ['email', 'private@example.com'],
    ['birthDate', '1990-01-01'],
    ['birthTime', '08:30'],
    ['userQuestion', '개인적인 질문'],
    ['authToken', 'secret-user-token'],
    ['reportAccessToken', 'secret-report-token'],
    ['orderClaim', 'secret-order-claim'],
    ['portOneApiSecret', 'secret-portone-key'],
    ['password', 'secret-admin-password'],
    ['adminAccessToken', 'secret-admin-token'],
    ['providerResponse', 'raw-provider-error']
  ])('refuses operational log field %s', (field, sensitiveValue) => {
    const unsafe = {
      ...buildOperationalLog(),
      [field]: sensitiveValue
    } as unknown as SafeOperationalLogInput;

    expect(() => createSafeOperationalLog(unsafe)).toThrowError(
      expect.objectContaining({ code: 'SENSITIVE_FIELD_FORBIDDEN' })
    );
  });

  it('rejects nested sensitive data before it can reach a logger', () => {
    expect(() =>
      assertNoSensitiveKeys({ safe: { reportAccessToken: 'never-log-this' } })
    ).toThrowError(expect.objectContaining({ code: 'SENSITIVE_FIELD_FORBIDDEN' }));
  });

  it('rejects free-form text smuggled through an opaque identifier field', () => {
    expect(() =>
      createSafeOperationalLog({
        ...buildOperationalLog(),
        requestId: 'provider error private@example.com token=secret'
      })
    ).toThrowError(expect.objectContaining({ code: 'UNSAFE_LOG_VALUE' }));
  });

  it('reduces caught errors to name, stable code, and HTTP status', () => {
    const error = Object.assign(new Error('provider raw error with secret-token'), {
      code: 'PAYMENT_MISMATCH',
      status: 409,
      responseBody: { apiSecret: 'never-return' }
    });
    const diagnostics = getSafeErrorDiagnostics(error);
    const serialized = JSON.stringify(diagnostics);

    expect(diagnostics).toEqual({
      errorName: 'Error',
      code: 'PAYMENT_MISMATCH',
      status: 409
    });
    expect(serialized).not.toContain(error.message);
    expect(serialized).not.toMatch(/secret|responseBody|stack/i);
  });
});
