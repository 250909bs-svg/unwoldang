import { Archive, ChevronDown, ChevronRight, LogOut, ScrollText, Sparkles } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { findServiceById } from '../api/mockData';
import LoveReadingCardPicture from '../components/LoveReadingCardPicture';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import {
  beginKakaoLogin,
  fetchPaymentEntitlements,
  readPendingPayment,
  renewPaymentEntitlement,
  savePendingPayment,
  type PaymentEntitlement
} from '../lib/auth';
import {
  fetchRemoteReportArchiveEntries,
  mergeReportArchiveEntries,
  readReportArchiveEntries,
  writeReportArchiveEntries,
  type ReportArchiveEntry
} from '../lib/reportArchive';
import { getPortOneConfirmEndpoint } from '../lib/runtimeConfig';

type ReplayPromo = {
  title: string;
  subtitle: string;
  image: string;
  to: string;
  tone: string;
};

const replayPromos: ReplayPromo[] = [
  {
    title: '정통사주',
    subtitle: '나의 운명 전체 흐름은?',
    image: '/intake-night-blue.png',
    to: '/form/general-signature',
    tone: '#1f4f98'
  },
  {
    title: '팩폭 연애운',
    subtitle: '반복되는 내 연애 패턴은?',
    image: '/home-love-reading-card.png',
    to: '/detail/love-reading',
    tone: '#a80e30'
  },
  {
    title: '재회비책',
    subtitle: '다시 이어질 가능성은?',
    image: '/intake-lantern-night.png',
    to: '/form/love-reunion',
    tone: '#6d4de8'
  },
  {
    title: '올해의 운세',
    subtitle: '2026년 기회와 조심할 시기',
    image: '/intake-sunlight-girl.png',
    to: '/form/life-flow',
    tone: '#6da9c8'
  },
  {
    title: '사주궁합',
    subtitle: '우리 둘의 속도와 생활 궁합',
    image: '/intake-beauty-red.png',
    to: '/form/match-couple',
    tone: '#d62f3f'
  },
  {
    title: '결혼운',
    subtitle: '결혼 시기와 현실 기준',
    image: '/intake-blossom-girl.png',
    to: '/form/marriage-blueprint',
    tone: '#bc6a53'
  }
];

function formatArchiveDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '날짜 미상';
  }

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function MyReplayHeader() {
  return <MobileTopBar title="보관함" backTo="/" backLabel="홈" />;
}

function LoggedOutReplay() {
  const [loginError, setLoginError] = useState('');

  const handleKakaoLogin = () => {
    const login = beginKakaoLogin('/my');

    if (!login.ok) {
      setLoginError(login.message);
      return;
    }

    window.location.href = login.url;
  };

  return (
    <main className="my-replay-page my-replay-login-page">
      <MyReplayHeader />

      <section className="my-login-hero">
        <div className="my-login-portrait-wrap">
          <img src="/my-kakao-login-hero.png" alt="운월당 카카오 로그인 안내" className="my-login-portrait" />
        </div>

        <div className="my-login-benefit-card">
          <button type="button" className="my-kakao-button my-kakao-poster-button" onClick={handleKakaoLogin} aria-label="카카오로 시작하기">
            카카오로 시작하기
          </button>
          {loginError ? <p className="my-login-error">{loginError}</p> : null}
        </div>
      </section>
    </main>
  );
}

function EmptyArchive() {
  return (
    <section className="my-empty-replay-card">
      <div className="my-empty-avatar">
        <img src="/tarot-mascot.png" alt="" />
      </div>
      <p>앗, 아직 사주결과가 없어요!</p>
      <Link to="/form/general-signature">첫 사주 리포트 보러가기</Link>
    </section>
  );
}

function ReportReplayCard({ report }: { report: ReportArchiveEntry }) {
  const dateLabel = formatArchiveDate(report.createdAt);

  return (
    <Link
      to={`/report/${report.productId}`}
      state={{
        formData: report.formData,
        paymentMethod: report.paymentMethod,
        orderId: report.orderId,
        reportData: report.reportData,
        reportProvider: report.reportProvider
      }}
      className="my-report-replay-card"
    >
      <span className="my-report-icon">
        <ScrollText size={17} />
      </span>
      <div className="my-report-summary">
        <strong>{report.title}</strong>
        <p>
          {report.customerName}님 · {dateLabel}
        </p>
        {report.subtitle ? <em>{report.subtitle}</em> : null}
      </div>
      <ChevronRight size={18} className="my-report-arrow" />
    </Link>
  );
}

function PromoBanner({ promo }: { promo: ReplayPromo }) {
  return (
    <Link to={promo.to} className="my-promo-banner" style={{ '--promo-tone': promo.tone } as CSSProperties}>
      {promo.to === '/detail/love-reading' ? (
        <LoveReadingCardPicture alt="" sizes="72px" />
      ) : (
        <img src={promo.image} alt="" loading="lazy" decoding="async" />
      )}
      <div className="my-promo-overlay" />
      <div className="my-promo-copy">
        <span>운월당 추천</span>
        <strong>{promo.title}</strong>
        <p>{promo.subtitle}</p>
      </div>
      <em>바로 보기</em>
    </Link>
  );
}

function LoggedInReplay() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [recentReports, setRecentReports] = useState(() => readReportArchiveEntries(user?.id));
  const [recoverablePayments, setRecoverablePayments] = useState<PaymentEntitlement[]>([]);
  const [recoveryOrderId, setRecoveryOrderId] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(true);
  const [showAllReports, setShowAllReports] = useState(false);
  const visibleReports = showAllReports ? recentReports : recentReports.slice(0, 4);
  const hiddenReportCount = Math.max(recentReports.length - 4, 0);

  useEffect(() => {
    let isCancelled = false;
    const syncReports = () => setRecentReports(readReportArchiveEntries(user?.id));
    const syncRemoteReports = async () => {
      let mergedReports = readReportArchiveEntries(user?.id);
      setRecentReports(mergedReports);

      if (!user?.authToken) {
        return;
      }

      try {
        const remoteReports = await fetchRemoteReportArchiveEntries(user.authToken);

        if (isCancelled) {
          return;
        }

        mergedReports = mergeReportArchiveEntries(mergedReports, remoteReports);
        writeReportArchiveEntries(mergedReports, user?.id);
        setRecentReports(mergedReports);
      } catch {
        // Local archive remains available when the server archive is temporarily unavailable.
      }

      const confirmEndpoint = getPortOneConfirmEndpoint();

      if (!confirmEndpoint || isCancelled) {
        return;
      }

      try {
        const entitlements = await fetchPaymentEntitlements(confirmEndpoint, user.authToken);

        if (isCancelled) {
          return;
        }

        const archivedOrderIds = new Set(mergedReports.map((entry) => entry.orderId).filter(Boolean));
        setRecoverablePayments(entitlements.filter((entry) => !archivedOrderIds.has(entry.orderId)));
      } catch {
        // Existing local and remote report archives remain available if entitlement sync is unavailable.
      }
    };

    void syncRemoteReports();

    window.addEventListener('focus', syncReports);
    window.addEventListener('storage', syncReports);

    return () => {
      isCancelled = true;
      window.removeEventListener('focus', syncReports);
      window.removeEventListener('storage', syncReports);
    };
  }, [user?.authToken, user?.id]);

  const handleResumePayment = async (entitlement: PaymentEntitlement) => {
    const confirmEndpoint = getPortOneConfirmEndpoint();

    if (!confirmEndpoint || !user?.authToken) {
      setRecoveryError('결제 복구 서버 연결 또는 로그인 상태를 확인해 주세요.');
      return;
    }

    setRecoveryOrderId(entitlement.orderId);
    setRecoveryError('');

    try {
      const renewed = await renewPaymentEntitlement(confirmEndpoint, user.authToken, entitlement.orderId);
      const pendingPayment = readPendingPayment();

      if (pendingPayment?.orderId === entitlement.orderId && pendingPayment.formData) {
        const recoveredPayment = {
          ...pendingPayment,
          reportAccessToken: renewed.reportAccessToken
        };
        savePendingPayment(recoveredPayment);
        navigate('/loading', {
          state: {
            product: recoveredPayment.productId,
            formData: recoveredPayment.formData,
            paymentMethod: recoveredPayment.paymentMethod,
            orderId: recoveredPayment.orderId,
            tabOrigin: '/my',
            reportAccessToken: renewed.reportAccessToken
          }
        });
        return;
      }

      navigate(`/form/${entitlement.productId}`, {
        state: {
          tabOrigin: '/my',
          recoveredEntitlement: {
            orderId: entitlement.orderId,
            reportAccessToken: renewed.reportAccessToken
          }
        }
      });
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : '결제 리포트 권한을 복구하지 못했습니다.');
    } finally {
      setRecoveryOrderId('');
    }
  };

  return (
    <main className="my-replay-page">
      <MyReplayHeader />

      <section className="my-replay-content">
        <div className="my-replay-title">
          <span>REPORT ARCHIVE</span>
          <h1>{user?.nickname || '운월당'}님의 보관함</h1>
          <p>구매하거나 생성한 사주 리포트를 한곳에 모아두고 다시 볼 수 있어요.</p>
        </div>

        {recoverablePayments.length ? (
          <section className="my-report-archive-section open" aria-label="이어 만들 수 있는 결제 리포트">
            <div className="my-archive-toggle">
              <span className="my-archive-toggle-icon">
                <ScrollText size={17} />
              </span>
              <span className="my-archive-toggle-copy">
                <strong>결제 완료 리포트 이어보기</strong>
                <em>다른 탭이나 컴퓨터에서 중단한 결제를 본인 인증으로 복구합니다.</em>
              </span>
            </div>
            <div className="my-report-replay-list">
              {recoverablePayments.map((entitlement) => {
                const service = findServiceById(entitlement.productId);
                const isRecovering = recoveryOrderId === entitlement.orderId;

                return (
                  <button
                    key={entitlement.orderId}
                    type="button"
                    className="my-report-replay-card"
                    disabled={Boolean(recoveryOrderId)}
                    onClick={() => void handleResumePayment(entitlement)}
                  >
                    <span className="my-report-icon">
                      <ScrollText size={17} />
                    </span>
                    <span className="my-report-summary">
                      <strong>{service.label}</strong>
                      <p>{isRecovering ? '결제 권한을 확인하고 있습니다.' : '본인 결제 확인 완료 · 이어서 작성'}</p>
                    </span>
                    <ChevronRight size={18} className="my-report-arrow" />
                  </button>
                );
              })}
            </div>
            {recoveryError ? <p className="my-login-error">{recoveryError}</p> : null}
          </section>
        ) : null}

        {recentReports.length ? (
          <section className={archiveOpen ? 'my-report-archive-section open' : 'my-report-archive-section'}>
            <button
              type="button"
              className="my-archive-toggle"
              aria-expanded={archiveOpen}
              onClick={() => setArchiveOpen((prev) => !prev)}
            >
              <span className="my-archive-toggle-icon">
                <Archive size={17} />
              </span>
              <span className="my-archive-toggle-copy">
                <strong>내가 본 사주</strong>
                <em>{recentReports.length}개 리포트 보관 중</em>
              </span>
              <ChevronDown className={archiveOpen ? 'my-archive-chevron open' : 'my-archive-chevron'} size={18} />
            </button>

            {archiveOpen ? (
              <>
                <div className="my-report-replay-list">
                  {visibleReports.map((report) => (
                    <ReportReplayCard key={report.id} report={report} />
                  ))}
                </div>

                {hiddenReportCount ? (
                  <button
                    type="button"
                    className="my-archive-expand-button"
                    onClick={() => setShowAllReports((prev) => !prev)}
                  >
                    {showAllReports ? '간단히 접기' : `전체 ${recentReports.length}개 펼치기`}
                  </button>
                ) : null}
              </>
            ) : null}
          </section>
        ) : (
          <EmptyArchive />
        )}

        <section className="my-promo-section">
          <div className="my-section-label">
            <Sparkles size={15} />
            다른 사주 리포트도 있어요
          </div>
          <div className="my-promo-list">
            {replayPromos.map((promo) => (
              <PromoBanner key={promo.title} promo={promo} />
            ))}
          </div>
        </section>

        <button type="button" className="my-logout-button" onClick={logout}>
          <LogOut size={15} />
          로그아웃
        </button>
      </section>
    </main>
  );
}

export default function My() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <LoggedInReplay /> : <LoggedOutReplay />;
}
