import { BarChart3, ChevronLeft, Lock, RefreshCw, ScrollText, ShieldCheck, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { readReportArchiveEntries } from '../lib/reportArchive';

const ADMIN_SESSION_KEY = 'unwoldang.admin.session';

const productPriceMap: Record<string, number> = {
  'concern-reading': 2900,
  'love-reading': 990,
  'general-signature': 79000
};

function formatCurrency(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function getProductPrice(productId: string) {
  return productPriceMap[productId] || 0;
}

export default function Admin() {
  const adminCode = import.meta.env.VITE_ADMIN_ACCESS_CODE;
  const [inputCode, setInputCode] = useState('');
  const [accessError, setAccessError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (!adminCode) {
      return true;
    }

    return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'ok';
  });
  const [reports, setReports] = useState(() => readReportArchiveEntries());

  const stats = useMemo(() => {
    const todayKey = new Date().toDateString();
    const todayReports = reports.filter((report) => new Date(report.createdAt).toDateString() === todayKey);
    const estimatedRevenue = reports.reduce((sum, report) => sum + getProductPrice(report.productId), 0);
    const productCounts = reports.reduce<Record<string, number>>((acc, report) => {
      acc[report.productId] = (acc[report.productId] || 0) + 1;
      return acc;
    }, {});

    return {
      totalReports: reports.length,
      todayReports: todayReports.length,
      estimatedRevenue,
      productCounts
    };
  }, [reports]);

  const unlock = () => {
    if (!adminCode || inputCode.trim() === adminCode) {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
      setIsUnlocked(true);
      setAccessError('');
      return;
    }

    setAccessError('관리자 코드가 맞지 않습니다.');
  };

  if (!isUnlocked) {
    return (
      <main className="admin-page">
        <section className="admin-lock-card">
          <span className="admin-icon-circle">
            <Lock size={22} />
          </span>
          <h1>운월당 관리자</h1>
          <p>주문, 리포트, 오류 신고를 확인하는 운영자 전용 화면입니다.</p>
          <label>
            관리자 코드
            <input
              type="password"
              value={inputCode}
              onChange={(event) => setInputCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  unlock();
                }
              }}
              placeholder="관리자 코드를 입력하세요"
            />
          </label>
          {accessError ? <small>{accessError}</small> : null}
          <button type="button" onClick={unlock}>
            관리자 페이지 열기
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Link to="/" className="admin-back-link">
          <ChevronLeft size={18} />
          홈으로
        </Link>
        <div>
          <span>ADMIN</span>
          <h1>운월당 운영 대시보드</h1>
        </div>
        <button type="button" onClick={() => setReports(readReportArchiveEntries())}>
          <RefreshCw size={16} />
          새로고침
        </button>
      </header>

      {!adminCode ? (
        <section className="admin-warning">
          <ShieldCheck size={18} />
          <p>
            현재는 로컬 개발용으로 열려 있습니다. 배포 전 `VITE_ADMIN_ACCESS_CODE`를 설정하고, 실제 주문 관리는 서버 권한
            검증으로 분리하세요.
          </p>
        </section>
      ) : null}

      <section className="admin-stat-grid">
        <article>
          <ScrollText size={19} />
          <span>전체 리포트</span>
          <strong>{stats.totalReports.toLocaleString('ko-KR')}</strong>
        </article>
        <article>
          <BarChart3 size={19} />
          <span>오늘 생성</span>
          <strong>{stats.todayReports.toLocaleString('ko-KR')}</strong>
        </article>
        <article>
          <WalletCards size={19} />
          <span>예상 매출</span>
          <strong>{formatCurrency(stats.estimatedRevenue)}</strong>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>상품별 생성 현황</h2>
          <p>현재 브라우저에 보관된 리포트 기준입니다.</p>
        </div>
        <div className="admin-product-list">
          {Object.entries(stats.productCounts).length ? (
            Object.entries(stats.productCounts).map(([productId, count]) => (
              <article key={productId}>
                <strong>{productId}</strong>
                <span>{count.toLocaleString('ko-KR')}건</span>
              </article>
            ))
          ) : (
            <p className="admin-empty">아직 생성된 리포트가 없습니다.</p>
          )}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>최근 리포트</h2>
          <p>고객명, 상품, 주문번호를 빠르게 확인합니다.</p>
        </div>
        <div className="admin-table">
          {reports.length ? (
            reports.slice(0, 12).map((report) => (
              <Link
                key={report.id}
                to={`/report/${report.productId}`}
                state={{
                  formData: report.formData,
                  paymentMethod: report.paymentMethod,
                  orderId: report.orderId,
                  reportData: report.reportData
                }}
              >
                <span>{new Date(report.createdAt).toLocaleString('ko-KR')}</span>
                <strong>{report.customerName}</strong>
                <em>{report.title}</em>
                <small>{report.orderId || report.id}</small>
              </Link>
            ))
          ) : (
            <p className="admin-empty">최근 리포트가 없습니다.</p>
          )}
        </div>
      </section>
    </main>
  );
}
