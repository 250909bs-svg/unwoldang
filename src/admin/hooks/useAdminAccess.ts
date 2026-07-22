import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ReportArchiveEntry } from '../../lib/reportArchive';
import {
  AdminApiError,
  fetchAdminReports,
  isAdminSessionError,
  loginAdmin,
  resolveAdminLoginEndpoint
} from '../api/adminClient';
import {
  clearAdminSession,
  ENABLE_CLIENT_ADMIN,
  getAdminAccessTokenExpiresAt,
  hashAdminCredential,
  isLocalAdminHost,
  LOCAL_ADMIN_CREDENTIAL_HASH,
  readAdminSessionState,
  writeAdminAccessSession,
  writeLocalAdminSession
} from '../session/adminSession';

const SESSION_EXPIRED_MESSAGE = '관리자 세션이 만료되었습니다. 다시 로그인해 주세요.';
const SESSION_VERIFICATION_MESSAGE = '저장된 관리자 세션을 확인하지 못했습니다. 다시 로그인해 주세요.';

export function useAdminAccess() {
  const [initialSession] = useState(readAdminSessionState);
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [accessError, setAccessError] = useState('');
  const [adminAccessToken, setAdminAccessToken] = useState(initialSession.adminAccessToken);
  const [isUnlocked, setIsUnlocked] = useState(initialSession.isUnlocked);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(initialSession.requiresServerVerification);
  const [bootstrapReports, setBootstrapReports] = useState<ReportArchiveEntry[] | undefined>();
  const adminLoginEndpoint = resolveAdminLoginEndpoint();
  const isLocalOnlyMode = isLocalAdminHost();
  const isAdminAvailable = isLocalOnlyMode || ENABLE_CLIENT_ADMIN || Boolean(adminLoginEndpoint);

  const clearAccess = useCallback((message = '') => {
    clearAdminSession();
    setAdminAccessToken('');
    setIsUnlocked(false);
    setIsVerifyingSession(false);
    setBootstrapReports(undefined);
    setAdminPassword('');
    setAccessError(message);
  }, []);

  const lockAdmin = useCallback(() => {
    clearAccess();
  }, [clearAccess]);

  const handleSessionExpired = useCallback(() => {
    clearAccess(SESSION_EXPIRED_MESSAGE);
  }, [clearAccess]);

  useEffect(() => {
    if (!initialSession.requiresServerVerification || !initialSession.adminAccessToken) {
      return;
    }

    let isCancelled = false;

    void fetchAdminReports(initialSession.adminAccessToken)
      .then((entries) => {
        if (isCancelled) {
          return;
        }

        setBootstrapReports(entries);
        setIsUnlocked(true);
        setAccessError('');
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        if (isAdminSessionError(error)) {
          clearAccess(SESSION_EXPIRED_MESSAGE);
          return;
        }

        setIsUnlocked(false);
        setBootstrapReports(undefined);
        setAccessError(SESSION_VERIFICATION_MESSAGE);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsVerifyingSession(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [clearAccess, initialSession]);

  useEffect(() => {
    if (!isUnlocked || !adminAccessToken) {
      return;
    }

    const expiresAt = getAdminAccessTokenExpiresAt(adminAccessToken);
    if (expiresAt === undefined) {
      return;
    }

    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      handleSessionExpired();
      return;
    }

    const timeoutId = window.setTimeout(handleSessionExpired, Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timeoutId);
  }, [adminAccessToken, handleSessionExpired, isUnlocked]);

  const unlock = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setIsCheckingAccess(true);

    try {
      if (adminLoginEndpoint) {
        const payload = await loginAdmin(adminId, adminPassword, adminLoginEndpoint);

        writeAdminAccessSession(payload.adminAccessToken);
        setAdminAccessToken(payload.adminAccessToken);
        setBootstrapReports(undefined);
        setAdminPassword('');
        setIsUnlocked(true);
        setAccessError('');
        return;
      }

      const credentialHash = await hashAdminCredential(adminId, adminPassword);

      if (credentialHash === LOCAL_ADMIN_CREDENTIAL_HASH) {
        writeLocalAdminSession();
        setAdminPassword('');
        setIsUnlocked(true);
        setAccessError('');
        return;
      }

      setAccessError('아이디 또는 비밀번호가 올바르지 않습니다.');
    } catch (error) {
      setAccessError(error instanceof AdminApiError ? error.message : '관리자 로그인에 실패했습니다.');
    } finally {
      setIsCheckingAccess(false);
    }
  };

  return {
    adminId,
    setAdminId,
    adminPassword,
    setAdminPassword,
    accessError,
    adminAccessToken,
    isUnlocked,
    isCheckingAccess,
    isVerifyingSession,
    bootstrapReports,
    isLocalOnlyMode,
    isAdminAvailable,
    unlock,
    lockAdmin,
    handleSessionExpired
  };
}
