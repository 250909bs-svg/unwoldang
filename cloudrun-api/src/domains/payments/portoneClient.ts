import type { AppConfig } from '../../config/env.ts';
import { PaymentRequestError } from '../../contracts/errors.ts';

export type PortOnePayment = Record<string, unknown>;

export type PortOneClientConfig = Pick<AppConfig['portOne'], 'apiBaseUrl' | 'apiSecret'>;

export type FetchImplementation = typeof fetch;

export interface PortOnePaymentClient {
  fetchPayment(paymentId: string): Promise<PortOnePayment>;
}

function getPortOneErrorMessage(
  parsed: Record<string, unknown> | null,
  fallback: string
) {
  return (
    (typeof parsed?.message === 'string' && parsed.message) ||
    (typeof parsed?.code === 'string' && parsed.code) ||
    fallback
  );
}

function getPortOnePaymentPayload(parsed: Record<string, unknown> | null) {
  if (!parsed) {
    return null;
  }

  if (typeof parsed.payment === 'object' && parsed.payment) {
    return parsed.payment as PortOnePayment;
  }

  return parsed;
}

export class PortOneClient implements PortOnePaymentClient {
  private readonly apiBaseUrl: string;
  private readonly apiSecret: string;

  constructor(
    config: PortOneClientConfig,
    private readonly fetchImpl: FetchImplementation = globalThis.fetch
  ) {
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, '');
    this.apiSecret = config.apiSecret.trim();
  }

  async requestAccessToken() {
    if (!this.apiSecret) {
      throw new PaymentRequestError(500, 'PORTONE_API_SECRET이 서버에 설정되지 않았습니다.');
    }

    const response = await this.fetchImpl(`${this.apiBaseUrl}/login/api-secret`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ apiSecret: this.apiSecret })
    });
    const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok || typeof parsed?.accessToken !== 'string') {
      throw new PaymentRequestError(
        response.status || 502,
        getPortOneErrorMessage(parsed, 'PortOne access token 발급에 실패했습니다.')
      );
    }

    return parsed.accessToken;
  }

  async fetchPayment(paymentId: string) {
    const accessToken = await this.requestAccessToken();
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      throw new PaymentRequestError(
        response.status,
        getPortOneErrorMessage(parsed, 'PortOne 결제 내역 조회에 실패했습니다.')
      );
    }

    const payment = getPortOnePaymentPayload(parsed);

    if (!payment) {
      throw new PaymentRequestError(502, 'PortOne 결제 내역 응답이 비어 있습니다.');
    }

    return payment;
  }
}

export function createPortOneClient(
  config: PortOneClientConfig,
  fetchImpl: FetchImplementation = globalThis.fetch
) {
  return new PortOneClient(config, fetchImpl);
}
