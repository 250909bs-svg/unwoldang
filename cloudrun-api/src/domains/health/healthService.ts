import type { AppConfig } from '../../config/env.ts';

export class HealthService {
  constructor(private readonly config: AppConfig) {}

  getStatus() {
    const reportSecretConfigured = Boolean(this.config.auth.reportAccessSecret);
    const userSecretConfigured = Boolean(this.config.auth.userAccessSecret);
    const firestoreConfigured = this.config.firestore.enabled && Boolean(this.config.firestore.projectId);
    const paymentConfigured = Boolean(this.config.portOne.apiSecret && this.config.portOne.storeId);
    const readyForReportGeneration = reportSecretConfigured && firestoreConfigured;
    const readyForPaymentConfirmation = readyForReportGeneration && userSecretConfigured && paymentConfigured;

    return {
      ok: true,
      service: 'unwoldang-cloudrun-api',
      provider: 'gemini',
      providerConfigured: this.config.gemini.configured,
      readyForAiEnhancement: this.config.gemini.configured,
      readyForReportGeneration,
      readyForPaymentConfirmation,
      kasiLunarConfigured: this.config.kasi.lunarConfigured,
      kasiSpecialDayConfigured: this.config.kasi.specialDayConfigured,
      readyForLunarReportGeneration: readyForReportGeneration && this.config.kasi.lunarConfigured,
      readyForSolarTermDateVerification: this.config.kasi.specialDayConfigured,
      model: this.config.gemini.model,
      timestamp: new Date().toISOString()
    };
  }
}
