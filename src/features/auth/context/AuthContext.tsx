import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import { completeAuthUser, createDemoUser } from '../authUser';
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
