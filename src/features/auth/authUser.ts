import type { AuthUser } from './model';

export const createDemoUser = (nickname = '운월당 회원'): AuthUser => ({
  id: `demo-${Date.now()}`,
  nickname,
  provider: 'demo',
  connectedAt: new Date().toISOString()
});

export const completeAuthUser = (
  payload: Partial<AuthUser> & { nickname?: string; provider?: AuthUser['provider'] }
): AuthUser => ({
  id: payload.id || `user-${Date.now()}`,
  nickname: payload.nickname || '운월당 회원',
  email: payload.email,
  avatar: payload.avatar,
  provider: payload.provider || 'kakao',
  authToken: payload.authToken,
  connectedAt: payload.connectedAt || new Date().toISOString()
});
