import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import { completeAuthUser, createDemoUser } from '../authUser';
import { createLocalPreviewUser, isLocalPreviewAuthEnabled } from '../localPreviewAuth';
import type { AuthProviderType, AuthUser } from '../model';
import { readStoredAuthUser, writeStoredAuthUser } from '../storage';

export type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loginDemo: (nickname?: string) => AuthUser;
  completeLogin: (payload: Partial<AuthUser> & { nickname?: string; provider?: AuthProviderType }) => AuthUser;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 저장된 세션이 없고 루프백 개발 서버일 때만 미리보기 사용자를 만들어 둔다.
 *
 * 초기화 단계에서 만들어야 한다. effect 로 미루면 첫 렌더가 비로그인 상태로 지나가고,
 * 그 사이에 Form·Checkout 의 가드가 /login 으로 돌려보낸다.
 */
function resolveInitialUser(): AuthUser | null {
  const stored = readStoredAuthUser();

  if (stored || !isLocalPreviewAuthEnabled()) {
    return stored;
  }

  const seeded = createLocalPreviewUser(new Date().toISOString());
  writeStoredAuthUser(seeded);

  return seeded;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(resolveInitialUser);

  const value = useMemo<AuthContextValue>(() => {
    const applyUser = (nextUser: AuthUser) => {
      setUser(nextUser);
      writeStoredAuthUser(nextUser);
      return nextUser;
    };

    return {
      user,
      isAuthenticated: Boolean(user),
      loginDemo: (nickname = '운월당 회원') => applyUser(createDemoUser(nickname)),
      completeLogin: (payload) => applyUser(completeAuthUser(payload)),
      logout: () => {
        setUser(null);
        writeStoredAuthUser(null);
      }
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
