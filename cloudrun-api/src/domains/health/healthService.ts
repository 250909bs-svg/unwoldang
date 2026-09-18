import type { AppConfig } from '../../config/env.ts';
import {
  LOVE_REUNION_PROSE_TEMPERATURE,
  PREMIUM_SAJU_PROMPT_VERSION,
  PREMIUM_SAJU_REPORT_MODE,
  STRICT_ECHO_PROSE_TEMPERATURE,
  proseGuardModeForServiceId
} from '../../../../src/lib/saju/promptRelease.ts';

export class HealthService {
  constructor(private readonly config: AppConfig) {}

  getStatus() {
    const reportSecretConfigured = Boolean(this.config.auth.reportAccessSecret);
    const userSecretConfigured = Boolean(this.config.auth.userAccessSecret);
    const firestoreConfigured = this.config.firestore.enabled && Boolean(this.config.firestore.projectId);
    const paymentConfigured = this.config.payment.configured;
    const readyForReportGeneration = reportSecretConfigured && firestoreConfigured;
    const readyForPaymentConfirmation = readyForReportGeneration && userSecretConfigured && paymentConfigured;

    return {
      ok: true,
      service: 'unwoldang-cloudrun-api',
      provider: 'gemini',
      paymentProvider: this.config.payment.provider,
      providerConfigured: this.config.gemini.configured,
      readyForAiEnhancement: this.config.gemini.configured,
      readyForReportGeneration,
      readyForPaymentConfirmation,
      kasiLunarConfigured: this.config.kasi.lunarConfigured,
      kasiSpecialDayConfigured: this.config.kasi.specialDayConfigured,
      readyForLunarReportGeneration: readyForReportGeneration && this.config.kasi.lunarConfigured,
      readyForSolarTermDateVerification: this.config.kasi.specialDayConfigured,
      model: this.config.gemini.model,
      /*
       * 배포 확인용 지문.
       *
       * 배포 후 로그를 보는 절차의 첫 단계는 "새 코드가 실제로 떠 있는가" 인데,
       * 그것을 요청 없이 확인할 지점이 없었다. 롤백(ADR §6-1/§6-2)을 실행했을 때
       * 그것이 실제로 배포됐는지 확인할 유일한 저비용 지점이기도 하다.
       */
      promptVersion: PREMIUM_SAJU_PROMPT_VERSION,
      reportMode: PREMIUM_SAJU_REPORT_MODE,
      proseMode: {
        'love-reunion': proseGuardModeForServiceId('love-reunion'),
        default: proseGuardModeForServiceId('general-signature')
      },
      proseTemperature: {
        'love-reunion': LOVE_REUNION_PROSE_TEMPERATURE,
        default: STRICT_ECHO_PROSE_TEMPERATURE
      },
      timestamp: new Date().toISOString()
    };
  }
}
