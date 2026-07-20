import { useState, type FormEvent } from 'react';
import { loginAdmin, resolveAdminLoginEndpoint } from '../api/adminClient';
import {
  clearAdminSession,
  ENABLE_CLIENT_ADMIN,
  hashAdminCredential,
  isLocalAdminHost,
  LOCAL_ADMIN_CREDENTIAL_HASH,
  readAdminSessionState,
  writeAdminAccessSession,
  writeLocalAdminSession
} from '../session/adminSession';

export function useAdminAccess() {
  const initialSession = readAdminSessionState();
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [accessError, setAccessError] = useState('');
  const [adminAccessToken, setAdminAccessToken] = useState(initialSession.adminAccessToken);
  const [isUnlocked, setIsUnlocked] = useState(initialSession.isUnlocked);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const adminLoginEndpoint = resolveAdminLoginEndpoint();
  const isLocalOnlyMode = isLocalAdminHost();
  const isAdminAvailable = isLocalOnlyMode || ENABLE_CLIENT_ADMIN || Boolean(adminLoginEndpoint);

  const unlock = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setIsCheckingAccess(true);

    try {
      if (adminLoginEndpoint) {
        const payload = await loginAdmin(adminId, adminPassword, adminLoginEndpoint);

        writeAdminAccessSession(payload.adminAccessToken);
        setAdminAccessToken(payload.adminAccessToken);
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

      setAccessError('아이디 또는 비밀번호가 맞지 않습니다.');
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : '관리자 로그인에 실패했습니다.');
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const lockAdmin = () => {
    clearAdminSession();
    setAdminAccessToken('');
    setIsUnlocked(false);
    setAdminPassword('');
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
    isLocalOnlyMode,
    isAdminAvailable,
    unlock,
    lockAdmin
  };
}
