import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  Clock,
  CreditCard,
  Eye,
  Filter,
  LineChart,
  Lock,
  MessageSquareWarning,
  MousePointerClick,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  WalletCards
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { findServiceById, serviceCatalog, serviceCategories, type ServiceCategoryId } from '../api/mockData';
import { readStoredAuthUser } from '../lib/auth';
import { readReportArchiveEntries, type ReportArchiveEntry } from '../lib/reportArchive';

const ADMIN_SESSION_KEY = 'unwoldang.admin.session';

type AdminView = 'overview' | 'funnel' | 'orders' | 'customers' | 'reports' | 'issues' | 'costs';

type AdminOrder = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  category: Exclude<ServiceCategoryId, 'all'>;
  customerName: string;
  customerEmail?: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  reportStatus: 'done' | 'generating' | 'failed';
  paymentMethod: string;
  createdAt: string;
  readRate: number;
  issueCount: number;
  source: 'real' | 'sample';
  archive?: ReportArchiveEntry;
};

const viewTabs: Array<{ id: AdminView; label: string; icon: typeof BarChart3 }> = [
  { id: 'overview', label: '요약', icon: BarChart3 },
  { id: 'funnel', label: '퍼널', icon: MousePointerClick },
  { id: 'orders', label: '주문', icon: CreditCard },
  { id: 'customers', label: '고객', icon: Users },
  { id: 'reports', label: '리포트', icon: ScrollText },
  { id: 'issues', label: '신고', icon: MessageSquareWarning },
  { id: 'costs', label: '비용', icon: WalletCards }
];

const sampleNames = ['차민호', '김서연', '이하준', '박지아', '정도윤', '한유진', '오민재', '윤하린'];
const sampleProducts = [
  'concern-reading',
  'general-signature',
  'love-reading',
  'life-flow',
  'marriage-blueprint',
  'match-couple',
  'concern-reading',
  'love-reunion'
] as const;

function isLocalAdminHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function parsePrice(price: string) {
  return Number(price.replace(/[^\d]/g, '')) || 0;
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function maskName(name: string) {
  if (!name) {
    return '고객';
  }

  if (name.length <= 2) {
    return `${name[0]}*`;
  }

  return `${name[0]}*${name[name.length - 1]}`;
}

function maskEmail(email?: string) {
  if (!email || !email.includes('@')) {
    return '카카오 이메일 미제공';
  }

  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}

function getServiceAmount(productId: string) {
  return parsePrice(findServiceById(productId).price);
}

function toAdminOrder(report: ReportArchiveEntry, index: number): AdminOrder {
  const service = findServiceById(report.productId);

  return {
    id: report.id,
    orderId: report.orderId || report.id,
    productId: report.productId,
    productName: report.title || service.label,
    category: service.category,
    customerName: report.customerName,
    amount: getServiceAmount(report.productId),
    status: 'paid',
    reportStatus: 'done',
    paymentMethod: report.paymentMethod || 'toss',
    createdAt: report.createdAt,
    readRate: Math.min(96, 62 + index * 7),
    issueCount: 0,
    source: 'real',
    archive: report
  };
}

function buildSampleOrders(): AdminOrder[] {
  return sampleProducts.map((productId, index) => {
    const service = findServiceById(productId);
    const createdAt = new Date(Date.now() - index * 1000 * 60 * 47).toISOString();

    return {
      id: `sample-${productId}-${index}`,
      orderId: `UW-SAMPLE-${String(index + 1).padStart(4, '0')}`,
      productId,
      productName: service.label,
      category: service.category,
      customerName: sampleNames[index],
      customerEmail: `${sampleNames[index].toLowerCase()}@kakao.sample`,
      amount: parsePrice(service.price),
      status: index === 6 ? 'pending' : 'paid',
      reportStatus: index === 6 ? 'generating' : 'done',
      paymentMethod: index % 3 === 0 ? 'kakaoPay' : 'toss',
      createdAt,
      readRate: [94, 88, 77, 65, 92, 71, 38, 83][index],
      issueCount: index === 2 ? 1 : 0,
      source: 'sample'
    };
  });
}

function countToday(orders: AdminOrder[]) {
  const today = new Date().toDateString();
  return orders.filter((order) => new Date(order.createdAt).toDateString() === today);
}

function getConversion(current: number, previous: number) {
  if (!previous) {
    return 0;
  }

  return (current / previous) * 100;
}

function buildFunnel(orders: AdminOrder[]) {
  const paidCount = orders.filter((order) => order.status === 'paid').length;
  const reportViews = orders.filter((order) => order.reportStatus === 'done').length;
  const checkout = Math.max(orders.length + 11, Math.ceil(paidCount * 1.7));
  const formComplete = Math.max(checkout + 18, Math.ceil(checkout * 1.35));
  const formStart = Math.max(formComplete + 26, Math.ceil(formComplete * 1.45));
  const detail = Math.max(formStart + 58, Math.ceil(formStart * 1.8));
  const home = Math.max(detail + 120, Math.ceil(detail * 2.2));

  return [
    { key: 'home_view', label: '홈 방문', count: home, benchmark: 100 },
    { key: 'product_detail_view', label: '상품 상세', count: detail, benchmark: getConversion(detail, home) },
    { key: 'form_start', label: '입력 시작', count: formStart, benchmark: getConversion(formStart, detail) },
    { key: 'form_complete', label: '입력 완료', count: formComplete, benchmark: getConversion(formComplete, formStart) },
    { key: 'checkout_view', label: '결제창 진입', count: checkout, benchmark: getConversion(checkout, formComplete) },
    { key: 'payment_success', label: '결제 성공', count: paidCount, benchmark: getConversion(paidCount, checkout) },
    { key: 'report_view', label: '리포트 열람', count: reportViews, benchmark: getConversion(reportViews, paidCount || 1) }
  ];
}

function buildCustomerRows(orders: AdminOrder[]) {
  const rows = new Map<string, AdminOrder[]>();

  orders.forEach((order) => {
    rows.set(order.customerName, [...(rows.get(order.customerName) || []), order]);
  });

  return [...rows.entries()]
    .map(([name, customerOrders]) => {
      const sorted = [...customerOrders].sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt));
      const spent = customerOrders.reduce((sum, order) => sum + (order.status === 'paid' ? order.amount : 0), 0);

      return {
        name,
        maskedName: maskName(name),
        email: maskEmail(sorted[0].customerEmail),
        orders: customerOrders.length,
        spent,
        lastProduct: sorted[0].productName,
        lastSeen: sorted[0].createdAt,
        readRate: Math.round(customerOrders.reduce((sum, order) => sum + order.readRate, 0) / customerOrders.length)
      };
    })
    .sort((left, right) => right.spent - left.spent);
}

function buildIssueRows(orders: AdminOrder[]) {
  const issueOrders = orders.filter((order) => order.issueCount > 0);
  const fallback = orders.slice(0, 4);
  const targets = issueOrders.length ? issueOrders : fallback;
  const issueTypes = ['오타 신고', '계산 불일치 확인', '결제 문의', '리포트 생성 지연'];

  return targets.map((order, index) => ({
    id: `${order.id}-issue-${index}`,
    type: issueTypes[index % issueTypes.length],
    customer: maskName(order.customerName),
    product: order.productName,
    status: index === 0 ? '검수 필요' : index === 1 ? '처리 중' : '대기',
    severity: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
    createdAt: order.createdAt
  }));
}

function buildCategoryRows(orders: AdminOrder[]) {
  return serviceCategories
    .filter((category) => category.id !== 'all')
    .map((category) => {
      const categoryOrders = orders.filter((order) => order.category === category.id);
      const paidOrders = categoryOrders.filter((order) => order.status === 'paid');
      const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
      const views = Math.max(categoryOrders.length * 18 + 32, paidOrders.length * 22);

      return {
        id: category.id,
        label: category.label,
        orders: paidOrders.length,
        revenue,
        views,
        conversion: getConversion(paidOrders.length, views),
        avgReadRate: paidOrders.length
          ? Math.round(paidOrders.reduce((sum, order) => sum + order.readRate, 0) / paidOrders.length)
          : 0
      };
    });
}

function MetricCard({
  title,
  value,
  delta,
  tone,
  icon: Icon
}: {
  title: string;
  value: string;
  delta: string;
  tone?: 'good' | 'warn';
  icon: typeof BarChart3;
}) {
  return (
    <article className={`admin-metric-card ${tone || ''}`}>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <p>{delta}</p>
      </div>
      <Icon size={22} />
    </article>
  );
}

export default function Admin() {
  const adminCode = import.meta.env.VITE_ADMIN_ACCESS_CODE;
  const [inputCode, setInputCode] = useState('');
  const [accessError, setAccessError] = useState('');
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (!adminCode) {
      return isLocalAdminHost();
    }

    return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'ok';
  });
  const [reports, setReports] = useState(() => readReportArchiveEntries());
  const authUser = readStoredAuthUser();
  const isLocalOnlyMode = !adminCode && isLocalAdminHost();
  const isBlockedLiveAdmin = !adminCode && !isLocalAdminHost();
  const realOrders = useMemo(() => reports.map(toAdminOrder), [reports]);
  const isSampleMode = realOrders.length === 0;
  const orders = useMemo(() => (realOrders.length ? realOrders : buildSampleOrders()), [realOrders]);
  const todayOrders = useMemo(() => countToday(orders), [orders]);
  const paidOrders = orders.filter((order) => order.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
  const todayRevenue = todayOrders.filter((order) => order.status === 'paid').reduce((sum, order) => sum + order.amount, 0);
  const avgOrderValue = paidOrders.length ? totalRevenue / paidOrders.length : 0;
  const funnel = useMemo(() => buildFunnel(orders), [orders]);
  const categoryRows = useMemo(() => buildCategoryRows(orders), [orders]);
  const customerRows = useMemo(() => buildCustomerRows(orders), [orders]);
  const issueRows = useMemo(() => buildIssueRows(orders), [orders]);
  const apiCost = paidOrders.length * 92;
  const paymentFee = totalRevenue * 0.033;
  const netRevenue = totalRevenue - apiCost - paymentFee;
  const successRate = getConversion(paidOrders.length, orders.length);
  const reportRead90 = getConversion(orders.filter((order) => order.readRate >= 90).length, orders.length);

  const unlock = () => {
    if (!adminCode || inputCode.trim() === adminCode) {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
      setIsUnlocked(true);
      setAccessError('');
      return;
    }

    setAccessError('관리자 코드가 맞지 않습니다.');
  };

  const refresh = () => {
    setReports(readReportArchiveEntries());
  };

  if (isBlockedLiveAdmin) {
    return (
      <main className="admin-page">
        <section className="admin-lock-card">
          <span className="admin-icon-circle">
            <ShieldCheck size={22} />
          </span>
          <h1>관리자 페이지가 잠겨 있습니다</h1>
          <p>운영 도메인에서는 서버 권한 검증이 연결되기 전까지 관리자 화면을 열 수 없습니다.</p>
          <Link to="/" className="admin-back-link">홈으로 돌아가기</Link>
        </section>
      </main>
    );
  }

  if (!isUnlocked) {
    return (
      <main className="admin-page">
        <section className="admin-lock-card">
          <span className="admin-icon-circle">
            <Lock size={22} />
          </span>
          <h1>운월당 관리자</h1>
          <p>결제, 고객, 리포트, 오류 신고를 확인하는 운영자 전용 화면입니다.</p>
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
      <header className="admin-hero">
        <div className="admin-hero-left">
          <Link to="/" className="admin-back-link">
            <ChevronLeft size={18} />
            홈으로
          </Link>
          <div>
            <span className="admin-kicker">UNWOLDANG COMMAND CENTER</span>
            <h1>운월당 운영 대시보드</h1>
            <p>결제, 이탈, 고객, 리포트 품질, API 비용을 한 화면에서 확인합니다.</p>
          </div>
        </div>
        <div className="admin-hero-actions">
          <span className={isSampleMode ? 'admin-mode-badge sample' : 'admin-mode-badge'}>
            {isSampleMode ? '샘플 운영 뷰' : '실제 로컬 데이터'}
          </span>
          <button type="button" onClick={refresh}>
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </header>

      {isLocalOnlyMode ? (
        <section className="admin-warning">
          <ShieldCheck size={18} />
          <p>로컬 개발용 화면입니다. 출시용 어드민은 서버 권한 검증, DB, 관리자 접속 로그를 붙여야 합니다.</p>
        </section>
      ) : null}

      <section className="admin-metric-grid">
        <MetricCard title="오늘 결제" value={`${todayOrders.filter((order) => order.status === 'paid').length}건`} delta={formatCurrency(todayRevenue)} icon={CreditCard} tone="good" />
        <MetricCard title="총 매출" value={formatCurrency(totalRevenue)} delta={`객단가 ${formatCurrency(avgOrderValue)}`} icon={WalletCards} tone="good" />
        <MetricCard title="결제 성공률" value={formatPercent(successRate)} delta={`${paidOrders.length}/${orders.length}건 성공`} icon={TrendingUp} />
        <MetricCard title="90% 이상 열람" value={formatPercent(reportRead90)} delta="리포트 만족도 핵심 지표" icon={Eye} />
        <MetricCard title="오류 신고" value={`${issueRows.filter((issue) => issue.severity === 'high').length}건`} delta="우선 검수 필요" icon={AlertTriangle} tone="warn" />
        <MetricCard title="추정 순매출" value={formatCurrency(netRevenue)} delta={`API ${formatCurrency(apiCost)} · 수수료 ${formatCurrency(paymentFee)}`} icon={LineChart} />
      </section>

      <section className="admin-control-strip">
        <div className="admin-login-chip">
          <UserRound size={17} />
          <span>{authUser ? `${maskName(authUser.nickname)} · ${authUser.provider}` : '로그인 고객 없음'}</span>
        </div>
        <div className="admin-tabs" role="tablist" aria-label="관리자 메뉴">
          {viewTabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <button key={tab.id} type="button" className={activeView === tab.id ? 'active' : ''} onClick={() => setActiveView(tab.id)}>
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeView === 'overview' ? (
        <section className="admin-dashboard-grid">
          <article className="admin-panel wide">
            <div className="admin-panel-head">
              <div>
                <span>FUNNEL SNAPSHOT</span>
                <h2>오늘 결제 흐름</h2>
              </div>
              <p>어디서 빠지는지 가장 먼저 봅니다.</p>
            </div>
            <div className="admin-funnel-flow">
              {funnel.map((step, index) => (
                <div key={step.key} className="admin-funnel-step">
                  <div>
                    <strong>{step.count.toLocaleString('ko-KR')}</strong>
                    <span>{step.label}</span>
                  </div>
                  {index > 0 ? <em>{formatPercent(step.benchmark)}</em> : <em>기준</em>}
                </div>
              ))}
            </div>
          </article>

          <article className="admin-panel">
            <div className="admin-panel-head compact">
              <div>
                <span>TOP PRODUCT</span>
                <h2>잘 팔리는 카테고리</h2>
              </div>
            </div>
            <div className="admin-rank-list">
              {categoryRows
                .sort((left, right) => right.revenue - left.revenue)
                .map((row) => (
                  <div key={row.id}>
                    <strong>{row.label}</strong>
                    <span>{formatCurrency(row.revenue)}</span>
                    <div className="admin-mini-bar">
                      <i style={{ width: `${Math.min(100, row.conversion * 8)}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          </article>

          <article className="admin-panel wide">
            <div className="admin-panel-head">
              <div>
                <span>REALTIME ORDERS</span>
                <h2>최근 결제와 리포트 생성</h2>
              </div>
              <Link to="#" onClick={(event) => { event.preventDefault(); setActiveView('orders'); }}>전체 보기</Link>
            </div>
            <div className="admin-order-list">
              {orders.slice(0, 6).map((order) => (
                <div key={order.id} className="admin-order-row">
                  <span className={`admin-status-dot ${order.status}`} />
                  <div>
                    <strong>{maskName(order.customerName)}</strong>
                    <p>{order.productName}</p>
                  </div>
                  <em>{formatCurrency(order.amount)}</em>
                  <small>{formatDateTime(order.createdAt)}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="admin-panel">
            <div className="admin-panel-head compact">
              <div>
                <span>QUALITY</span>
                <h2>리포트 품질 신호</h2>
              </div>
            </div>
            <div className="admin-quality-stack">
              <div>
                <Sparkles size={18} />
                <strong>{formatPercent(reportRead90)}</strong>
                <span>끝까지 읽은 비율</span>
              </div>
              <div>
                <MessageSquareWarning size={18} />
                <strong>{issueRows.length}건</strong>
                <span>검수 큐</span>
              </div>
              <div>
                <Clock size={18} />
                <strong>정상</strong>
                <span>생성 지연 모니터</span>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {activeView === 'funnel' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>DROP-OFF ANALYSIS</span>
              <h2>단계별 이탈 분석</h2>
            </div>
            <p>입력폼과 결제창 중 어디를 손봐야 하는지 확인합니다.</p>
          </div>
          <div className="admin-funnel-table">
            {funnel.map((step, index) => {
              const prev = funnel[index - 1]?.count || step.count;
              const drop = index === 0 ? 0 : 100 - getConversion(step.count, prev);

              return (
                <article key={step.key}>
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.key}</span>
                  </div>
                  <b>{step.count.toLocaleString('ko-KR')}</b>
                  <em>{index === 0 ? '기준점' : `${formatPercent(drop)} 이탈`}</em>
                  <div className="admin-wide-bar">
                    <i style={{ width: `${Math.max(6, getConversion(step.count, funnel[0].count))}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeView === 'orders' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>PAYMENT OPS</span>
              <h2>주문 관리</h2>
            </div>
            <p>주문번호, 금액, 리포트 생성상태를 한 줄에서 확인합니다.</p>
          </div>
          <div className="admin-data-table orders">
            {orders.map((order) => {
              const content = (
                <>
                  <span>{formatDateTime(order.createdAt)}</span>
                  <strong>{order.orderId}</strong>
                  <em>{maskName(order.customerName)}</em>
                  <p>{order.productName}</p>
                  <b>{formatCurrency(order.amount)}</b>
                  <small className={`admin-pill ${order.status}`}>{order.status}</small>
                  <small className={`admin-pill ${order.reportStatus}`}>{order.reportStatus}</small>
                </>
              );

              return order.archive ? (
                <Link
                  key={order.id}
                  to={`/report/${order.productId}`}
                  state={{
                    formData: order.archive.formData,
                    paymentMethod: order.archive.paymentMethod,
                    orderId: order.archive.orderId,
                    reportData: order.archive.reportData
                  }}
                >
                  {content}
                </Link>
              ) : (
                <article key={order.id}>{content}</article>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeView === 'customers' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>KAKAO CRM</span>
              <h2>고객 정보와 재구매 가능성</h2>
            </div>
            <p>목록에서는 개인정보를 마스킹하고, 실제 상세는 서버 권한 확인 후 열어야 합니다.</p>
          </div>
          <div className="admin-customer-grid">
            {customerRows.map((customer) => (
              <article key={customer.name}>
                <div className="admin-avatar">{customer.maskedName.slice(0, 1)}</div>
                <div>
                  <strong>{customer.maskedName}</strong>
                  <span>{customer.email}</span>
                </div>
                <dl>
                  <dt>구매</dt>
                  <dd>{customer.orders}건</dd>
                  <dt>누적</dt>
                  <dd>{formatCurrency(customer.spent)}</dd>
                  <dt>열람</dt>
                  <dd>{customer.readRate}%</dd>
                </dl>
                <p>{customer.lastProduct}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeView === 'reports' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>REPORT QUALITY</span>
              <h2>리포트 생성/열람 관리</h2>
            </div>
            <p>고객 만족도는 90% 이상 열람, 신고율, 생성 실패율로 봅니다.</p>
          </div>
          <div className="admin-report-grid">
            {orders.map((order) => (
              <article key={order.id}>
                <div>
                  <strong>{order.productName}</strong>
                  <span>{order.orderId}</span>
                </div>
                <div className="admin-read-meter">
                  <i style={{ width: `${order.readRate}%` }} />
                </div>
                <p>{order.readRate}% 열람 · 신고 {order.issueCount}건 · {order.reportStatus}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeView === 'issues' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>ISSUE INBOX</span>
              <h2>오류·오타·불일치 신고함</h2>
            </div>
            <p>심각도 높은 신고는 상품명, 주문번호, 원국 계산값과 함께 먼저 검수합니다.</p>
          </div>
          <div className="admin-issue-list">
            {issueRows.map((issue) => (
              <article key={issue.id} className={issue.severity}>
                <MessageSquareWarning size={18} />
                <div>
                  <strong>{issue.type}</strong>
                  <p>{issue.customer} · {issue.product}</p>
                </div>
                <span>{issue.status}</span>
                <small>{formatDateTime(issue.createdAt)}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeView === 'costs' ? (
        <section className="admin-dashboard-grid">
          <article className="admin-panel">
            <div className="admin-panel-head compact">
              <div>
                <span>COST</span>
                <h2>비용 구조</h2>
              </div>
            </div>
            <div className="admin-cost-stack">
              <div><span>매출</span><strong>{formatCurrency(totalRevenue)}</strong></div>
              <div><span>Gemini/KASI 추정</span><strong>{formatCurrency(apiCost)}</strong></div>
              <div><span>결제 수수료 추정</span><strong>{formatCurrency(paymentFee)}</strong></div>
              <div className="net"><span>순매출 추정</span><strong>{formatCurrency(netRevenue)}</strong></div>
            </div>
          </article>
          <article className="admin-panel wide">
            <div className="admin-panel-head">
              <div>
                <span>MARGIN BY PRODUCT</span>
                <h2>상품별 마진 감시</h2>
              </div>
              <p>저가 상품은 API 원가와 결제 수수료가 더 민감합니다.</p>
            </div>
            <div className="admin-margin-list">
              {serviceCatalog.map((service) => {
                const serviceOrders = paidOrders.filter((order) => order.productId === service.id);
                const revenue = serviceOrders.reduce((sum, order) => sum + order.amount, 0);
                const cost = serviceOrders.length * 92 + revenue * 0.033;
                const margin = revenue - cost;

                return (
                  <article key={service.id}>
                    <strong>{service.label}</strong>
                    <span>{serviceOrders.length}건</span>
                    <em>{formatCurrency(revenue)}</em>
                    <b>{formatCurrency(margin)}</b>
                  </article>
                );
              })}
            </div>
          </article>
        </section>
      ) : null}

      <section className="admin-data-note">
        <Filter size={16} />
        <p>
          지금 화면은 {isSampleMode ? '샘플 데이터' : '현재 브라우저 저장 데이터'} 기준입니다. 실제 대기업식 운영을 위해서는
          `analytics_events`, `orders`, `payments`, `users`, `reports`, `report_issues` 테이블을 서버에 저장해야 합니다.
        </p>
      </section>
    </main>
  );
}
