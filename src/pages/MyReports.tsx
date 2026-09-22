import { Archive, ChevronDown, ChevronRight, ScrollText, Sparkles } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { findServiceById } from '../api/mockData';
import LoveReadingCardPicture from '../components/LoveReadingCardPicture';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import {
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
import { discoverableProducts } from '../products/registry';
import '../styles/my.css';
import type { ProductId } from '../products/types';
import MyAuthGate from '../features/my/MyAuthGate';

/**
 * 리포트 — 보관함이 사는 곳.
 *
 * 예전에는 이 화면이 `/my` 자체였다. 마이가 메뉴 한 장이 되면서 보관함은 그 아래
 * "리포트" 항목으로 들어왔다. 화면 내용은 그대로 옮겨 왔고, 로그인 처리만 공용
 * 게이트(`MyAuthGate`)로 뺐다 — 마이 아래 화면들이 같은 규칙을 쓰게.
 */
type ReplayPromo = {
  productId: ProductId;
  title: string;
  subtitle: string;
  image: string;
  imagePosition?: string;
  to: string;
  tone: string;
};

/** 카드 배경 위에 얹는 그라데이션 색. 상품 정의에는 없는 표시 층 값이다. */
const PROMO_TONES: Partial<Record<ProductId, string>> = {
  'general-signature': '#1f4f98',
  'love-reading': '#a80e30',
  'love-reunion': '#6d4de8',
  'past-life-goblin': '#3f2a6d',
  'match-couple': '#d62f3f',
  'life-flow': '#6da9c8',
  'marriage-blueprint': '#bc6a53'
};

/** 보관함 카드는 한 줄만 들어간다. 상품 부제가 길면 질문형으로 줄여 쓴다. */
const PROMO_SUBTITLES: Partial<Record<ProductId, string>> = {
  'general-signature': '나의 운명 전체 흐름은?',
  'love-reading': '반복되는 내 연애 패턴은?',
  'love-reunion': '다시 연락해도 되는 조건은?',
  'past-life-goblin': '전생의 나는 누구였을까?'
};

const replayPromos: ReplayPromo[] = discoverableProducts.map((product) => ({
  productId: product.id,
  title: product.home.title,
  subtitle: PROMO_SUBTITLES[product.id] || product.home.subtitle,
  image: product.home.image,
  imagePosition: product.home.imagePosition,
  to: product.routes.detail,
  tone: PROMO_TONES[product.id] || '#6d4de8'
}));

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

function EmptyArchive() {
  return (
    <section className="my-empty-replay-card">
      {/* 예전에는 /tarot-mascot.png 를 썼다. 타로는 /tarot 이 홈으로 리다이렉트되는
          제거된 상품이라, 팔지 않는 물건의 캐릭터가 보관함을 지키고 있었다. */}
      <div className="my-empty-avatar" aria-hidden="true">
        <Archive size={30} strokeWidth={1.5} />
      </div>
      <p>앗, 아직 사주결과가 없어요!</p>
      <Link to="/detail/general-saju">첫 사주 리포트 보러가기</Link>
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
      {promo.productId === 'love-reading' ? (
        <LoveReadingCardPicture alt="" sizes="72px" />
      ) : (
        <img
          src={promo.image}
          alt=""
          loading="lazy"
          decoding="async"
          style={promo.imagePosition ? { objectPosition: promo.imagePosition } : undefined}
        />
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

function ReportArchive() {
  const { user } = useAuth();
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
      <MobileTopBar title="리포트" backTo="/my" backLabel="마이" />

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
      </section>
    </main>
  );
}

export default function MyReports() {
  return (
    <MyAuthGate title="리포트" returnTo="/my/reports">
      <ReportArchive />
    </MyAuthGate>
  );
}
