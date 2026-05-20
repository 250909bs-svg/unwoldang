import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import {
  createDemoUser,
  readStoredAuthUser,
  writeStoredAuthUser,
  type AuthProviderType,
  type AuthUser
} from '../lib/auth';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loginDemo: (nickname?: string) => AuthUser;
  completeLogin: (payload: Partial<AuthUser> & { nickname?: string; provider?: AuthProviderType }) => AuthUser;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredAuthUser());

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
      completeLogin: (payload) =>
        applyUser({
          id: payload.id || `user-${Date.now()}`,
          nickname: payload.nickname || '운월당 회원',
          email: payload.email,
          avatar: payload.avatar,
          provider: payload.provider || 'kakao',
          connectedAt: payload.connectedAt || new Date().toISOString()
        }),
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
