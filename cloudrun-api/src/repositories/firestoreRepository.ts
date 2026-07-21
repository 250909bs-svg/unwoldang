import type { AppConfig } from '../config/env.ts';
import { ReportRequestError } from '../contracts/errors.ts';

const GOOGLE_METADATA_TOKEN_ENDPOINT =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const METADATA_REQUEST_TIMEOUT_MS = 3000;
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

export type FirestoreConfig = AppConfig['firestore'];

export type FirestoreFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type FirestoreRequestInit = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

type AccessTokenCache = {
  token: string;
  expiresAt: number;
};

type MetadataTokenPayload = {
  access_token?: string;
  expires_in?: number;
};

export class FirestoreRepository {
  private accessTokenCache: AccessTokenCache | null = null;

  constructor(
    private readonly config: FirestoreConfig,
    private readonly fetchImpl: FirestoreFetch = fetch
  ) {}

  private assertEnabled() {
    if (!this.config.enabled || !this.config.projectId) {
      throw new ReportRequestError(503, 'Server archive storage is not configured.');
    }

    return this.config.projectId;
  }

  private async getAccessToken() {
    if (this.config.accessToken) {
      return this.config.accessToken;
    }

    const now = Date.now();

    if (
      this.accessTokenCache &&
      this.accessTokenCache.expiresAt > now + ACCESS_TOKEN_REFRESH_BUFFER_MS
    ) {
      return this.accessTokenCache.token;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), METADATA_REQUEST_TIMEOUT_MS);

    try {
      const response = await this.fetchImpl(GOOGLE_METADATA_TOKEN_ENDPOINT, {
        headers: {
          'Metadata-Flavor': 'Google'
        },
        signal: controller.signal
      });
      const payload = (await response.json().catch(() => null)) as MetadataTokenPayload | null;

      if (!response.ok || !payload?.access_token) {
        throw new ReportRequestError(503, 'Firestore access token could not be issued.');
      }

      this.accessTokenCache = {
        token: payload.access_token,
        expiresAt:
          now + Math.max(60, Number(payload.expires_in || 3600) - 60) * 1000
      };

      return this.accessTokenCache.token;
    } finally {
      clearTimeout(timeout);
    }
  }

  async request<T = unknown>(path: string, init: FirestoreRequestInit = {}) {
    const projectId = this.assertEnabled();
    const accessToken = await this.getAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(this.config.databaseId)}/documents${path}`;
    const response = await this.fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    });
    const payload = (await response.json().catch(() => null)) as
      | (T & { error?: { message?: string }; message?: string })
      | null;

    if (!response.ok) {
      const message =
        payload?.error?.message || payload?.message || 'Firestore request failed.';
      throw new ReportRequestError(response.status || 502, message);
    }

    return payload as T;
  }
}
