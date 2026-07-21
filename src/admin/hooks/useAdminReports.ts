import { useCallback, useEffect, useRef, useState } from 'react';
import { readStoredAuthUser } from '../../features/auth';
import {
  readReportArchiveEntries,
  type ReportArchiveEntry
} from '../../lib/reportArchive';
import {
  AdminApiError,
  fetchAdminReports,
  isAdminSessionError
} from '../api/adminClient';
import { normalizeAdminReportEntries, selectVisibleAdminReports } from '../data/adminReports';

type UseAdminReportsOptions = {
  adminAccessToken: string;
  isUnlocked: boolean;
  bootstrapReports?: ReportArchiveEntry[];
  onSessionExpired: () => void;
};

const SAFE_REPORTS_ERROR = '관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';

export function useAdminReports({
  adminAccessToken,
  isUnlocked,
  bootstrapReports,
  onSessionExpired
}: UseAdminReportsOptions) {
  const ownerId = readStoredAuthUser()?.id;
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now());
  const [reportsError, setReportsError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reports, setReports] = useState<ReportArchiveEntry[]>(() =>
    adminAccessToken ? [] : readReportArchiveEntries(readStoredAuthUser()?.id)
  );
  const requestGeneration = useRef(0);
  const currentToken = useRef(adminAccessToken);
  const verifiedToken = useRef('');
  currentToken.current = adminAccessToken;

  const readLocalReports = useCallback(
    () => readReportArchiveEntries(ownerId),
    [ownerId]
  );

  const isCurrentRequest = useCallback((generation: number, token: string) => (
    requestGeneration.current === generation && currentToken.current === token
  ), []);

  const handleLoadError = useCallback((error: unknown, generation: number, token: string) => {
    if (!isCurrentRequest(generation, token)) {
      return;
    }

    setReportsError(error instanceof AdminApiError ? error.message : SAFE_REPORTS_ERROR);
    if (isAdminSessionError(error)) {
      onSessionExpired();
    }
  }, [isCurrentRequest, onSessionExpired]);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const token = adminAccessToken;

    if (!isUnlocked) {
      setIsRefreshing(false);
      return;
    }

    if (!token) {
      verifiedToken.current = '';
      setReports(readLocalReports());
      setReportsError('');
      setLastUpdatedAt(Date.now());
      return;
    }

    if (bootstrapReports) {
      verifiedToken.current = token;
      setReports(normalizeAdminReportEntries(bootstrapReports));
      setReportsError('');
      setLastUpdatedAt(Date.now());
      return;
    }

    if (verifiedToken.current !== token) {
      setReports([]);
    }

    setIsRefreshing(true);
    void fetchAdminReports(token)
      .then((remoteReports) => {
        if (!isCurrentRequest(generation, token)) {
          return;
        }

        verifiedToken.current = token;
        setReports(normalizeAdminReportEntries(remoteReports));
        setReportsError('');
        setLastUpdatedAt(Date.now());
      })
      .catch((error) => {
        handleLoadError(error, generation, token);
      })
      .finally(() => {
        if (isCurrentRequest(generation, token)) {
          setIsRefreshing(false);
        }
      });

    return () => {
      if (requestGeneration.current === generation) {
        requestGeneration.current += 1;
      }
    };
  }, [adminAccessToken, bootstrapReports, handleLoadError, isCurrentRequest, isUnlocked, readLocalReports]);

  const refresh = useCallback(() => {
    if (!isUnlocked) {
      return;
    }

    const token = adminAccessToken;
    const generation = ++requestGeneration.current;
    setReportsError('');

    if (!token) {
      setReports(readLocalReports());
      setLastUpdatedAt(Date.now());
      return;
    }

    setIsRefreshing(true);
    void fetchAdminReports(token)
      .then((remoteReports) => {
        if (!isCurrentRequest(generation, token)) {
          return;
        }

        verifiedToken.current = token;
        setReports(normalizeAdminReportEntries(remoteReports));
        setReportsError('');
        setLastUpdatedAt(Date.now());
      })
      .catch((error) => {
        handleLoadError(error, generation, token);
      })
      .finally(() => {
        if (isCurrentRequest(generation, token)) {
          setIsRefreshing(false);
        }
      });
  }, [adminAccessToken, handleLoadError, isCurrentRequest, isUnlocked, readLocalReports]);

  return {
    reports: selectVisibleAdminReports(reports, adminAccessToken, verifiedToken.current),
    reportsError,
    isRefreshing,
    lastUpdatedAt,
    refresh
  };
}
