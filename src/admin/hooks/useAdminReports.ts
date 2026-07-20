import { useCallback, useEffect, useState } from 'react';
import { readStoredAuthUser } from '../../lib/auth';
import {
  mergeReportArchiveEntries,
  readReportArchiveEntries,
  type ReportArchiveEntry
} from '../../lib/reportArchive';
import { fetchAdminReports } from '../api/adminClient';

type UseAdminReportsOptions = {
  adminAccessToken: string;
  isUnlocked: boolean;
};

export function useAdminReports({
  adminAccessToken,
  isUnlocked
}: UseAdminReportsOptions) {
  const ownerId = readStoredAuthUser()?.id;
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now());
  const [reports, setReports] = useState<ReportArchiveEntry[]>(() =>
    readReportArchiveEntries(readStoredAuthUser()?.id)
  );
  const readLocalReports = useCallback(
    () => readReportArchiveEntries(ownerId),
    [ownerId]
  );

  useEffect(() => {
    let isCancelled = false;

    const loadRemoteReports = async () => {
      if (!isUnlocked || !adminAccessToken) {
        return;
      }

      try {
        const remoteReports = await fetchAdminReports(adminAccessToken);

        if (isCancelled) {
          return;
        }

        setReports(mergeReportArchiveEntries(remoteReports, readLocalReports()));
      } catch {
        // Preserve the current local archive when the server admin API is unavailable.
      }
    };

    void loadRemoteReports();

    return () => {
      isCancelled = true;
    };
  }, [adminAccessToken, isUnlocked, readLocalReports]);

  const refresh = useCallback(() => {
    setReports(readLocalReports());
    setLastUpdatedAt(Date.now());

    if (adminAccessToken) {
      void fetchAdminReports(adminAccessToken)
        .then((remoteReports) => {
          setReports(mergeReportArchiveEntries(remoteReports, readLocalReports()));
          setLastUpdatedAt(Date.now());
        })
        .catch(() => {
          setReports(readLocalReports());
        });
    }
  }, [adminAccessToken, readLocalReports]);

  return {
    reports,
    lastUpdatedAt,
    refresh
  };
}
