import type { AppConfig } from '../../config/env.ts';
import { API_ERROR_CODE } from '../../contracts/api.ts';
import { KakaoAuthError, PaymentRequestError } from '../../contracts/errors.ts';
import type { TokenService } from './tokenService.ts';

type FetchImplementation = typeof fetch;

type KakaoUserPayload = {
  id?: unknown;
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
};

function getRequiredString(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new PaymentRequestError(400, `${key} 값이 올바르지 않습니다.`);
  }

  return value.trim();
}

export class KakaoService {
  constructor(
    private readonly config: AppConfig,
    private readonly tokenService: TokenService,
    private readonly fetchImplementation: FetchImplementation = fetch
  ) {}

  async exchangeKakaoLogin(body: Record<string, unknown>) {
    const clientId = this.config.kakao.restApiKey.trim();
    const clientSecret = this.config.kakao.clientSecret.trim();

    if (!clientId) {
      throw new KakaoAuthError(500, '카카오 REST API 키가 서버에 설정되지 않았습니다.');
    }

    this.tokenService.ensureSecret('user');

    const code = getRequiredString(body, 'code');
    const redirectUri = getRequiredString(body, 'redirectUri');
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code
    });

    if (clientSecret) {
      tokenParams.set('client_secret', clientSecret);
    }

    const tokenResponse = await this.fetchImplementation(this.config.kakao.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
      },
      body: tokenParams
    });
    const tokenPayload = (await tokenResponse.json().catch(() => null)) as Record<string, unknown> | null;

    if (!tokenResponse.ok || typeof tokenPayload?.access_token !== 'string') {
      throw new KakaoAuthError(
        tokenResponse.status || 502,
        '카카오 로그인 인증 서비스를 현재 사용할 수 없습니다.',
        {
          code: API_ERROR_CODE.AUTH_PROVIDER_FAILED,
          exposeMessage: false
        }
      );
    }

    const userResponse = await this.fetchImplementation(this.config.kakao.userEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`
      }
    });
    const userPayload = (await userResponse.json().catch(() => null)) as KakaoUserPayload | null;

    if (!userResponse.ok || !userPayload) {
      throw new KakaoAuthError(
        userResponse.status || 502,
        '카카오 사용자 확인 서비스를 현재 사용할 수 없습니다.',
        {
          code: API_ERROR_CODE.AUTH_PROVIDER_FAILED,
          exposeMessage: false
        }
      );
    }

    const user = {
      id: String(userPayload.id || ''),
      nickname: userPayload.properties?.nickname || userPayload.kakao_account?.profile?.nickname || '카카오 회원',
      email: userPayload.kakao_account?.email,
      avatar: userPayload.properties?.profile_image || userPayload.kakao_account?.profile?.profile_image_url
    };

    return {
      user,
      provider: 'kakao' as const,
      authToken: this.tokenService.createAuthAccessToken(user),
      connectedAt: new Date().toISOString()
    };
  }

  exchange(body: Record<string, unknown>) {
    return this.exchangeKakaoLogin(body);
  }
}

export function createKakaoService(
  config: AppConfig,
  tokenService: TokenService,
  fetchImplementation: FetchImplementation = fetch
) {
  return new KakaoService(config, tokenService, fetchImplementation);
}
