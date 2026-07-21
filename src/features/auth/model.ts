export type AuthProviderType = 'kakao' | 'demo';

export interface AuthUser {
  id: string;
  nickname: string;
  email?: string;
  avatar?: string;
  provider: AuthProviderType;
  authToken?: string;
  connectedAt: string;
}

export type AuthStatePayload = {
  provider: 'kakao';
  returnTo: string;
  issuedAt: number;
};
