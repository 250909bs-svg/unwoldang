import type { AppConfig } from '../../config/env.ts';

export class HealthService {
  constructor(private readonly config: AppConfig) {}

  getStatus() {
    const reportSecretConfigured = Boolean(this.config.auth.reportAccessSecret);
    const userSecretConfigured = Boolean(this.config.auth.userAccessSecret);
    const firestoreConfigured = this.config.firestore.enabled && Boolean(this.config.firestore.projectId);
    const paymentConfigured = Boolean(this.config.portOne.apiSecret && this.config.portOne.storeId);

    return {
      ok: true,
      service: 'unwoldang-cloudrun-api',
      provider: 'gemini',
      providerConfigured: this.config.gemini.configured,
      readyForAiEnhancement: this.config.gemini.configured,
      readyForReportGeneration: reportSecretConfigured && firestoreConfigured,
      readyForPaymentConfirmation:
        reportSecretConfigured && userSecretConfigured && firestoreConfigured && paymentConfigured,
      model: this.config.gemini.model,
      timestamp: new Date().toISOString()
    };
  }
}
