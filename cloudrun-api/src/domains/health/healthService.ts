import type { AppConfig } from '../../config/env.ts';

const SERVICE_NAME = 'unwoldang-cloudrun-api' as const;

type HealthServiceOptions = Readonly<{
  now?: () => number;
}>;

export class HealthService {
  private readonly now: () => number;

  constructor(
    private readonly config: AppConfig,
    options: HealthServiceOptions = {}
  ) {
    this.now = options.now || Date.now;
  }

  private timestamp() {
    return new Date(this.now()).toISOString();
  }

  private isReady() {
    const reportSecretConfigured = Boolean(this.config.auth.reportAccessSecret);
    const userSecretConfigured = Boolean(this.config.auth.userAccessSecret);
    const firestoreConfigured =
      this.config.firestore.enabled && Boolean(this.config.firestore.projectId);
    const paymentConfigured = Boolean(
      this.config.portOne.apiSecret && this.config.portOne.storeId
    );

    return (
      reportSecretConfigured &&
      userSecretConfigured &&
      firestoreConfigured &&
      paymentConfigured
    );
  }

  private isDegraded() {
    const adminConfigured = Boolean(
      this.config.auth.adminAccessSecret && this.config.auth.adminCredentialHash
    );
    const kakaoConfigured = Boolean(this.config.kakao.restApiKey);

    return !this.config.gemini.configured || !adminConfigured || !kakaoConfigured;
  }

  getSummaryStatus() {
    const ready = this.isReady();

    return {
      ok: ready,
      service: SERVICE_NAME,
      status: ready ? (this.isDegraded() ? 'degraded' : 'ok') : 'not_ready',
      timestamp: this.timestamp()
    } as const;
  }

  getLivenessStatus() {
    return {
      ok: true,
      live: true,
      service: SERVICE_NAME,
      status: 'live',
      timestamp: this.timestamp()
    } as const;
  }

  getReadinessStatus() {
    const ready = this.isReady();

    return {
      ok: ready,
      ready,
      service: SERVICE_NAME,
      status: ready ? 'ready' : 'not_ready',
      timestamp: this.timestamp()
    } as const;
  }

  getStatus() {
    return this.getSummaryStatus();
  }
}
