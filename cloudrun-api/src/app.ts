import type { RequestListener } from 'node:http';
import {
  generateGeminiSajuReport,
  type ReportRequestBody
} from '../../src/lib/server/geminiReportService.ts';
import { evaluateGeneralSignatureReleasePreflight } from '../../src/lib/server/releasePreflightService.ts';
import { loadConfig, type AppConfig } from './config/env.ts';
import { AdminService } from './domains/admin/adminService.ts';
import {
  ArchiveService,
  type ArchiveRepository
} from './domains/archives/archiveService.ts';
import { KakaoService } from './domains/auth/kakaoService.ts';
import { TokenService } from './domains/auth/tokenService.ts';
import { HealthService } from './domains/health/healthService.ts';
import {
  PaymentService,
  type PaymentLedgerRepository as PaymentLedgerServiceRepository
} from './domains/payments/paymentService.ts';
import { PortOneClient } from './domains/payments/portoneClient.ts';
import { createPaymentProvider } from './domains/payments/paymentProvider.ts';
import { ReportService } from './domains/reports/reportService.ts';
import { createRouter } from './http/router.ts';
import { createAuthMiddleware } from './middleware/auth.ts';
import { createCorsMiddleware } from './middleware/cors.ts';
import { createReportRateLimit } from './middleware/rateLimit.ts';
import { createAdminLoginRateLimit } from './middleware/adminLoginRateLimit.ts';
import { FirestoreRepository } from './repositories/firestoreRepository.ts';
import { PaymentLedgerRepository } from './repositories/paymentLedgerRepository.ts';
import { ReportArchiveRepository } from './repositories/reportArchiveRepository.ts';

export type CreateAppOptions = {
  config?: AppConfig;
  fetchImplementation?: typeof fetch;
  reportGenerator?: typeof generateGeminiSajuReport;
  releasePreflightEvaluator?: typeof evaluateGeneralSignatureReleasePreflight;
};

export function createApp(options: CreateAppOptions = {}): RequestListener {
  const config = options.config || loadConfig();
  const fetchImplementation = options.fetchImplementation || globalThis.fetch;
  const reportGenerator = options.reportGenerator || generateGeminiSajuReport;
  const releasePreflightEvaluator = options.releasePreflightEvaluator || evaluateGeneralSignatureReleasePreflight;

  const tokenService = new TokenService(config);
  const auth = createAuthMiddleware(config, tokenService);
  const kakaoService = new KakaoService(config, tokenService, fetchImplementation);
  const portOneClient = new PortOneClient(config.portOne, fetchImplementation);
  const paymentProvider = createPaymentProvider(config, portOneClient);
  const firestoreRepository = new FirestoreRepository(config.firestore, fetchImplementation);
  const paymentLedgerRepository = new PaymentLedgerRepository(
    firestoreRepository,
    config.portOne.ledgerCollection
  );
  const reportArchiveRepository = new ReportArchiveRepository(
    firestoreRepository,
    config.firestore.archiveCollection
  );

  const paymentLedgerAdapter: PaymentLedgerServiceRepository = {
    createPaymentLedger(record) {
      return paymentLedgerRepository.create(record);
    },
    getPaymentLedger(documentId) {
      return paymentLedgerRepository.getByDocumentId(documentId);
    },
    listPaymentLedgersByUserId(userId, limit) {
      return paymentLedgerRepository.listByUser(userId, limit);
    }
  };

  const archiveRepositoryAdapter: ArchiveRepository = {
    async upsert(userId, entry, entryJson) {
      void entryJson;
      await reportArchiveRepository.saveForUser(userId, entry);
    },
    list(whereUserId) {
      return whereUserId
        ? reportArchiveRepository.listForUser(whereUserId)
        : reportArchiveRepository.listAll();
    }
  };

  const paymentService = new PaymentService({
    config: {
      storeId: config.portOne.storeId,
      orderClaimTtlMs: config.report.orderClaimTtlMs,
      reportAccessTokenTtlMs: config.report.accessTokenTtlMs
    },
    paymentProvider,
    ledgerRepository: paymentLedgerAdapter,
    tokenService
  });
  const reportService = new ReportService(
    config,
    paymentLedgerRepository,
    (body) => reportGenerator(body as ReportRequestBody)
  );
  const archiveService = new ArchiveService(
    config,
    archiveRepositoryAdapter,
    tokenService
  );
  const adminService = new AdminService(config, tokenService);
  const healthService = new HealthService(config);
  const applyCors = createCorsMiddleware(config);
  const enforceReportRateLimit = createReportRateLimit(config);
  const adminLoginRateLimit = createAdminLoginRateLimit(config);

  return createRouter({
    applyCors,
    enforceReportRateLimit,
    adminLoginRateLimit,
    auth,
    health: healthService,
    reports: reportService,
    releasePreflight: {
      evaluate: (body) => releasePreflightEvaluator(body as ReportRequestBody)
    },
    payments: {
      createOrder: (user, body) => paymentService.createOrderIntent(user, body),
      confirm: (user, body) => paymentService.confirmPayment(user, body),
      listEntitlements: (user) => paymentService.queryEntitlements(user),
      renew: (user, body) => paymentService.renewEntitlement(user, body)
    },
    kakao: kakaoService,
    archives: archiveService,
    admin: adminService
  });
}
