import { ChevronRight, LogOut, Menu, MessageCircle, ScrollText, Sparkles } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildKakaoAuthorizeUrl } from '../lib/auth';
import { readReportArchiveEntries, type ReportArchiveEntry } from '../lib/reportArchive';

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
    title: '연애비책',
    subtitle: '올해 내 연애 흐름은?',
    image: '/intake-blossom-girl.png',
    to: '/form/love-reading',
    tone: '#8a7258'
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

function MyReplayHeader() {
  return (
    <header className="my-replay-header">
      <Link to="/" className="my-replay-logo" aria-label="운월당 홈">
        <span>운</span>
        <strong>운월당</strong>
      </Link>

      <Link to="/menu" className="my-replay-menu-button" aria-label="메뉴">
        <Menu size={20} />
      </Link>
    </header>
  );
}

function LoggedOutReplay() {
  const [loginError, setLoginError] = useState('');

  const handleKakaoLogin = () => {
    const authorizeUrl = buildKakaoAuthorizeUrl('/my');

    if (!authorizeUrl) {
      setLoginError('카카오 REST API 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.');
      return;
    }

    window.location.href = authorizeUrl;
  };

  return (
    <main className="my-replay-page my-replay-login-page">
      <MyReplayHeader />

      <section className="my-login-hero">
        <div className="my-login-portrait-wrap">
          <img src="/intake-night-blue.png" alt="" className="my-login-portrait" />
        </div>

        <div className="my-login-benefit-card">
          <button type="button" className="my-kakao-button" onClick={handleKakaoLogin}>
            <MessageCircle size={17} fill="currentColor" />
            카카오로 로그인/가입
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
  return (
    <Link
      to={`/report/${report.productId}`}
      state={{
        formData: report.formData,
        paymentMethod: report.paymentMethod,
        orderId: report.orderId,
        reportData: report.reportData
      }}
      className="my-report-replay-card"
    >
      <span className="my-report-icon">
        <ScrollText size={17} />
      </span>
      <div>
        <strong>{report.title}</strong>
        <p>
          {report.customerName} · {new Date(report.createdAt).toLocaleDateString('ko-KR')}
        </p>
      </div>
      <ChevronRight size={18} />
    </Link>
  );
}

function PromoBanner({ promo }: { promo: ReplayPromo }) {
  return (
    <Link to={promo.to} className="my-promo-banner" style={{ '--promo-tone': promo.tone } as CSSProperties}>
      <img src={promo.image} alt="" />
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
  const [recentReports, setRecentReports] = useState(() => readReportArchiveEntries());

  useEffect(() => {
    const syncReports = () => setRecentReports(readReportArchiveEntries());

    window.addEventListener('focus', syncReports);
    window.addEventListener('storage', syncReports);

    return () => {
      window.removeEventListener('focus', syncReports);
      window.removeEventListener('storage', syncReports);
    };
  }, []);

  return (
    <main className="my-replay-page">
      <MyReplayHeader />

      <section className="my-replay-content">
        <div className="my-replay-title">
          <span>내 운세 다시 보기</span>
          <h1>{user?.nickname || '운월당'}님의 리포트 보관함</h1>
          <p>카카오 로그인 상태에서는 구매한 리포트를 이 화면에서 다시 확인할 수 있어요.</p>
        </div>

        {recentReports.length ? (
          <section className="my-report-archive-section">
            <div className="my-section-label">
              <Sparkles size={15} />
              내가 본 사주 리포트
            </div>
            <div className="my-report-replay-list">
              {recentReports.slice(0, 8).map((report) => (
                <ReportReplayCard key={report.id} report={report} />
              ))}
            </div>
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
