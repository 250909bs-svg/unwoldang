import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  Database,
  Eye,
  Gauge,
  LineChart,
  Lock,
  MessageSquareWarning,
  MousePointerClick,
  PieChart,
  RefreshCw,
  Search,
  Server,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  X,
  Zap
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { findServiceById, serviceCatalog, serviceCategories, type ServiceCategoryId, type ServiceId } from '../api/mockData';
import { readStoredAuthUser } from '../lib/auth';
import {
  fetchAdminReportArchiveEntries,
  mergeReportArchiveEntries,
  readReportArchiveEntries,
  type ReportArchiveEntry
} from '../lib/reportArchive';
import { getAdminLoginEndpoint } from '../lib/runtimeConfig';

const ADMIN_SESSION_KEY = 'unwoldang.admin.session.v2';
const ADMIN_ACCESS_TOKEN_KEY = 'unwoldang.admin.accessToken.v1';
const ADMIN_CREDENTIAL_HASH = import.meta.env.VITE_LOCAL_ADMIN_CREDENTIAL_HASH || '';
const ENABLE_CLIENT_ADMIN = import.meta.env.VITE_ENABLE_CLIENT_ADMIN === 'true';

type AdminView = 'overview' | 'funnel' | 'orders' | 'customers' | 'reports' | 'issues' | 'costs';
type AdminPeriod = 'today' | '7d' | '30d';
type IconComponent = typeof BarChart3;
type SourceChannel = '카카오' | '네이버검색' | '인스타그램' | '직접방문' | '재방문';
type DeviceType = 'mobile' | 'desktop';
type CustomerFilter = 'all' | 'registered' | 'paid' | 'vip' | 'risk';

type AdminOrder = {
  id: string;
  orderId: string;
  productId: ServiceId;
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
  sourceChannel: SourceChannel;
  device: DeviceType;
  ageRange: string;
  reportLatencySec: number;
  analyticsEstimated: boolean;
  archive?: ReportArchiveEntry;
};

type FunnelStep = {
  key: string;
  label: string;
  count: number;
  benchmark: number;
};

type CategoryRow = {
  id: Exclude<ServiceCategoryId, 'all'>;
  label: string;
  orders: number;
  revenue: number;
  views: number;
  conversion: number;
  avgReadRate: number;
};

type CustomerRow = {
  name: string;
  maskedName: string;
  email: string;
  orders: number;
  spent: number;
  lastProduct: string;
  lastSeen: string;
  readRate: number;
};

type CustomerProfile = CustomerRow & {
  id: string;
  provider: 'kakao' | 'demo';
  signedAt: string;
  paidOrders: number;
  status: 'registered' | 'paid';
  sourceChannel: SourceChannel;
  device: DeviceType;
  segment: 'VIP' | '재구매 후보' | '신규' | '이탈 위험' | '가입만 완료';
  riskScore: number;
  nextAction: string;
};

type ChannelPerformanceRow = {
  label: SourceChannel;
  sessions: number;
  orders: number;
  revenue: number;
  conversion: number;
  estimatedSpend: number;
  estimatedCac: number;
  estimatedRoas: number;
  action: string;
};

type RetentionCohortRow = {
  key: string;
  label: string;
  customers: number;
  retention: number[];
};

type ExecutiveAlert = {
  id: string;
  severity: 'critical' | 'warning' | 'watch' | 'stable';
  title: string;
  metric: string;
  body: string;
  owner: string;
  sla: string;
};

const sampleChannels: SourceChannel[] = ['카카오', '네이버검색', '인스타그램', '직접방문', '재방문'];
const sampleDevices: DeviceType[] = ['mobile', 'mobile', 'mobile', 'desktop'];
const sampleAges = ['20대 후반', '30대 초반', '30대 후반', '40대 초반', '비공개'];
const chartColors = ['#111827', '#8a7258', '#2f6f68', '#b54708', '#7c3aed', '#475467'];

const sampleSeeds: Array<{
  productId: ServiceId;
  name: string;
  offsetHours: number;
  status?: AdminOrder['status'];
  reportStatus?: AdminOrder['reportStatus'];
  readRate: number;
  issueCount?: number;
  channel: SourceChannel;
  device: DeviceType;
  ageRange: string;
  reportLatencySec: number;
}> = [
  { productId: 'concern-reading', name: '차민호', offsetHours: 0.35, readRate: 96, channel: '카카오', device: 'mobile', ageRange: '30대 초반', reportLatencySec: 19 },
  { productId: 'general-signature', name: '김서연', offsetHours: 1.1, readRate: 91, channel: '네이버검색', device: 'mobile', ageRange: '30대 후반', reportLatencySec: 42 },
  { productId: 'love-reading', name: '이하준', offsetHours: 2.2, readRate: 78, issueCount: 1, channel: '인스타그램', device: 'mobile', ageRange: '20대 후반', reportLatencySec: 36 },
  { productId: 'life-flow', name: '박지아', offsetHours: 3.5, readRate: 83, channel: '직접방문', device: 'desktop', ageRange: '40대 초반', reportLatencySec: 28 },
  { productId: 'marriage-blueprint', name: '정도윤', offsetHours: 4.4, readRate: 94, channel: '재방문', device: 'mobile', ageRange: '30대 후반', reportLatencySec: 31 },
  { productId: 'match-couple', name: '한유진', offsetHours: 5.6, readRate: 87, channel: '카카오', device: 'mobile', ageRange: '30대 초반', reportLatencySec: 24 },
  { productId: 'concern-reading', name: '오민재', offsetHours: 7.5, status: 'pending', reportStatus: 'generating', readRate: 38, channel: '네이버검색', device: 'mobile', ageRange: '비공개', reportLatencySec: 68 },
  { productId: 'love-reunion', name: '윤하린', offsetHours: 9.2, readRate: 82, channel: '인스타그램', device: 'mobile', ageRange: '20대 후반', reportLatencySec: 33 },
  { productId: 'concern-reading', name: '서지후', offsetHours: 23.4, readRate: 93, channel: '카카오', device: 'mobile', ageRange: '30대 초반', reportLatencySec: 21 },
  { productId: 'general-signature', name: '강나은', offsetHours: 29.1, readRate: 89, channel: '재방문', device: 'desktop', ageRange: '40대 초반', reportLatencySec: 47 },
  { productId: 'marriage-timing', name: '문도현', offsetHours: 35.7, readRate: 72, channel: '네이버검색', device: 'mobile', ageRange: '30대 후반', reportLatencySec: 39 },
  { productId: 'match-destiny', name: '배수아', offsetHours: 45.2, readRate: 86, channel: '직접방문', device: 'desktop', ageRange: '30대 초반', reportLatencySec: 34 },
  { productId: 'concern-reading', name: '차민호', offsetHours: 55.8, readRate: 98, channel: '재방문', device: 'mobile', ageRange: '30대 초반', reportLatencySec: 18 },
  { productId: 'love-reading', name: '김서연', offsetHours: 66.4, readRate: 76, channel: '인스타그램', device: 'mobile', ageRange: '30대 후반', reportLatencySec: 41 },
  { productId: 'life-flow', name: '이하준', offsetHours: 77.9, status: 'failed', reportStatus: 'failed', readRate: 0, issueCount: 1, channel: '네이버검색', device: 'mobile', ageRange: '20대 후반', reportLatencySec: 120 },
  { productId: 'concern-reading', name: '박지아', offsetHours: 95.6, readRate: 90, channel: '카카오', device: 'mobile', ageRange: '40대 초반', reportLatencySec: 20 },
  { productId: 'general-signature', name: '정도윤', offsetHours: 111.5, readRate: 92, channel: '직접방문', device: 'desktop', ageRange: '30대 후반', reportLatencySec: 46 },
  { productId: 'love-reunion', name: '한유진', offsetHours: 130.2, readRate: 81, channel: '인스타그램', device: 'mobile', ageRange: '30대 초반', reportLatencySec: 35 },
  { productId: 'concern-reading', name: '오민재', offsetHours: 149.3, readRate: 84, channel: '카카오', device: 'mobile', ageRange: '비공개', reportLatencySec: 22 },
  { productId: 'match-couple', name: '윤하린', offsetHours: 166.7, readRate: 88, channel: '재방문', device: 'mobile', ageRange: '20대 후반', reportLatencySec: 37 }
];

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

function arrayBufferToHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashAdminCredential(adminId: string, password: string) {
  const encoded = new TextEncoder().encode(`${adminId.trim()}:${password}`);
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);
  return arrayBufferToHex(digest);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayLabel(dateKey: string) {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}/${Number(day)}`;
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

function getServiceAmount(productId: ServiceId) {
  return parsePrice(findServiceById(productId).price);
}

function getConversion(current: number, previous: number) {
  if (!previous) {
    return 0;
  }

  return (current / previous) * 100;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function toAdminOrder(report: ReportArchiveEntry, index: number): AdminOrder {
  const service = findServiceById(report.productId);
  const channel = sampleChannels[index % sampleChannels.length];

  return {
    id: report.id,
    orderId: report.orderId || report.id,
    productId: report.productId,
    productName: report.title || service.label,
    category: service.category,
    customerName: report.customerName,
    customerEmail: report.formData?.name ? `${report.formData.name}@local.customer` : undefined,
    amount: getServiceAmount(report.productId),
    status: 'paid',
    reportStatus: 'done',
    paymentMethod: report.paymentMethod || 'portone',
    createdAt: report.createdAt,
    readRate: Math.min(98, 74 + index * 5),
    issueCount: 0,
    source: 'real',
    sourceChannel: channel,
    device: sampleDevices[index % sampleDevices.length],
    ageRange: sampleAges[index % sampleAges.length],
    reportLatencySec: 22 + index * 4,
    analyticsEstimated: true,
    archive: report
  };
}

function buildSampleOrders(): AdminOrder[] {
  return sampleSeeds.map((seed, index) => {
    const service = findServiceById(seed.productId);
    const createdAt = new Date(Date.now() - seed.offsetHours * 1000 * 60 * 60).toISOString();

    return {
      id: `sample-${seed.productId}-${index}`,
      orderId: `UW-SAMPLE-${String(index + 1).padStart(4, '0')}`,
      productId: seed.productId,
      productName: service.label,
      category: service.category,
      customerName: seed.name,
      customerEmail: `${seed.name.toLowerCase()}@kakao.sample`,
      amount: parsePrice(service.price),
      status: seed.status || 'paid',
      reportStatus: seed.reportStatus || 'done',
      paymentMethod: index % 3 === 0 ? 'kakaoPay' : 'portone',
      createdAt,
      readRate: seed.readRate,
      issueCount: seed.issueCount || 0,
      source: 'sample',
      sourceChannel: seed.channel,
      device: seed.device,
      ageRange: seed.ageRange,
      reportLatencySec: seed.reportLatencySec,
      analyticsEstimated: true
    };
  });
}

function countToday(orders: AdminOrder[]) {
  const today = new Date().toDateString();
  return orders.filter((order) => new Date(order.createdAt).toDateString() === today);
}

function filterOrdersByPeriod(orders: AdminOrder[], period: AdminPeriod) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (period === '7d') {
    start.setDate(start.getDate() - 6);
  }

  if (period === '30d') {
    start.setDate(start.getDate() - 29);
  }

  return orders.filter((order) => new Date(order.createdAt).getTime() >= start.getTime());
}

function filterOrdersByPreviousPeriod(orders: AdminOrder[], period: AdminPeriod) {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setHours(0, 0, 0, 0);

  if (period === '7d') {
    currentStart.setDate(currentStart.getDate() - 6);
  }

  if (period === '30d') {
    currentStart.setDate(currentStart.getDate() - 29);
  }

  const elapsed = now.getTime() - currentStart.getTime();
  const previousEnd = currentStart.getTime() - 1;
  const previousStart = previousEnd - elapsed;

  return orders.filter((order) => {
    const createdAt = new Date(order.createdAt).getTime();
    return createdAt >= previousStart && createdAt <= previousEnd;
  });
}

function getPeriodDays(period: AdminPeriod) {
  return period === 'today' ? 1 : period === '7d' ? 7 : 30;
}

function getChangeRate(current: number, previous: number): number | undefined {
  if (!previous) {
    return current ? undefined : 0;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatChangeRate(value?: number) {
  if (typeof value !== 'number') {
    return '비교 기준 없음';
  }

  const direction = value > 0 ? '+' : '';
  return `${direction}${value.toFixed(1)}%`;
}

function buildFunnel(orders: AdminOrder[]): FunnelStep[] {
  const paidCount = orders.filter((order) => order.status === 'paid').length;
  const reportViews = orders.filter((order) => order.reportStatus === 'done').length;
  const checkout = Math.max(orders.length + 18, Math.ceil(paidCount * 2.1));
  const formComplete = Math.max(checkout + 31, Math.ceil(checkout * 1.42));
  const formStart = Math.max(formComplete + 44, Math.ceil(formComplete * 1.52));
  const detail = Math.max(formStart + 76, Math.ceil(formStart * 1.76));
  const home = Math.max(detail + 160, Math.ceil(detail * 2.05));

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

function buildCustomerRows(orders: AdminOrder[]): CustomerRow[] {
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

function buildCustomerProfiles(customers: CustomerRow[], orders: AdminOrder[], includeSampleSignups: boolean): CustomerProfile[] {
  const profiles = customers.map((customer, index) => {
    const customerOrders = orders
      .filter((order) => order.customerName === customer.name)
      .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt));
    const paidOrders = customerOrders.filter((order) => order.status === 'paid');
    const firstOrder = customerOrders[customerOrders.length - 1] || customerOrders[0];
    const latestOrder = customerOrders[0];
    const riskScore = Math.max(0, Math.min(100, 100 - customer.readRate + (customer.orders === 1 ? 12 : 0)));
    const segment =
      customer.orders >= 2 || customer.spent >= 79000
        ? 'VIP'
        : customer.readRate >= 88
          ? '재구매 후보'
          : customer.readRate < 70
            ? '이탈 위험'
            : '신규';

    return {
      ...customer,
      id: `customer-${customer.name}`,
      provider: latestOrder?.paymentMethod === 'kakaoPay' ? 'kakao' : 'demo',
      signedAt: new Date(new Date(firstOrder?.createdAt || customer.lastSeen).getTime() - (index + 1) * 1000 * 60 * 45).toISOString(),
      paidOrders: paidOrders.length,
      status: paidOrders.length ? 'paid' : 'registered',
      sourceChannel: latestOrder?.sourceChannel || sampleChannels[index % sampleChannels.length],
      device: latestOrder?.device || sampleDevices[index % sampleDevices.length],
      segment,
      riskScore,
      nextAction:
        segment === 'VIP'
          ? '고가 종합사주, 궁합, 결혼운을 묶은 프리미엄 추천'
          : segment === '재구매 후보'
            ? '읽은 리포트와 이어지는 다음 상품 배너 노출'
            : segment === '이탈 위험'
              ? '생성 지연, 오타 신고, 첫 화면 이탈 여부 확인'
              : '첫 결제 후 리포트 보관함과 추천 상품 안내'
    } satisfies CustomerProfile;
  });

  if (!includeSampleSignups) {
    return profiles;
  }

  const now = Date.now();
  const signupOnly: CustomerProfile[] = [
    {
      id: 'signup-only-1',
      name: '최라온',
      maskedName: '최*온',
      email: 'ra***@kakao.sample',
      orders: 0,
      paidOrders: 0,
      spent: 0,
      lastProduct: '가입 후 상품 탐색',
      lastSeen: new Date(now - 1000 * 60 * 24).toISOString(),
      readRate: 0,
      provider: 'kakao',
      signedAt: new Date(now - 1000 * 60 * 31).toISOString(),
      status: 'registered',
      sourceChannel: '카카오',
      device: 'mobile',
      segment: '가입만 완료',
      riskScore: 71,
      nextAction: '첫 결제 유도용 2,900원 고민풀이 쿠폰 또는 홈 상단 추천'
    },
    {
      id: 'signup-only-2',
      name: '신아린',
      maskedName: '신*린',
      email: 'ar***@kakao.sample',
      orders: 0,
      paidOrders: 0,
      spent: 0,
      lastProduct: '결제창 전 이탈',
      lastSeen: new Date(now - 1000 * 60 * 76).toISOString(),
      readRate: 0,
      provider: 'kakao',
      signedAt: new Date(now - 1000 * 60 * 102).toISOString(),
      status: 'registered',
      sourceChannel: '인스타그램',
      device: 'mobile',
      segment: '가입만 완료',
      riskScore: 84,
      nextAction: '결제 직전 이탈 고객으로 가격 안내와 제공 항목을 다시 노출'
    }
  ];

  return [...profiles, ...signupOnly];
}

function filterCustomerProfiles(profiles: CustomerProfile[], filter: CustomerFilter) {
  if (filter === 'registered') {
    return profiles.filter((profile) => profile.status === 'registered');
  }

  if (filter === 'paid') {
    return profiles.filter((profile) => profile.paidOrders > 0);
  }

  if (filter === 'vip') {
    return profiles.filter((profile) => profile.segment === 'VIP' || profile.segment === '재구매 후보');
  }

  if (filter === 'risk') {
    return profiles.filter((profile) => profile.segment === '이탈 위험' || profile.segment === '가입만 완료' || profile.riskScore >= 65);
  }

  return profiles;
}

function buildIssueRows(orders: AdminOrder[]) {
  const issueOrders = orders.filter((order) => order.issueCount > 0 || order.status === 'failed' || order.reportStatus === 'failed');
  const issueTypes = ['오타 신고', '계산 불일치 확인', '결제 문의', '리포트 생성 지연'];

  return issueOrders.map((order, index) => ({
    id: `${order.id}-issue-${index}`,
    type: issueTypes[index % issueTypes.length],
    customer: maskName(order.customerName),
    product: order.productName,
    orderId: order.orderId,
    status: index === 0 ? '검수 필요' : index === 1 ? '처리 중' : '대기',
    severity: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
    createdAt: order.createdAt
  }));
}

function buildCategoryRows(orders: AdminOrder[]): CategoryRow[] {
  return serviceCategories
    .filter((category): category is typeof category & { id: Exclude<ServiceCategoryId, 'all'> } => category.id !== 'all')
    .map((category) => {
      const categoryOrders = orders.filter((order) => order.category === category.id);
      const paidOrders = categoryOrders.filter((order) => order.status === 'paid');
      const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
      const views = Math.max(categoryOrders.length * 28 + 48, paidOrders.length * 31);

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

function buildDailyTrend(orders: AdminOrder[]) {
  const dayKeys = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return getDateKey(date);
  });

  return dayKeys.map((key) => {
    const dayOrders = orders.filter((order) => getDateKey(new Date(order.createdAt)) === key);
    const paidOrders = dayOrders.filter((order) => order.status === 'paid');
    const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
    const visitors = Math.max(28, dayOrders.length * 34 + Math.round(revenue / 9000));

    return {
      key,
      label: formatDayLabel(key),
      orders: paidOrders.length,
      revenue,
      visitors,
      conversion: getConversion(paidOrders.length, visitors)
    };
  });
}

function buildHourlyRows(orders: AdminOrder[]) {
  const todayOrders = countToday(orders);
  const source = todayOrders.length ? todayOrders : orders;
  const rows = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}시`,
    orders: 0,
    revenue: 0
  }));

  source.forEach((order) => {
    const hour = new Date(order.createdAt).getHours();
    rows[hour].orders += order.status === 'paid' ? 1 : 0;
    rows[hour].revenue += order.status === 'paid' ? order.amount : 0;
  });

  return rows;
}

function buildChannelRows(orders: AdminOrder[]) {
  return sampleChannels.map((channel) => {
    const channelOrders = orders.filter((order) => order.sourceChannel === channel);
    const paidOrders = channelOrders.filter((order) => order.status === 'paid');
    const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);

    return {
      label: channel,
      value: paidOrders.length,
      revenue,
      conversion: getConversion(paidOrders.length, Math.max(channelOrders.length * 12, paidOrders.length + 1))
    };
  });
}

function buildChannelPerformanceRows(orders: AdminOrder[]): ChannelPerformanceRow[] {
  return sampleChannels
    .map((channel) => {
      const channelOrders = orders.filter((order) => order.sourceChannel === channel);
      const paidOrders = channelOrders.filter((order) => order.status === 'paid');
      const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
      const sessions = Math.max(channelOrders.length * 12, paidOrders.length * 18 + (channel === '직접방문' ? 9 : 16));
      const isOwnedChannel = channel === '직접방문' || channel === '재방문';
      const estimatedSpend = isOwnedChannel
        ? 0
        : Math.round(Math.max(12000, revenue * 0.16 + sessions * 38));
      const estimatedCac = paidOrders.length ? estimatedSpend / paidOrders.length : 0;
      const estimatedRoas = estimatedSpend ? getConversion(revenue, estimatedSpend) : 0;
      const conversion = getConversion(paidOrders.length, sessions);
      const action =
        channel === '재방문'
          ? '보관함과 후속 상품 추천을 강화'
          : channel === '직접방문'
            ? '브랜드 검색과 즐겨찾기 전환을 추적'
            : estimatedRoas >= 350
              ? '예산을 10%씩 늘리며 효율 확인'
              : conversion < 2
                ? '랜딩 문구와 키워드 일치도를 점검'
                : '소재별 결제 전환을 분리 측정';

      return {
        label: channel,
        sessions,
        orders: paidOrders.length,
        revenue,
        conversion,
        estimatedSpend,
        estimatedCac,
        estimatedRoas,
        action
      };
    })
    .sort((left, right) => right.revenue - left.revenue);
}

function getWeekStart(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const distance = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - distance);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function buildRetentionCohorts(profiles: CustomerProfile[]): RetentionCohortRow[] {
  const grouped = new Map<string, CustomerProfile[]>();

  profiles.forEach((profile) => {
    const weekStart = getWeekStart(new Date(profile.signedAt));
    const key = getDateKey(weekStart);
    grouped.set(key, [...(grouped.get(key) || []), profile]);
  });

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 6)
    .reverse()
    .map(([key, cohortProfiles]) => {
      const retainedDay1 = cohortProfiles.filter((profile) => profile.paidOrders > 0).length;
      const retainedDay3 = cohortProfiles.filter((profile) => profile.readRate >= 75 || profile.paidOrders > 1).length;
      const retainedDay7 = cohortProfiles.filter((profile) => profile.paidOrders > 1 || profile.segment === 'VIP').length;
      const retainedDay14 = cohortProfiles.filter((profile) => profile.paidOrders > 1 && profile.readRate >= 80).length;

      return {
        key,
        label: `${formatDayLabel(key)} 주`,
        customers: cohortProfiles.length,
        retention: [
          100,
          getConversion(retainedDay1, cohortProfiles.length),
          getConversion(retainedDay3, cohortProfiles.length),
          getConversion(retainedDay7, cohortProfiles.length),
          getConversion(retainedDay14, cohortProfiles.length)
        ]
      };
    });
}

function buildDeviceRows(orders: AdminOrder[]) {
  return (['mobile', 'desktop'] as DeviceType[]).map((device) => {
    const deviceOrders = orders.filter((order) => order.device === device);
    const paidOrders = deviceOrders.filter((order) => order.status === 'paid');
    const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);

    return {
      label: device === 'mobile' ? '모바일' : '데스크톱',
      value: paidOrders.length,
      revenue
    };
  });
}

function buildProductRows(orders: AdminOrder[]) {
  const paidOrders = orders.filter((order) => order.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);

  return serviceCatalog
    .map((service) => {
      const serviceOrders = paidOrders.filter((order) => order.productId === service.id);
      const revenue = serviceOrders.reduce((sum, order) => sum + order.amount, 0);
      const avgReadRate = serviceOrders.length
        ? Math.round(serviceOrders.reduce((sum, order) => sum + order.readRate, 0) / serviceOrders.length)
        : 0;
      const estimatedViews = Math.max(serviceOrders.length * 24 + 24, serviceOrders.length + 1);

      return {
        id: service.id,
        label: service.label,
        category: service.category,
        orders: serviceOrders.length,
        revenue,
        share: getConversion(revenue, totalRevenue || 1),
        conversion: getConversion(serviceOrders.length, estimatedViews),
        avgReadRate
      };
    })
    .sort((left, right) => right.revenue - left.revenue);
}

function buildCustomerSegments(customers: CustomerRow[]) {
  const vip = customers.filter((customer) => customer.orders >= 2 || customer.spent >= 79000).length;
  const highIntent = customers.filter((customer) => customer.readRate >= 88).length;
  const newCustomers = customers.filter((customer) => customer.orders === 1).length;
  const risk = customers.filter((customer) => customer.readRate < 70).length;

  return [
    { label: 'VIP/고액 고객', value: vip, note: '종합사주·궁합 업셀 대상', icon: Sparkles },
    { label: '고관여 고객', value: highIntent, note: '90% 가까이 읽은 재구매 후보', icon: Eye },
    { label: '신규 고객', value: newCustomers, note: '첫 결제 후 온보딩 필요', icon: UserRound },
    { label: '이탈 위험', value: risk, note: '열람 낮음·생성 지연 체크', icon: AlertTriangle }
  ];
}

function getLargestDrop(funnel: FunnelStep[]) {
  return funnel.slice(1).reduce(
    (worst, step, index) => {
      const prev = funnel[index];
      const drop = 100 - getConversion(step.count, prev.count);

      return drop > worst.drop
        ? {
            label: `${prev.label} → ${step.label}`,
            drop
          }
        : worst;
    },
    { label: '이탈 없음', drop: 0 }
  );
}

function MetricCard({
  title,
  value,
  delta,
  trend,
  trendLabel = '이전 기간',
  tone,
  icon: Icon
}: {
  title: string;
  value: string;
  delta: string;
  trend?: number;
  trendLabel?: string;
  tone?: 'good' | 'warn' | 'blue';
  icon: IconComponent;
}) {
  const TrendIcon = typeof trend === 'number' && trend < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <article className={`admin-metric-card ${tone || ''}`}>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <p>{delta}</p>
        {typeof trend === 'number' ? (
          <small className={`admin-metric-trend ${trend < 0 ? 'down' : trend > 0 ? 'up' : ''}`}>
            <TrendIcon size={13} /> {formatChangeRate(trend)} <em>{trendLabel}</em>
          </small>
        ) : null}
      </div>
      <Icon size={22} />
    </article>
  );
}

function RevenueTrendChart({
  data
}: {
  data: ReturnType<typeof buildDailyTrend>;
}) {
  const width = 420;
  const height = 176;
  const paddingX = 18;
  const paddingTop = 18;
  const paddingBottom = 38;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxRevenue = Math.max(1, ...data.map((point) => point.revenue));
  const points = data.map((point, index) => {
    const x = paddingX + (index / Math.max(1, data.length - 1)) * (width - paddingX * 2);
    const y = paddingTop + chartHeight - (point.revenue / maxRevenue) * chartHeight;
    return { ...point, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${paddingX},${height - paddingBottom} ${polyline} ${width - paddingX},${height - paddingBottom}`;

  return (
    <div className="admin-chart-card admin-trend-card">
      <div className="admin-chart-head">
        <div>
          <span>매출 추이</span>
          <h3>최근 7일 매출 추이</h3>
        </div>
        <strong>{formatCurrency(data.reduce((sum, point) => sum + point.revenue, 0))}</strong>
      </div>
      <svg className="admin-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="최근 7일 매출 추이 그래프">
        <polygon points={area} />
        <polyline points={polyline} />
        {points.map((point) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="4" />
            <text x={point.x} y={height - 16} textAnchor="middle">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function HourlyBarChart({
  data
}: {
  data: ReturnType<typeof buildHourlyRows>;
}) {
  const maxOrders = Math.max(1, ...data.map((row) => row.orders));

  return (
    <div className="admin-chart-card">
      <div className="admin-chart-head">
        <div>
          <span>시간대 분석</span>
          <h3>시간대별 결제</h3>
        </div>
        <strong>{data.reduce((sum, row) => sum + row.orders, 0)}건</strong>
      </div>
      <div className="admin-hour-bars" aria-label="시간대별 결제 막대그래프">
        {data.map((row) => (
          <div key={row.hour} title={`${row.label} ${row.orders}건`}>
            <span>
              <i style={{ height: `${Math.max(6, (row.orders / maxOrders) * 100)}%` }} />
            </span>
            {row.hour % 3 === 0 ? <em>{row.hour}</em> : <em />}
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({
  title,
  rows,
  centerLabel
}: {
  title: string;
  rows: Array<{ label: string; value: number; revenue?: number }>;
  centerLabel: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  let cursor = 0;
  const gradient = rows
    .map((row, index) => {
      const start = cursor;
      const end = cursor + (row.value / total) * 360;
      cursor = end;
      return `${chartColors[index % chartColors.length]} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div className="admin-chart-card admin-donut-card">
      <div className="admin-chart-head">
        <div>
          <span>분포 분석</span>
          <h3>{title}</h3>
        </div>
        <PieChart size={18} />
      </div>
      <div className="admin-donut-wrap">
        <div className="admin-donut" style={{ background: `conic-gradient(${gradient})` }}>
          <div>
            <strong>{total}</strong>
            <span>{centerLabel}</span>
          </div>
        </div>
        <div className="admin-donut-legend">
          {rows.map((row, index) => (
            <div key={row.label}>
              <i style={{ background: chartColors[index % chartColors.length] }} />
              <span>{row.label}</span>
              <b>{row.value}건</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  value,
  body,
  icon: Icon,
  tone
}: {
  title: string;
  value: string;
  body: string;
  icon: IconComponent;
  tone?: 'warn' | 'good';
}) {
  return (
    <article className={`admin-insight-card ${tone || ''}`}>
      <Icon size={18} />
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{body}</p>
    </article>
  );
}

function CustomerJourneyMap({
  funnel,
  largestDrop
}: {
  funnel: FunnelStep[];
  largestDrop: ReturnType<typeof getLargestDrop>;
}) {
  return (
    <article className="admin-command-panel admin-journey-map">
      <div className="admin-command-head">
        <div>
          <span>실시간 고객 여정</span>
          <h2>고객 흐름 지도</h2>
        </div>
        <strong>핵심 병목 {formatPercent(largestDrop.drop)}</strong>
      </div>
      <div className="admin-journey-line" aria-label="고객 여정 단계">
        {funnel.map((step, index) => {
          const isCritical = largestDrop.label.includes(step.label);
          const width = clamp(getConversion(step.count, funnel[0].count), 8, 100);

          return (
            <div key={step.key} className={isCritical ? 'critical' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.label}</strong>
              <b>{step.count.toLocaleString('ko-KR')}</b>
              <i>
                <em style={{ width: `${width}%` }} />
              </i>
              <small>{index === 0 ? '방문 시작' : `${formatPercent(step.benchmark)} 전환`}</small>
            </div>
          );
        })}
      </div>
      <div className="admin-journey-callout">
        <AlertTriangle size={17} />
        <p>
          <strong>{largestDrop.label}</strong>
          <span>이 구간의 문구, 로딩, 가격 안내, 버튼 위치를 먼저 손보면 매출 개선 가능성이 가장 큽니다.</span>
        </p>
      </div>
    </article>
  );
}

function HealthRadar({
  items
}: {
  items: Array<{ label: string; value: number; display: string; note: string }>;
}) {
  const size = 240;
  const center = size / 2;
  const radius = 82;
  const axis = items.map((item, index) => {
    const angle = (-90 + (360 / items.length) * index) * (Math.PI / 180);
    return {
      ...item,
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      pointX: center + Math.cos(angle) * radius * (clamp(item.value) / 100),
      pointY: center + Math.sin(angle) * radius * (clamp(item.value) / 100),
      labelX: center + Math.cos(angle) * (radius + 24),
      labelY: center + Math.sin(angle) * (radius + 24)
    };
  });
  const polygon = axis.map((item) => `${item.pointX},${item.pointY}`).join(' ');
  const average = Math.round(items.reduce((sum, item) => sum + clamp(item.value), 0) / items.length);

  return (
    <article className="admin-command-panel admin-health-radar">
      <div className="admin-command-head">
        <div>
          <span>운영 건강도</span>
          <h2>운영 건강도</h2>
        </div>
        <strong>{average}점</strong>
      </div>
      <div className="admin-radar-wrap">
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="운영 건강도 레이더 차트">
          {[0.35, 0.7, 1].map((scale) => (
            <polygon
              key={scale}
              points={axis
                .map((item) => `${center + (item.x - center) * scale},${center + (item.y - center) * scale}`)
                .join(' ')}
            />
          ))}
          {axis.map((item) => (
            <line key={item.label} x1={center} y1={center} x2={item.x} y2={item.y} />
          ))}
          <polygon className="score" points={polygon} />
          {axis.map((item) => (
            <g key={item.label}>
              <circle cx={item.pointX} cy={item.pointY} r="4" />
              <text x={item.labelX} y={item.labelY} textAnchor="middle">
                {item.label}
              </text>
            </g>
          ))}
        </svg>
        <div className="admin-radar-list">
          {items.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.display}</strong>
              <small>{item.note}</small>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function ProductHeatmap({
  rows
}: {
  rows: ReturnType<typeof buildProductRows>;
}) {
  const maxOrders = Math.max(1, ...rows.map((row) => row.orders));
  const visibleRows = rows.slice(0, 7);
  const cells = [
    { key: 'share', label: '매출비중', get: (row: (typeof rows)[number]) => row.share, display: (value: number) => formatPercent(value) },
    { key: 'orders', label: '주문', get: (row: (typeof rows)[number]) => getConversion(row.orders, maxOrders), display: (_value: number, row: (typeof rows)[number]) => `${row.orders}건` },
    { key: 'conversion', label: '전환', get: (row: (typeof rows)[number]) => row.conversion, display: (value: number) => formatPercent(value) },
    { key: 'read', label: '열람', get: (row: (typeof rows)[number]) => row.avgReadRate, display: (value: number) => `${Math.round(value)}%` }
  ];

  return (
    <article className="admin-command-panel admin-product-heatmap">
      <div className="admin-command-head">
        <div>
          <span>상품 성과</span>
          <h2>상품별 성과 온도</h2>
        </div>
        <strong>{visibleRows.length}개 상품</strong>
      </div>
      <div className="admin-heatmap-grid">
        <span />
        {cells.map((cell) => (
          <b key={cell.key}>{cell.label}</b>
        ))}
        {visibleRows.map((row) => (
          <div className="admin-heatmap-row" key={row.id}>
            <strong>{row.label}</strong>
            {cells.map((cell) => {
              const value = clamp(cell.get(row));
              const dark = value > 52;

              return (
                <span
                  key={cell.key}
                  className={dark ? 'hot' : ''}
                  style={{ backgroundColor: `rgba(17, 24, 39, ${0.07 + value / 145})` }}
                >
                  {cell.display(value, row)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </article>
  );
}

function ActionCommand({
  actions
}: {
  actions: Array<{ status: string; title: string; body: string; tone?: 'warn' | 'good' }>;
}) {
  return (
    <article className="admin-command-panel admin-action-command">
      <div className="admin-command-head">
        <div>
          <span>오늘 우선순위</span>
          <h2>오늘 액션 큐</h2>
        </div>
        <strong>{actions.length}개</strong>
      </div>
      <div className="admin-action-list">
        {actions.map((action, index) => (
          <div key={action.title} className={action.tone || ''}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <b>{action.status}</b>
              <strong>{action.title}</strong>
              <p>{action.body}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function LiveActivityFeed({
  orders,
  onSelectOrder
}: {
  orders: AdminOrder[];
  onSelectOrder: (orderId: string) => void;
}) {
  const recentOrders = [...orders]
    .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))
    .slice(0, 6);
  const statusLabels: Record<AdminOrder['status'], string> = {
    paid: '결제 완료',
    pending: '결제 대기',
    failed: '결제 실패',
    refunded: '환불 완료'
  };

  return (
    <article className="admin-command-panel admin-live-feed">
      <div className="admin-command-head">
        <div>
          <span>실시간 활동</span>
          <h2>최근 결제·리포트</h2>
        </div>
        <strong className="admin-live-status"><i /> LIVE</strong>
      </div>
      <div className="admin-live-list">
        {recentOrders.length ? recentOrders.map((order) => (
          <button key={order.id} type="button" onClick={() => onSelectOrder(order.id)}>
            <i className={`admin-live-dot ${order.status}`} />
            <span>
              <strong>{maskName(order.customerName)} · {order.productName}</strong>
              <small>{order.orderId}</small>
            </span>
            <b>{statusLabels[order.status]}</b>
            <time>{formatDateTime(order.createdAt)}</time>
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        )) : (
          <p className="admin-live-empty">선택한 기간에 기록된 활동이 없습니다.</p>
        )}
      </div>
    </article>
  );
}

function ExecutiveCommandCenter({
  healthScore,
  forecastRevenue,
  opportunityRevenue,
  repeatRate,
  largestDrop,
  bestChannel,
  periodLabel,
  isEstimated
}: {
  healthScore: number;
  forecastRevenue: number;
  opportunityRevenue: number;
  repeatRate: number;
  largestDrop: ReturnType<typeof getLargestDrop>;
  bestChannel?: ChannelPerformanceRow;
  periodLabel: string;
  isEstimated: boolean;
}) {
  const status = healthScore >= 85 ? '안정 성장' : healthScore >= 70 ? '개선 여지' : '집중 점검';

  return (
    <article className="admin-executive-board">
      <div className="admin-executive-head">
        <div>
          <span>경영 판단 요약</span>
          <h2>오늘의 운영 결론</h2>
        </div>
        <div className="admin-estimate-badge">
          <Gauge size={14} /> {isEstimated ? '기록 기반 추정 지표 포함' : '실측 이벤트 기반'}
        </div>
      </div>

      <div className="admin-executive-body">
        <div className="admin-score-block">
          <div
            className="admin-score-ring"
            style={{ background: `conic-gradient(#23a094 ${clamp(healthScore) * 3.6}deg, rgba(255,255,255,.12) 0deg)` }}
            aria-label={`운영 건강도 ${healthScore}점`}
          >
            <div>
              <strong>{healthScore}</strong>
              <span>/ 100</span>
            </div>
          </div>
          <p>
            <strong>{status}</strong>
            <span>{periodLabel} 운영 건강도</span>
          </p>
        </div>

        <div className="admin-executive-kpis">
          <div>
            <span>30일 매출 전망 <em>추정</em></span>
            <strong>{formatCurrency(forecastRevenue)}</strong>
            <small>현재 선택 기간의 일평균을 월 단위로 환산</small>
          </div>
          <div>
            <span>회수 가능 매출 <em>추정</em></span>
            <strong>{formatCurrency(opportunityRevenue)}</strong>
            <small>핵심 병목 전환율 5%p 개선 시</small>
          </div>
          <div>
            <span>재구매 고객 비중</span>
            <strong>{formatPercent(repeatRate)}</strong>
            <small>결제 고객 중 두 번 이상 구매한 비율</small>
          </div>
          <div>
            <span>최고 효율 채널 <em>추정</em></span>
            <strong>{bestChannel?.label || '데이터 없음'}</strong>
            <small>{bestChannel?.estimatedRoas ? `ROAS ${Math.round(bestChannel.estimatedRoas)}%` : '자연 유입 채널'}</small>
          </div>
        </div>
      </div>

      <div className="admin-executive-decision">
        <Target size={18} />
        <p>
          <span>가장 먼저 손볼 곳</span>
          <strong>{largestDrop.label}</strong>
          <small>기능을 더 늘리기보다 이 구간의 이탈 원인부터 제거해야 같은 유입으로 더 많은 매출을 만들 수 있습니다.</small>
        </p>
      </div>
    </article>
  );
}

function DecisionAlertCenter({ alerts }: { alerts: ExecutiveAlert[] }) {
  const urgentCount = alerts.filter((alert) => alert.severity === 'critical' || alert.severity === 'warning').length;

  return (
    <article className="admin-command-panel admin-alert-center">
      <div className="admin-command-head">
        <div>
          <span>관제 알림과 SLA</span>
          <h2>운영 리스크 센터</h2>
        </div>
        <strong className={urgentCount ? 'warn' : 'good'}>{urgentCount ? `${urgentCount}건 조치` : '정상'}</strong>
      </div>
      <div className="admin-alert-list">
        {alerts.map((alert) => (
          <div key={alert.id} className={alert.severity}>
            <span className="admin-alert-severity">{alert.severity === 'critical' ? '긴급' : alert.severity === 'warning' ? '주의' : alert.severity === 'watch' ? '관찰' : '정상'}</span>
            <div>
              <strong>{alert.title}</strong>
              <p>{alert.body}</p>
            </div>
            <b>{alert.metric}</b>
            <small>{alert.owner} · {alert.sla}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function ChannelEfficiencyTable({ rows }: { rows: ChannelPerformanceRow[] }) {
  return (
    <article className="admin-command-panel admin-channel-efficiency">
      <div className="admin-command-head">
        <div>
          <span>획득 효율</span>
          <h2>채널별 매출·CAC·ROAS</h2>
        </div>
        <strong>비용 추정</strong>
      </div>
      <div className="admin-channel-table-wrap">
        <div className="admin-channel-table">
          <div className="head">
            <span>채널</span>
            <span>세션</span>
            <span>결제</span>
            <span>전환</span>
            <span>매출</span>
            <span>CAC</span>
            <span>ROAS</span>
            <span>권장 액션</span>
          </div>
          {rows.map((row) => (
            <div key={row.label}>
              <strong>{row.label}</strong>
              <span>{row.sessions.toLocaleString('ko-KR')}</span>
              <span>{row.orders}건</span>
              <span>{formatPercent(row.conversion)}</span>
              <b>{formatCurrency(row.revenue)}</b>
              <span>{row.estimatedSpend ? formatCurrency(row.estimatedCac) : '자연유입'}</span>
              <em className={row.estimatedRoas >= 350 ? 'good' : row.estimatedSpend ? 'warn' : ''}>
                {row.estimatedSpend ? `${Math.round(row.estimatedRoas)}%` : '-'}
              </em>
              <p>{row.action}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="admin-estimate-note">광고비가 아직 연결되지 않아 CAC와 ROAS는 매출·세션 기반 추정값입니다. 광고 플랫폼 비용 API 연결 시 실측값으로 자동 교체할 수 있습니다.</p>
    </article>
  );
}

function RetentionCohortMatrix({ rows }: { rows: RetentionCohortRow[] }) {
  const columns = ['가입', 'D+1', 'D+3', 'D+7', 'D+14'];

  return (
    <article className="admin-command-panel admin-cohort-panel">
      <div className="admin-command-head">
        <div>
          <span>고객 유지 신호</span>
          <h2>가입 코호트</h2>
        </div>
        <strong>행동 기반 추정</strong>
      </div>
      <div className="admin-cohort-grid">
        <span>가입 주차</span>
        {columns.map((column) => <b key={column}>{column}</b>)}
        {rows.length ? rows.map((row) => (
          <div className="admin-cohort-row" key={row.key}>
            <strong>{row.label}<small>{row.customers}명</small></strong>
            {row.retention.map((value, index) => (
              <span
                key={`${row.key}-${columns[index]}`}
                className={value >= 65 ? 'strong' : value >= 35 ? 'medium' : ''}
                style={{ '--cohort-alpha': `${0.08 + clamp(value) / 118}` } as CSSProperties}
                title={`${row.label} ${columns[index]} ${formatPercent(value)}`}
              >
                {Math.round(value)}%
              </span>
            ))}
          </div>
        )) : <p>선택한 기간에 코호트 데이터가 없습니다.</p>}
      </div>
      <p className="admin-estimate-note">가입 이후 결제, 열람, 재구매 신호를 묶은 운영용 코호트입니다. 이벤트 DB 연결 전에는 실제 재방문율과 다를 수 있습니다.</p>
    </article>
  );
}

function ProductPortfolioMatrix({ rows }: { rows: ReturnType<typeof buildProductRows> }) {
  const visibleRows = rows.filter((row) => row.orders > 0).slice(0, 8);
  const width = 560;
  const height = 268;
  const left = 46;
  const right = 22;
  const top = 20;
  const bottom = 42;
  const maxConversion = Math.max(1, ...visibleRows.map((row) => row.conversion));
  const points = visibleRows.map((row, index) => ({
    ...row,
    index: index + 1,
    x: left + (row.conversion / maxConversion) * (width - left - right),
    y: top + (1 - row.avgReadRate / 100) * (height - top - bottom),
    radius: clamp(8 + row.share / 6, 8, 22)
  }));

  return (
    <article className="admin-command-panel admin-product-portfolio">
      <div className="admin-command-head">
        <div>
          <span>상품 포트폴리오</span>
          <h2>전환율과 고객 몰입도</h2>
        </div>
        <strong>원 크기 = 매출 비중</strong>
      </div>
      <div className="admin-portfolio-layout">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="상품 전환율과 열람률 포트폴리오">
          <line className="axis" x1={left} y1={top} x2={left} y2={height - bottom} />
          <line className="axis" x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} />
          <line className="guide" x1={(left + width - right) / 2} y1={top} x2={(left + width - right) / 2} y2={height - bottom} />
          <line className="guide" x1={left} y1={(top + height - bottom) / 2} x2={width - right} y2={(top + height - bottom) / 2} />
          <text className="quadrant" x={left + 8} y={top + 14}>몰입 높음 · 전환 개선</text>
          <text className="quadrant" x={width - right - 8} y={top + 14} textAnchor="end">핵심 성장 상품</text>
          <text className="quadrant" x={left + 8} y={height - bottom - 10}>정리 후보</text>
          <text className="quadrant" x={width - right - 8} y={height - bottom - 10} textAnchor="end">첫 화면 보강</text>
          <text className="axis-label" x={12} y={(top + height - bottom) / 2} transform={`rotate(-90 12 ${(top + height - bottom) / 2})`} textAnchor="middle">열람률</text>
          <text className="axis-label" x={(left + width - right) / 2} y={height - 12} textAnchor="middle">결제 전환율</text>
          {points.map((point) => (
            <g key={point.id} className="portfolio-point">
              <circle cx={point.x} cy={point.y} r={point.radius} />
              <text x={point.x} y={point.y + 4} textAnchor="middle">{point.index}</text>
              <title>{`${point.label}: 전환 ${formatPercent(point.conversion)}, 열람 ${point.avgReadRate}%`}</title>
            </g>
          ))}
        </svg>
        <div className="admin-portfolio-legend">
          {points.map((point) => (
            <div key={point.id}>
              <span>{point.index}</span>
              <p><strong>{point.label}</strong><small>전환 {formatPercent(point.conversion)} · 열람 {point.avgReadRate}%</small></p>
              <b>{formatCurrency(point.revenue)}</b>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function CustomerDetailPanel({
  profile,
  orders,
  onSelectOrder
}: {
  profile?: CustomerProfile;
  orders: AdminOrder[];
  onSelectOrder: (orderId: string) => void;
}) {
  if (!profile) {
    return (
      <article className="admin-detail-panel empty">
        <strong>고객을 선택하세요</strong>
        <p>가입 고객이나 결제 고객 카드를 클릭하면 상세 정보가 표시됩니다.</p>
      </article>
    );
  }

  const customerOrders = orders
    .filter((order) => order.customerName === profile.name)
    .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt));
  const firstPaidOrder = [...customerOrders].reverse().find((order) => order.status === 'paid');
  const latestOrder = customerOrders[0];
  const journeyRows = [
    { label: '가입', value: formatDateTime(profile.signedAt), status: '완료' },
    { label: '첫 결제', value: firstPaidOrder ? formatDateTime(firstPaidOrder.createdAt) : '아직 없음', status: firstPaidOrder ? '완료' : '전환 필요' },
    { label: '최근 상품', value: latestOrder?.productName || profile.lastProduct, status: latestOrder?.status || profile.status },
    { label: '최근 활동', value: formatDateTime(profile.lastSeen), status: profile.readRate >= 75 ? '관심 유지' : '재유입 필요' }
  ];
  const riskReasons = [
    profile.paidOrders === 0 ? '가입 후 결제 없음' : '',
    profile.readRate < 70 ? '리포트 열람률 낮음' : '',
    profile.riskScore >= 70 ? '이탈 위험도 높음' : '',
    latestOrder?.status === 'failed' ? '최근 결제 실패' : '',
    latestOrder?.reportStatus === 'failed' ? '최근 리포트 생성 실패' : ''
  ].filter(Boolean);

  return (
    <article className="admin-detail-panel">
      <div className="admin-detail-head">
        <div className="admin-avatar large">{profile.maskedName.slice(0, 1)}</div>
        <div>
          <span>{profile.provider === 'kakao' ? 'KAKAO CUSTOMER' : 'LOCAL CUSTOMER'}</span>
          <h3>{profile.maskedName}</h3>
          <p>{profile.email} · {profile.sourceChannel} · {profile.device === 'mobile' ? '모바일' : '데스크톱'}</p>
        </div>
        <b className={`admin-segment-badge ${profile.segment === '이탈 위험' || profile.segment === '가입만 완료' ? 'warn' : 'good'}`}>
          {profile.segment}
        </b>
      </div>

      <div className="admin-detail-metrics">
        <div><span>가입일</span><strong>{formatDateTime(profile.signedAt)}</strong></div>
        <div><span>결제</span><strong>{profile.paidOrders}건</strong></div>
        <div><span>누적 결제</span><strong>{formatCurrency(profile.spent)}</strong></div>
        <div><span>열람률</span><strong>{profile.readRate}%</strong></div>
        <div><span>위험도</span><strong>{profile.riskScore}점</strong></div>
        <div><span>최근 활동</span><strong>{formatDateTime(profile.lastSeen)}</strong></div>
      </div>

      <div className="admin-next-action">
        <span>다음 추천 액션</span>
        <strong>{profile.nextAction}</strong>
        <p>고객 상태에 따라 다음 상품 추천, 결제 이탈 복구, 리포트 품질 확인을 다르게 처리합니다.</p>
      </div>

      <div className="admin-detail-timeline">
        {journeyRows.map((row) => (
          <div key={`${profile.id}-${row.label}`}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <em>{row.status}</em>
          </div>
        ))}
      </div>

      <div className="admin-detail-tags">
        <span>유입 {profile.sourceChannel}</span>
        <span>{profile.provider === 'kakao' ? '카카오 로그인' : '데모/로컬'}</span>
        <span>{profile.device === 'mobile' ? '모바일 중심' : 'PC 유입'}</span>
        <span>{riskReasons.length ? riskReasons.join(' · ') : '위험 신호 낮음'}</span>
      </div>

      <div className="admin-detail-list">
        <div className="admin-detail-list-head">
          <span>결제 이력</span>
          <strong>{customerOrders.length}건</strong>
        </div>
        {customerOrders.length ? (
          customerOrders.map((order) => (
            <button key={order.id} type="button" onClick={() => onSelectOrder(order.id)}>
              <span>{formatDateTime(order.createdAt)}</span>
              <strong>{order.productName}</strong>
              <em>{formatCurrency(order.amount)} · {order.status} · {order.reportStatus}</em>
            </button>
          ))
        ) : (
          <p className="admin-empty-detail">가입 후 결제 이력이 없습니다. 첫 결제 전환 캠페인 대상으로 분류하세요.</p>
        )}
      </div>
    </article>
  );
}

function OrderDetailPanel({
  order,
  customer,
  onSelectCustomer
}: {
  order?: AdminOrder;
  customer?: CustomerProfile;
  onSelectCustomer: (customerId: string) => void;
}) {
  if (!order) {
    return (
      <article className="admin-detail-panel empty">
        <strong>주문을 선택하세요</strong>
        <p>주문 행을 클릭하면 결제와 리포트 생성 상세가 표시됩니다.</p>
      </article>
    );
  }

  const orderSteps = [
    {
      label: '결제 요청',
      value: formatDateTime(order.createdAt),
      status: order.status === 'failed' ? '실패' : order.status === 'pending' ? '대기' : '완료'
    },
    {
      label: 'AI 분석',
      value: `${order.reportLatencySec}초`,
      status: order.reportStatus === 'failed' ? '실패' : order.reportStatus === 'generating' ? '생성중' : '완료'
    },
    {
      label: '결과 열람',
      value: `${order.readRate}%`,
      status: order.readRate >= 80 ? '우수' : order.readRate >= 60 ? '보통' : '개선'
    },
    {
      label: '오류 신고',
      value: `${order.issueCount}건`,
      status: order.issueCount ? '확인' : '없음'
    }
  ];

  return (
    <article className="admin-detail-panel">
      <div className="admin-detail-head">
        <span className={`admin-status-dot ${order.status}`} />
        <div>
          <span>주문 상세</span>
          <h3>{order.orderId}</h3>
          <p>{order.productName} · {order.sourceChannel} · {order.device === 'mobile' ? '모바일' : '데스크톱'}</p>
        </div>
        <b className={`admin-segment-badge ${order.status === 'paid' ? 'good' : 'warn'}`}>{order.status}</b>
      </div>

      <div className="admin-detail-metrics">
        <div><span>결제금액</span><strong>{formatCurrency(order.amount)}</strong></div>
        <div><span>결제수단</span><strong>{order.paymentMethod}</strong></div>
        <div><span>리포트</span><strong>{order.reportStatus}</strong></div>
        <div><span>생성 시간</span><strong>{order.reportLatencySec}초</strong></div>
        <div><span>열람률</span><strong>{order.readRate}%</strong></div>
        <div><span>신고</span><strong>{order.issueCount}건</strong></div>
      </div>

      <div className="admin-next-action">
        <span>주문 처리</span>
        <strong>
          {order.status === 'failed'
            ? '결제 실패 고객에게 재결제 안내와 고객센터 문구를 노출하세요.'
            : order.reportStatus === 'generating'
              ? '생성 지연 상태입니다. 로딩 이탈과 API 응답 시간을 확인하세요.'
              : '정상 생성 주문입니다. 열람률이 낮으면 리포트 초반 요약을 점검하세요.'}
        </strong>
        <p>{formatDateTime(order.createdAt)} 결제 요청 기준으로 확인합니다.</p>
      </div>

      <div className="admin-detail-timeline order">
        {orderSteps.map((step) => (
          <div key={`${order.id}-${step.label}`}>
            <span>{step.label}</span>
            <strong>{step.value}</strong>
            <em>{step.status}</em>
          </div>
        ))}
      </div>

      <div className="admin-detail-tags">
        <span>상품 {order.productName}</span>
        <span>유입 {order.sourceChannel}</span>
        <span>{order.device === 'mobile' ? '모바일 결제' : 'PC 결제'}</span>
        <span>{order.archive ? '리포트 보관 있음' : '리포트 보관 없음'}</span>
      </div>

      {customer ? (
        <button type="button" className="admin-linked-customer" onClick={() => onSelectCustomer(customer.id)}>
          <UserRound size={17} />
          <span>{customer.maskedName} 고객 상세 열기</span>
          <strong>{formatCurrency(customer.spent)}</strong>
        </button>
      ) : null}

      {order.archive ? (
        <Link
          className="admin-report-open-link"
          to={`/report/${order.productId}`}
          state={{
            formData: order.archive.formData,
            paymentMethod: order.archive.paymentMethod,
            orderId: order.archive.orderId,
            reportData: order.archive.reportData
          }}
        >
          리포트 화면 열기
        </Link>
      ) : null}
    </article>
  );
}

export default function Admin() {
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [accessError, setAccessError] = useState('');
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const [adminAccessToken, setAdminAccessToken] = useState(
    () => window.sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY) || ''
  );
  const [isUnlocked, setIsUnlocked] = useState(
    () =>
      Boolean(window.sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY)) ||
      ((isLocalAdminHost() || ENABLE_CLIENT_ADMIN) && window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'ok')
  );
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [period, setPeriod] = useState<AdminPeriod>('7d');
  const [adminSearch, setAdminSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now());
  const [reports, setReports] = useState(() => readReportArchiveEntries(readStoredAuthUser()?.id));
  const authUser = readStoredAuthUser();
  const adminLoginEndpoint = getAdminLoginEndpoint();
  const isLocalOnlyMode = isLocalAdminHost();
  const isAdminAvailable = isLocalOnlyMode || ENABLE_CLIENT_ADMIN || Boolean(adminLoginEndpoint);
  const realOrders = useMemo(() => reports.map(toAdminOrder), [reports]);
  const isSampleMode = realOrders.length === 0;
  const allOrders = useMemo(() => (realOrders.length ? realOrders : buildSampleOrders()), [realOrders]);
  const orders = useMemo(() => filterOrdersByPeriod(allOrders, period), [allOrders, period]);
  const previousOrders = useMemo(() => filterOrdersByPreviousPeriod(allOrders, period), [allOrders, period]);
  const previousDayOrders = useMemo(() => filterOrdersByPreviousPeriod(allOrders, 'today'), [allOrders]);
  const todayOrders = useMemo(() => countToday(allOrders), [allOrders]);
  const hasEstimatedAnalytics = orders.some((order) => order.analyticsEstimated);
  const paidOrders = orders.filter((order) => order.status === 'paid');
  const previousPaidOrders = previousOrders.filter((order) => order.status === 'paid');
  const previousDayPaidOrders = previousDayOrders.filter((order) => order.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
  const previousRevenue = previousPaidOrders.reduce((sum, order) => sum + order.amount, 0);
  const todayRevenue = todayOrders.filter((order) => order.status === 'paid').reduce((sum, order) => sum + order.amount, 0);
  const previousDayRevenue = previousDayPaidOrders.reduce((sum, order) => sum + order.amount, 0);
  const avgOrderValue = paidOrders.length ? totalRevenue / paidOrders.length : 0;
  const previousAvgOrderValue = previousPaidOrders.length ? previousRevenue / previousPaidOrders.length : 0;
  const avgReadRate = paidOrders.length ? Math.round(paidOrders.reduce((sum, order) => sum + order.readRate, 0) / paidOrders.length) : 0;
  const previousAvgReadRate = previousPaidOrders.length
    ? Math.round(previousPaidOrders.reduce((sum, order) => sum + order.readRate, 0) / previousPaidOrders.length)
    : 0;
  const avgLatency = paidOrders.length ? Math.round(paidOrders.reduce((sum, order) => sum + order.reportLatencySec, 0) / paidOrders.length) : 0;
  const funnel = useMemo(() => buildFunnel(orders), [orders]);
  const previousFunnel = useMemo(() => buildFunnel(previousOrders), [previousOrders]);
  const categoryRows = useMemo(() => buildCategoryRows(orders), [orders]);
  const customerRows = useMemo(() => buildCustomerRows(orders), [orders]);
  const customerProfiles = useMemo(() => buildCustomerProfiles(customerRows, orders, isSampleMode), [customerRows, orders, isSampleMode]);
  const allCustomerRows = useMemo(() => buildCustomerRows(allOrders), [allOrders]);
  const allCustomerProfiles = useMemo(
    () => buildCustomerProfiles(allCustomerRows, allOrders, isSampleMode),
    [allCustomerRows, allOrders, isSampleMode]
  );
  const issueRows = useMemo(() => buildIssueRows(orders), [orders]);
  const dailyTrend = useMemo(() => buildDailyTrend(allOrders), [allOrders]);
  const hourlyRows = useMemo(() => buildHourlyRows(orders), [orders]);
  const channelRows = useMemo(() => buildChannelRows(orders), [orders]);
  const channelPerformanceRows = useMemo(() => buildChannelPerformanceRows(orders), [orders]);
  const deviceRows = useMemo(() => buildDeviceRows(orders), [orders]);
  const productRows = useMemo(() => buildProductRows(orders), [orders]);
  const customerSegments = useMemo(() => buildCustomerSegments(customerProfiles), [customerProfiles]);
  const retentionCohorts = useMemo(() => buildRetentionCohorts(customerProfiles), [customerProfiles]);
  const filteredCustomerProfiles = useMemo(() => filterCustomerProfiles(customerProfiles, customerFilter), [customerProfiles, customerFilter]);
  const largestDrop = useMemo(() => getLargestDrop(funnel), [funnel]);
  const previousLargestDrop = useMemo(() => getLargestDrop(previousFunnel), [previousFunnel]);
  const apiCost = paidOrders.length * 92;
  const previousApiCost = previousPaidOrders.length * 92;
  const paymentFee = totalRevenue * 0.033;
  const previousPaymentFee = previousRevenue * 0.033;
  const netRevenue = totalRevenue - apiCost - paymentFee;
  const previousNetRevenue = previousRevenue - previousApiCost - previousPaymentFee;
  const successRate = getConversion(paidOrders.length, orders.length);
  const previousSuccessRate = getConversion(previousPaidOrders.length, previousOrders.length);
  const reportRead90 = getConversion(orders.filter((order) => order.readRate >= 90).length, orders.length);
  const mobileShare = getConversion(orders.filter((order) => order.device === 'mobile').length, orders.length);
  const bestProduct = productRows[0];
  const bestCategory = [...categoryRows].sort((left, right) => right.revenue - left.revenue)[0];
  const highSeverityIssues = issueRows.filter((issue) => issue.severity === 'high').length;
  const selectedCustomer = allCustomerProfiles.find((profile) => profile.id === selectedCustomerId) || filteredCustomerProfiles[0] || allCustomerProfiles[0];
  const selectedOrder = allOrders.find((order) => order.id === selectedOrderId) || orders[0] || allOrders[0];
  const selectedOrderCustomer = selectedOrder ? allCustomerProfiles.find((profile) => profile.name === selectedOrder.customerName) : undefined;
  const marginRate = getConversion(netRevenue, totalRevenue || 1);
  const issueRate = getConversion(issueRows.length, orders.length);
  const paidCustomerProfiles = customerProfiles.filter((profile) => profile.paidOrders > 0);
  const repeatRate = getConversion(
    paidCustomerProfiles.filter((profile) => profile.paidOrders > 1).length,
    paidCustomerProfiles.length
  );
  const periodDays = getPeriodDays(period);
  const forecastRevenue = Math.round((totalRevenue / Math.max(1, periodDays)) * 30);
  const opportunityRevenue = Math.round((funnel[4]?.count || 0) * 0.05 * Math.max(avgOrderValue, 2900));
  const bestChannel = channelPerformanceRows
    .filter((row) => row.orders > 0)
    .sort((left, right) => {
      const leftScore = left.estimatedSpend ? left.estimatedRoas : left.conversion * 100;
      const rightScore = right.estimatedSpend ? right.estimatedRoas : right.conversion * 100;
      return rightScore - leftScore;
    })[0];
  const healthItems = [
    { label: '결제', value: successRate, display: formatPercent(successRate), note: '성공/시도' },
    { label: '열람', value: avgReadRate, display: `${avgReadRate}%`, note: '평균 완독 신호' },
    { label: '마진', value: clamp(marginRate), display: formatPercent(marginRate), note: '추정 순매출' },
    { label: '속도', value: clamp(100 - avgLatency), display: `${avgLatency}초`, note: '생성 시간' },
    { label: '품질', value: clamp(100 - issueRate * 3), display: formatPercent(issueRate), note: '신고율' },
    { label: '모바일', value: mobileShare, display: formatPercent(mobileShare), note: '결제 비중' }
  ];
  const healthScore = Math.round(healthItems.reduce((sum, item) => sum + clamp(item.value), 0) / healthItems.length);
  const revenueChange = getChangeRate(totalRevenue, previousRevenue);
  const todayPaidChange = getChangeRate(todayOrders.filter((order) => order.status === 'paid').length, previousDayPaidOrders.length);
  const successRateChange = getChangeRate(successRate, previousSuccessRate);
  const readRateChange = getChangeRate(avgReadRate, previousAvgReadRate);
  const aovChange = getChangeRate(avgOrderValue, previousAvgOrderValue);
  const netRevenueChange = getChangeRate(netRevenue, previousNetRevenue);
  const executiveAlerts: ExecutiveAlert[] = [
    {
      id: 'payment-health',
      severity: successRate < 85 ? 'critical' : successRate < 95 ? 'warning' : 'stable',
      title: successRate < 95 ? '결제 성공률이 목표선 아래입니다' : '결제 흐름이 안정적입니다',
      metric: formatPercent(successRate),
      body: successRate < 95
        ? '실패 콜백, 중복 클릭, 모바일 결제창 복귀 경로를 순서대로 확인하세요.'
        : '실패 주문만 개별 확인하고 결제 흐름은 유지해도 됩니다.',
      owner: '결제 운영',
      sla: successRate < 85 ? '30분 이내' : '오늘 중'
    },
    {
      id: 'report-latency',
      severity: avgLatency > 60 ? 'critical' : avgLatency > 45 ? 'warning' : 'stable',
      title: avgLatency > 45 ? '리포트 생성 지연을 관찰해야 합니다' : '리포트 생성 속도가 안정권입니다',
      metric: `${avgLatency}초`,
      body: avgLatency > 45
        ? 'Gemini 응답 시간과 재시도 횟수, 로딩 중 이탈률을 같은 시간축으로 확인하세요.'
        : '현재 속도를 기준선으로 저장하고 45초 초과 시 자동 알림을 연결하세요.',
      owner: 'AI 품질',
      sla: avgLatency > 60 ? '1시간 이내' : '24시간'
    },
    {
      id: 'funnel-drop',
      severity: largestDrop.drop >= 60 ? 'warning' : 'watch',
      title: `${largestDrop.label}에서 고객이 가장 많이 빠집니다`,
      metric: formatPercent(largestDrop.drop),
      body: '이 구간의 가격, 필수 입력, 버튼 위치를 한 번에 바꾸지 말고 한 요소씩 실험하세요.',
      owner: '전환 최적화',
      sla: '이번 주'
    },
    {
      id: 'quality-issues',
      severity: highSeverityIssues ? 'critical' : issueRows.length ? 'warning' : 'stable',
      title: issueRows.length ? '고객 신고 검수 큐가 남아 있습니다' : '미처리 고객 신고가 없습니다',
      metric: `${issueRows.length}건`,
      body: issueRows.length
        ? '계산 불일치와 결제 실패를 먼저 처리하고, 오타 신고는 같은 템플릿 반복 여부를 확인하세요.'
        : '신고 없는 상태를 유지하되 원국 회귀 테스트와 문장 검수는 배포마다 실행하세요.',
      owner: '고객 품질',
      sla: highSeverityIssues ? '2시간 이내' : '24시간'
    }
  ];
  const actionRows = [
    {
      status: '매출',
      title: `${largestDrop.label} 병목 개선`,
      body: `이탈 ${formatPercent(largestDrop.drop)} 구간입니다. 이 단계의 버튼, 금액 안내, 로딩 문구를 가장 먼저 줄여보세요.`,
      tone: 'warn' as const
    },
    {
      status: '상품',
      title: `${bestProduct?.label || '주력 상품'} 노출 강화`,
      body: `현재 매출 비중 ${formatPercent(bestProduct?.share || 0)}입니다. 홈 상단과 결제 직전 추천 영역에 우선 배치하기 좋습니다.`,
      tone: 'good' as const
    },
    {
      status: '품질',
      title: `리포트 생성 ${avgLatency}초 관리`,
      body: avgLatency > 45 ? '로딩 화면에서 원국·오행 미리보기와 진행 문구를 더 촘촘하게 보여줘야 합니다.' : '현재 속도는 안정권입니다. 실패 주문과 신고 큐만 먼저 확인하면 됩니다.'
    },
    {
      status: 'CRM',
      title: `${customerSegments[1]?.value || 0}명 재구매 후보`,
      body: '열람률이 높은 고객에게 종합사주, 궁합, 결혼운으로 이어지는 다음 상품 동선을 만들면 좋습니다.'
    }
  ];
  const periodLabels: Record<AdminPeriod, string> = {
    today: '오늘',
    '7d': '최근 7일',
    '30d': '최근 30일'
  };
  const normalizedSearch = adminSearch.trim().toLocaleLowerCase('ko-KR');
  const orderSearchResults = normalizedSearch
    ? allOrders.filter((order) => [
        order.orderId,
        order.customerName,
        order.customerEmail || '',
        order.productName
      ].some((value) => value.toLocaleLowerCase('ko-KR').includes(normalizedSearch))).slice(0, 5)
    : [];
  const customerSearchResults = normalizedSearch
    ? allCustomerProfiles.filter((customer) => [
        customer.name,
        customer.maskedName,
        customer.email,
        customer.lastProduct
      ].some((value) => value.toLocaleLowerCase('ko-KR').includes(normalizedSearch))).slice(0, 5)
    : [];

  useEffect(() => {
    let isCancelled = false;

    const loadRemoteReports = async () => {
      if (!isUnlocked || !adminAccessToken) {
        return;
      }

      try {
        const remoteReports = await fetchAdminReportArchiveEntries(adminAccessToken);

        if (isCancelled) {
          return;
        }

        setReports(mergeReportArchiveEntries(remoteReports, readReportArchiveEntries(authUser?.id)));
      } catch {
        // Keep the local archive or sample dashboard visible if the server admin API is not reachable.
      }
    };

    void loadRemoteReports();

    return () => {
      isCancelled = true;
    };
  }, [adminAccessToken, authUser?.id, isUnlocked]);

  const unlock = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setIsCheckingAccess(true);

    try {
      if (adminLoginEndpoint) {
        const response = await fetch(adminLoginEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            adminId,
            password: adminPassword
          })
        });
        const payload = (await response.json().catch(() => null)) as {
          adminAccessToken?: string;
          message?: string;
        } | null;

        if (!response.ok || !payload?.adminAccessToken) {
          throw new Error(payload?.message || '관리자 로그인에 실패했습니다.');
        }

        window.sessionStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, payload.adminAccessToken);
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
        setAdminAccessToken(payload.adminAccessToken);
        setAdminPassword('');
        setIsUnlocked(true);
        setAccessError('');
        return;
      }

      const credentialHash = await hashAdminCredential(adminId, adminPassword);

      if (credentialHash === ADMIN_CREDENTIAL_HASH) {
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
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
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
    setAdminAccessToken('');
    setIsUnlocked(false);
    setAdminPassword('');
  };

  const openView = (view: AdminView) => {
    setActiveView(view);

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openOrderFromSearch = (orderId: string) => {
    setSelectedOrderId(orderId);
    setActiveView('orders');
    setAdminSearch('');
    setIsSearchOpen(false);
  };

  const openCustomerFromSearch = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveView('customers');
    setAdminSearch('');
    setIsSearchOpen(false);
  };

  const todayPaidCount = todayOrders.filter((order) => order.status === 'paid').length;
  const categoryCards: Array<{
    id: AdminView;
    label: string;
    value: string;
    description: string;
    detailTitle: string;
    detailBody: string;
    highlights: Array<{ label: string; value: string }>;
    icon: IconComponent;
    tone?: 'good' | 'warn' | 'blue';
  }> = [
    {
      id: 'overview',
      label: '전체 흐름',
      value: `${todayPaidCount}건`,
      description: `${bestCategory?.label || '핵심 카테고리'} 중심`,
      detailTitle: '오늘 운영 흐름 한눈에 보기',
      detailBody: '매출, 이탈, 상품 성과, 액션 큐를 압축해서 보는 관제 화면입니다. 하루 시작할 때 이 화면만 먼저 보면 됩니다.',
      highlights: [
        { label: '오늘 결제', value: `${todayPaidCount}건` },
        { label: '오늘 매출', value: formatCurrency(todayRevenue) },
        { label: '주력 상품', value: bestProduct?.label || '데이터 없음' }
      ],
      icon: BarChart3,
      tone: 'good'
    },
    {
      id: 'funnel',
      label: '유입·이탈',
      value: formatPercent(largestDrop.drop),
      description: '고객이 빠지는 구간',
      detailTitle: '방문부터 결제까지 이탈 구간 분석',
      detailBody: '홈 방문, 상품 상세, 입력폼, 결제창, 리포트 열람까지 이어지는 흐름을 단계별로 분리해서 봅니다.',
      highlights: [
        { label: '최대 이탈', value: formatPercent(largestDrop.drop) },
        { label: '병목 구간', value: largestDrop.label },
        { label: '모바일 비중', value: formatPercent(mobileShare) }
      ],
      icon: MousePointerClick,
      tone: 'warn'
    },
    {
      id: 'orders',
      label: '결제·주문',
      value: formatCurrency(todayRevenue),
      description: '주문과 결제 상태',
      detailTitle: '결제 성공, 대기, 실패 주문 관리',
      detailBody: '주문번호, 고객, 유입 채널, 기기, 결제 상태, 리포트 생성 상태를 한 번에 확인합니다.',
      highlights: [
        { label: '성공률', value: formatPercent(successRate) },
        { label: '대기 주문', value: `${orders.filter((order) => order.status === 'pending').length}건` },
        { label: '실패 주문', value: `${orders.filter((order) => order.status === 'failed').length}건` }
      ],
      icon: CreditCard,
      tone: 'good'
    },
    {
      id: 'customers',
      label: '고객·카카오',
      value: `${customerProfiles.length}명`,
      description: '고객군과 재구매',
      detailTitle: '카카오 고객과 재구매 후보 관리',
      detailBody: '고객을 마스킹해서 보되, 구매 횟수, 누적 매출, 열람률로 재구매 가능성을 빠르게 나눕니다.',
      highlights: [
        { label: '전체 고객', value: `${customerProfiles.length}명` },
        { label: '고관여', value: `${customerSegments[1]?.value || 0}명` },
        { label: 'VIP 후보', value: `${customerSegments[0]?.value || 0}명` }
      ],
      icon: Users,
      tone: 'blue'
    },
    {
      id: 'reports',
      label: '리포트 품질',
      value: `${avgReadRate}%`,
      description: '열람과 생성 속도',
      detailTitle: '리포트 만족도와 생성 품질 확인',
      detailBody: '열람률, 생성 시간, 신고율을 함께 보고 고객이 끝까지 읽는 결과지인지 확인합니다.',
      highlights: [
        { label: '평균 열람', value: `${avgReadRate}%` },
        { label: '90% 이상', value: formatPercent(reportRead90) },
        { label: '생성 시간', value: `${avgLatency}초` }
      ],
      icon: ScrollText
    },
    {
      id: 'issues',
      label: '오류 신고',
      value: `${highSeverityIssues}건`,
      description: '검수와 문의 처리',
      detailTitle: '오류, 오타, 계산 불일치 신고함',
      detailBody: '신고가 들어온 리포트와 주문을 묶어서 보고, 심각도 높은 건부터 처리할 수 있게 정리합니다.',
      highlights: [
        { label: '긴급 검수', value: `${highSeverityIssues}건` },
        { label: '총 신고', value: `${issueRows.length}건` },
        { label: '신고율', value: formatPercent(issueRate) }
      ],
      icon: MessageSquareWarning,
      tone: highSeverityIssues ? 'warn' : undefined
    },
    {
      id: 'costs',
      label: '비용·마진',
      value: formatCurrency(netRevenue),
      description: '원가와 순매출',
      detailTitle: 'API 비용, 결제 수수료, 상품별 마진',
      detailBody: '저가 상품이 실제로 남는지, API 비용과 결제 수수료를 제외한 순매출을 확인합니다.',
      highlights: [
        { label: '순매출', value: formatCurrency(netRevenue) },
        { label: '마진율', value: formatPercent(marginRate) },
        { label: 'API 비용', value: formatCurrency(apiCost) }
      ],
      icon: WalletCards,
      tone: 'blue'
    }
  ];
  const activeCategory = categoryCards.find((card) => card.id === activeView) || categoryCards[0];

  const refresh = () => {
    setReports(readReportArchiveEntries(authUser?.id));
    setLastUpdatedAt(Date.now());

    if (adminAccessToken) {
      void fetchAdminReportArchiveEntries(adminAccessToken)
        .then((remoteReports) => {
          setReports(mergeReportArchiveEntries(remoteReports, readReportArchiveEntries(authUser?.id)));
          setLastUpdatedAt(Date.now());
        })
        .catch(() => {
          setReports(readReportArchiveEntries(authUser?.id));
        });
    }
  };

  if (!isAdminAvailable) {
    return (
      <main className="admin-page">
        <section className="admin-lock-card">
          <span className="admin-icon-circle">
            <ShieldCheck size={22} />
          </span>
          <h1>운영 어드민 보호 중</h1>
          <p>
            출시 도메인의 클라이언트 어드민은 비활성화되어 있습니다. 실제 고객/결제 데이터는 서버 인증이 붙은
            관리자 API로만 열어야 합니다.
          </p>
          <Link to="/" className="admin-black-button">
            홈으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  if (!isUnlocked) {
    return (
      <main className="admin-page">
        <form className="admin-lock-card" onSubmit={unlock}>
          <span className="admin-icon-circle">
            <Lock size={22} />
          </span>
          <h1>운월당 관리자</h1>
          <p>결제, 고객, 리포트, 오류 신고를 확인하는 운영자 전용 화면입니다. 관리자 아이디와 비밀번호로 접속합니다.</p>
          <label>
            관리자 아이디
            <input
              type="text"
              value={adminId}
              onChange={(event) => setAdminId(event.target.value)}
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              required
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              required
            />
          </label>
          {accessError ? <small>{accessError}</small> : null}
          <button type="submit" disabled={isCheckingAccess}>
            {isCheckingAccess ? '확인 중' : '관리자 페이지 열기'}
          </button>
          <p className="admin-lock-note">프론트 잠금은 임시 보호입니다. 출시 전 서버 로그인과 접속 로그를 반드시 연결해야 합니다.</p>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-hero">
        <div className="admin-hero-left">
          <Link to="/" className="admin-back-link" aria-label="운월당 홈으로 이동">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <strong>운월당 운영센터</strong>
            <span>데이터 · 고객 · 품질 관제</span>
          </div>
        </div>
        <div className="admin-global-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={adminSearch}
            onChange={(event) => {
              setAdminSearch(event.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setIsSearchOpen(false);
              }
            }}
            placeholder="주문번호, 고객명, 이메일, 상품 검색"
            aria-label="관리자 통합 검색"
          />
          {adminSearch ? (
            <button
              type="button"
              className="admin-search-clear"
              onClick={() => {
                setAdminSearch('');
                setIsSearchOpen(false);
              }}
              aria-label="검색어 지우기"
            >
              <X size={16} />
            </button>
          ) : <kbd>/</kbd>}
          {isSearchOpen && normalizedSearch ? (
            <div className="admin-search-results" role="listbox" aria-label="통합 검색 결과">
              {orderSearchResults.length ? (
                <section>
                  <strong>주문 {orderSearchResults.length}</strong>
                  {orderSearchResults.map((order) => (
                    <button key={order.id} type="button" onClick={() => openOrderFromSearch(order.id)}>
                      <CreditCard size={16} />
                      <span>
                        <b>{order.orderId}</b>
                        <small>{maskName(order.customerName)} · {order.productName}</small>
                      </span>
                      <em>{formatCurrency(order.amount)}</em>
                    </button>
                  ))}
                </section>
              ) : null}
              {customerSearchResults.length ? (
                <section>
                  <strong>고객 {customerSearchResults.length}</strong>
                  {customerSearchResults.map((customer) => (
                    <button key={customer.id} type="button" onClick={() => openCustomerFromSearch(customer.id)}>
                      <UserRound size={16} />
                      <span>
                        <b>{customer.maskedName}</b>
                        <small>{customer.email} · 최근 {customer.lastProduct}</small>
                      </span>
                      <em>{formatCurrency(customer.spent)}</em>
                    </button>
                  ))}
                </section>
              ) : null}
              {!orderSearchResults.length && !customerSearchResults.length ? (
                <p>일치하는 주문이나 고객이 없습니다.</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="admin-hero-actions">
          <span className={isSampleMode ? 'admin-mode-badge sample' : 'admin-mode-badge'}>
            {isSampleMode ? '샘플 데이터' : '실제 리포트 기록'}
          </span>
          <button type="button" onClick={refresh} title="데이터 새로고침">
            <RefreshCw size={16} />
            <span>새로고침</span>
          </button>
          <button type="button" onClick={lockAdmin} title="관리자 화면 잠금">
            <Lock size={16} />
            <span>잠금</span>
          </button>
        </div>
      </header>

      {isLocalOnlyMode ? (
        <section className="admin-warning">
          <ShieldCheck size={18} />
          <p>로컬 개발용 화면입니다. 출시용 어드민은 서버 권한 검증, DB, 관리자 접속 로그, 개인정보 접근 이력을 붙여야 합니다.</p>
        </section>
      ) : null}

      <section className="admin-operations-bar">
        <div>
          <span className="admin-live-label"><i /> 실시간 운영</span>
          <h1>{activeCategory.detailTitle}</h1>
          <p>{periodLabels[period]} 기준 · 마지막 동기화 {new Date(lastUpdatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="admin-period-control" role="group" aria-label="분석 기간">
          {([
            ['today', '오늘'],
            ['7d', '7일'],
            ['30d', '30일']
          ] as Array<[AdminPeriod, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={period === id ? 'active' : ''}
              onClick={() => setPeriod(id)}
              aria-pressed={period === id}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="admin-system-strip" aria-label="핵심 운영 상태">
        <article className={successRate < 90 ? 'warn' : 'good'}>
          <CheckCircle2 size={17} />
          <span>결제 시스템</span>
          <strong>{successRate >= 90 ? '정상' : '점검 필요'}</strong>
          <small>성공률 {formatPercent(successRate)}</small>
        </article>
        <article className={avgLatency > 45 ? 'warn' : 'good'}>
          <Activity size={17} />
          <span>AI 리포트</span>
          <strong>{avgLatency > 45 ? '지연 관찰' : '안정'}</strong>
          <small>평균 {avgLatency}초</small>
        </article>
        <article>
          <Server size={17} />
          <span>데이터 소스</span>
          <strong>{isSampleMode ? '샘플 모드' : adminAccessToken ? '리포트 서버' : '보관 기록'}</strong>
          <small>{allOrders.length.toLocaleString('ko-KR')}개 기록</small>
        </article>
        <article className={highSeverityIssues ? 'warn' : 'good'}>
          <MessageSquareWarning size={17} />
          <span>긴급 검수</span>
          <strong>{highSeverityIssues ? `${highSeverityIssues}건 대기` : '대기 없음'}</strong>
          <small>전체 신고 {issueRows.length}건</small>
        </article>
      </section>

      <section className="admin-top-categories">
        <nav className="admin-category-hub" aria-label="운영 카테고리" role="tablist">
          {categoryCards.map((card) => {
            const Icon = card.icon;

            return (
              <button
                key={card.id}
                type="button"
                className={`${activeView === card.id ? 'active' : ''} ${card.tone || ''}`}
                onClick={() => openView(card.id)}
                role="tab"
                aria-selected={activeView === card.id}
              >
                <span>
                  <Icon size={18} />
                  {card.label}
                </span>
                <strong>{card.value}</strong>
                <p>{card.description}</p>
              </button>
            );
          })}
        </nav>
      </section>

      <section className={`admin-selected-category ${activeCategory.tone || ''}`}>
        <div>
          <span>현재 화면</span>
          <h2>{activeCategory.detailTitle}</h2>
          <p>{activeCategory.detailBody}</p>
        </div>
        <div className="admin-selected-metrics">
          {activeCategory.highlights.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>

      {activeView === 'overview' ? (
        <section className="admin-metric-grid">
          <MetricCard
            title="오늘 결제"
            value={`${todayPaidCount}건`}
            delta={`${formatCurrency(todayRevenue)} · 전일 ${formatCurrency(previousDayRevenue)}`}
            trend={todayPaidChange}
            trendLabel="전일 동시간"
            icon={CreditCard}
            tone="good"
          />
          <MetricCard
            title={`${periodLabels[period]} 매출`}
            value={formatCurrency(totalRevenue)}
            delta={`객단가 ${formatCurrency(avgOrderValue)} · ${formatChangeRate(aovChange)}`}
            trend={revenueChange}
            icon={WalletCards}
            tone="good"
          />
          <MetricCard
            title="결제 성공률"
            value={formatPercent(successRate)}
            delta={`${paidOrders.length}/${orders.length}건 성공`}
            trend={successRateChange}
            icon={TrendingUp}
          />
          <MetricCard
            title="리포트 열람"
            value={`${avgReadRate}%`}
            delta={`90% 이상 ${formatPercent(reportRead90)}`}
            trend={readRateChange}
            icon={Eye}
          />
          <MetricCard
            title="이탈 집중 구간"
            value={formatPercent(largestDrop.drop)}
            delta={`${largestDrop.label} · 이전 ${formatPercent(previousLargestDrop.drop)}`}
            icon={MousePointerClick}
            tone="warn"
          />
          <MetricCard
            title="추정 순매출"
            value={formatCurrency(netRevenue)}
            delta={`API ${formatCurrency(apiCost)} · 수수료 ${formatCurrency(paymentFee)}`}
            trend={netRevenueChange}
            icon={LineChart}
            tone="blue"
          />
        </section>
      ) : null}

      {activeView === 'overview' ? (
        <>
          <section className="admin-executive-grid">
            <ExecutiveCommandCenter
              healthScore={healthScore}
              forecastRevenue={forecastRevenue}
              opportunityRevenue={opportunityRevenue}
              repeatRate={repeatRate}
              largestDrop={largestDrop}
              bestChannel={bestChannel}
              periodLabel={periodLabels[period]}
              isEstimated={hasEstimatedAnalytics}
            />
            <DecisionAlertCenter alerts={executiveAlerts} />
          </section>

          <section className="admin-overview-analytics">
            <RevenueTrendChart data={dailyTrend} />
            <DonutChart title="유입 채널별 결제" rows={channelRows} centerLabel="결제" />
            <LiveActivityFeed
              orders={allOrders}
              onSelectOrder={(orderId) => {
                setSelectedOrderId(orderId);
                setActiveView('orders');
              }}
            />
          </section>

          <section className="admin-command-grid">
            <CustomerJourneyMap funnel={funnel} largestDrop={largestDrop} />
            <HealthRadar items={healthItems} />
          </section>

          <section className="admin-growth-grid">
            <ChannelEfficiencyTable rows={channelPerformanceRows} />
            <RetentionCohortMatrix rows={retentionCohorts} />
          </section>

          <section className="admin-visual-grid">
            <ProductPortfolioMatrix rows={productRows} />
            <ActionCommand actions={actionRows} />
          </section>
        </>
      ) : null}

      {activeView === 'funnel' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>이탈 분석</span>
              <h2>단계별 이탈 분석</h2>
            </div>
            <p>방문부터 결제 성공까지 어디를 고치면 매출이 바로 오르는지 확인합니다.</p>
          </div>

          <div className="admin-insight-grid">
            <InsightCard title="최대 이탈" value={formatPercent(largestDrop.drop)} body={largestDrop.label} icon={AlertTriangle} tone="warn" />
            <InsightCard title="결제 진입률" value={formatPercent(funnel[4]?.benchmark || 0)} body="입력 완료 후 결제창까지 이어진 비율" icon={CreditCard} />
            <InsightCard title="모바일 비중" value={formatPercent(mobileShare)} body="모바일 UI가 매출에 가장 큰 영향을 줍니다." icon={MousePointerClick} tone="good" />
            <InsightCard title="우선 액션" value="결제 직전" body="금액, 제공 항목, 환불 기준을 더 짧게 보여주세요." icon={Zap} />
          </div>

          <div className="admin-funnel-visual">
            {funnel.map((step, index) => (
              <div key={step.key} style={{ width: `${Math.max(16, getConversion(step.count, funnel[0].count))}%` }}>
                <strong>{step.label}</strong>
                <span>{step.count.toLocaleString('ko-KR')}명</span>
                <em>{index === 0 ? '방문 기준' : `${formatPercent(step.benchmark)} 전환`}</em>
              </div>
            ))}
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
              <span>결제 운영</span>
              <h2>주문 관리</h2>
            </div>
            <p>주문번호, 유입, 기기, 금액, 리포트 생성 상태를 한 줄에서 확인합니다.</p>
          </div>

          <div className="admin-insight-grid">
            <InsightCard title="오늘 매출" value={formatCurrency(todayRevenue)} body={`${todayOrders.length}건의 결제 흐름`} icon={CalendarDays} tone="good" />
            <InsightCard title="대기 주문" value={`${orders.filter((order) => order.status === 'pending').length}건`} body="결제 콜백 또는 리포트 생성 확인" icon={Clock} />
            <InsightCard title="실패 주문" value={`${orders.filter((order) => order.status === 'failed').length}건`} body="결제 실패 콜백과 고객 안내 필요" icon={AlertTriangle} tone="warn" />
            <InsightCard title="모바일 결제" value={formatPercent(mobileShare)} body="결제창 모바일 최적화 우선" icon={MousePointerClick} />
          </div>

          <section className="admin-ops-grid">
            <RevenueTrendChart data={dailyTrend} />
            <HourlyBarChart data={hourlyRows} />
            <DonutChart title="유입 채널별 결제" rows={channelRows} centerLabel="결제" />
          </section>

          <section className="admin-drilldown-layout">
            <OrderDetailPanel
              order={selectedOrder}
              customer={selectedOrderCustomer}
              onSelectCustomer={(customerId) => {
                setSelectedCustomerId(customerId);
                setActiveView('customers');
              }}
            />
            <CustomerDetailPanel
              profile={selectedOrderCustomer}
              orders={allOrders}
              onSelectOrder={(orderId) => setSelectedOrderId(orderId)}
            />
          </section>

          <div className="admin-data-table orders enhanced">
            <div className="admin-table-head">
              <span>시간</span>
              <span>주문번호</span>
              <span>고객</span>
              <span>상품</span>
              <span>유입</span>
              <span>기기</span>
              <span>금액</span>
              <span>상태</span>
            </div>
            {orders.map((order) => {
              const content = (
                <>
                  <span>{formatDateTime(order.createdAt)}</span>
                  <strong>{order.orderId}</strong>
                  <em>{maskName(order.customerName)}</em>
                  <p>{order.productName}</p>
                  <span>{order.sourceChannel}</span>
                  <span>{order.device === 'mobile' ? '모바일' : '데스크톱'}</span>
                  <b>{formatCurrency(order.amount)}</b>
                  <div className="admin-pill-stack">
                    <small className={`admin-pill ${order.status}`}>{order.status}</small>
                    <small className={`admin-pill ${order.reportStatus}`}>{order.reportStatus}</small>
                  </div>
                </>
              );

              return (
                <button
                  key={order.id}
                  type="button"
                  className={selectedOrder?.id === order.id ? 'active' : ''}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeView === 'customers' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>고객 관리</span>
              <h2>고객 정보와 재구매 가능성</h2>
            </div>
            <p>카카오 로그인 고객은 개인정보를 마스킹하고, 상세 접근은 서버 권한 확인 후 열어야 합니다.</p>
          </div>

          <div className="admin-insight-grid">
            {customerSegments.map((segment) => (
              <InsightCard key={segment.label} title={segment.label} value={`${segment.value}명`} body={segment.note} icon={segment.icon} tone={segment.label.includes('위험') ? 'warn' : 'good'} />
            ))}
          </div>

          <div className="admin-customer-filter-bar">
            {[
              { id: 'all' as const, label: '전체 고객', value: `${customerProfiles.length}명` },
              { id: 'registered' as const, label: '가입 고객', value: `${customerProfiles.filter((profile) => profile.status === 'registered').length}명` },
              { id: 'paid' as const, label: '결제 고객', value: `${customerProfiles.filter((profile) => profile.paidOrders > 0).length}명` },
              { id: 'vip' as const, label: 'VIP/재구매', value: `${customerProfiles.filter((profile) => profile.segment === 'VIP' || profile.segment === '재구매 후보').length}명` },
              { id: 'risk' as const, label: '이탈 위험', value: `${customerProfiles.filter((profile) => profile.segment === '이탈 위험' || profile.segment === '가입만 완료' || profile.riskScore >= 65).length}명` }
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={customerFilter === filter.id ? 'active' : ''}
                onClick={() => {
                  setCustomerFilter(filter.id);
                  const nextProfile = filterCustomerProfiles(customerProfiles, filter.id)[0];
                  if (nextProfile) {
                    setSelectedCustomerId(nextProfile.id);
                  }
                }}
              >
                <span>{filter.label}</span>
                <strong>{filter.value}</strong>
              </button>
            ))}
          </div>

          <section className="admin-drilldown-layout">
            <CustomerDetailPanel
              profile={selectedCustomer}
              orders={allOrders}
              onSelectOrder={(orderId) => {
                setSelectedOrderId(orderId);
                setActiveView('orders');
              }}
            />
            <OrderDetailPanel
              order={selectedOrder}
              customer={selectedOrderCustomer}
              onSelectCustomer={(customerId) => setSelectedCustomerId(customerId)}
            />
          </section>

          <div className="admin-customer-grid">
            {filteredCustomerProfiles.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className={selectedCustomer?.id === customer.id ? 'active' : ''}
                onClick={() => setSelectedCustomerId(customer.id)}
              >
                <div className="admin-avatar">{customer.maskedName.slice(0, 1)}</div>
                <div>
                  <strong>{customer.maskedName}</strong>
                  <span>{customer.email} · {customer.segment}</span>
                </div>
                <dl>
                  <dt>상태</dt>
                  <dd>{customer.status === 'paid' ? '결제' : '가입'}</dd>
                  <dt>구매</dt>
                  <dd>{customer.paidOrders}건</dd>
                  <dt>누적</dt>
                  <dd>{formatCurrency(customer.spent)}</dd>
                  <dt>열람</dt>
                  <dd>{customer.readRate}%</dd>
                  <dt>최근</dt>
                  <dd>{formatDateTime(customer.lastSeen)}</dd>
                </dl>
                <p>{customer.lastProduct} · 위험도 {customer.riskScore}점</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activeView === 'reports' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>리포트 품질</span>
              <h2>리포트 생성/열람 관리</h2>
            </div>
            <p>고객 만족도는 열람률, 신고율, 생성 지연, 재방문 여부로 관리합니다.</p>
          </div>

          <div className="admin-report-layout">
            <DonutChart title="기기별 리포트 열람" rows={deviceRows} centerLabel="결제" />
            <div className="admin-quality-board">
              <InsightCard title="평균 열람률" value={`${avgReadRate}%`} body="80% 아래 상품은 본문 길이와 초반 요약을 점검합니다." icon={Eye} tone="good" />
              <InsightCard title="평균 생성 시간" value={`${avgLatency}초`} body="60초 이상이면 로딩 화면 이탈 가능성이 커집니다." icon={Clock} />
              <InsightCard title="신고율" value={formatPercent(getConversion(issueRows.length, orders.length))} body="계산 불일치와 오타 신고를 분리해서 봅니다." icon={MessageSquareWarning} tone="warn" />
            </div>
          </div>

          <div className="admin-report-grid">
            {orders.map((order) => (
              <article key={order.id}>
                <div>
                  <strong>{order.productName}</strong>
                  <span>{order.orderId} · {order.sourceChannel}</span>
                </div>
                <div className="admin-read-meter">
                  <i style={{ width: `${order.readRate}%` }} />
                </div>
                <p>{order.readRate}% 열람 · 생성 {order.reportLatencySec}초 · 신고 {order.issueCount}건 · {order.reportStatus}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeView === 'issues' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>오류 신고</span>
              <h2>오류·오타·불일치 신고함</h2>
            </div>
            <p>심각도 높은 신고는 상품명, 주문번호, 원국 계산값, 결제 상태를 묶어서 먼저 검수합니다.</p>
          </div>

          <div className="admin-insight-grid">
            <InsightCard title="긴급 검수" value={`${highSeverityIssues}건`} body="계산값·결제·생성 실패 우선" icon={AlertTriangle} tone="warn" />
            <InsightCard title="처리 중" value={`${issueRows.filter((issue) => issue.status === '처리 중').length}건`} body="고객 재안내 전 내부 확인" icon={Activity} />
            <InsightCard title="대기" value={`${issueRows.filter((issue) => issue.status === '대기').length}건`} body="동일 유형 반복 여부 확인" icon={Clock} />
            <InsightCard title="운영 기준" value="24시간" body="유료 고객 신고는 하루 안에 답변하는 기준" icon={ShieldCheck} tone="good" />
          </div>

          <div className="admin-issue-list">
            {issueRows.map((issue) => (
              <article key={issue.id} className={issue.severity}>
                <MessageSquareWarning size={18} />
                <div>
                  <strong>{issue.type}</strong>
                  <p>{issue.customer} · {issue.product} · {issue.orderId}</p>
                </div>
                <span>{issue.status}</span>
                <small>{formatDateTime(issue.createdAt)}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeView === 'costs' ? (
        <>
          <section className="admin-dashboard-grid">
            <article className="admin-panel">
              <div className="admin-panel-head compact">
                <div>
                  <span>비용 구조</span>
                  <h2>비용 구조</h2>
                </div>
              </div>
              <div className="admin-cost-stack">
                <div><span>매출</span><strong>{formatCurrency(totalRevenue)}</strong></div>
                <div><span>Gemini/KASI 추정</span><strong>{formatCurrency(apiCost)}</strong></div>
                <div><span>결제 수수료 추정</span><strong>{formatCurrency(paymentFee)}</strong></div>
                <div><span>리포트 평균 생성</span><strong>{avgLatency}초</strong></div>
                <div className="net"><span>순매출 추정</span><strong>{formatCurrency(netRevenue)}</strong></div>
              </div>
            </article>
            <article className="admin-panel wide">
              <div className="admin-panel-head">
                <div>
                  <span>상품별 마진</span>
                  <h2>상품별 마진 감시</h2>
                </div>
                <p>저가 상품은 API 원가와 결제 수수료가 더 민감합니다.</p>
              </div>
              <div className="admin-margin-list enhanced">
                {productRows.map((service) => {
                  const cost = service.orders * 92 + service.revenue * 0.033;
                  const margin = service.revenue - cost;

                  return (
                    <article key={service.id}>
                      <strong>{service.label}</strong>
                      <span>{service.orders}건</span>
                      <em>{formatCurrency(service.revenue)}</em>
                      <b>{formatCurrency(margin)}</b>
                      <div className="admin-mini-bar">
                        <i style={{ width: `${Math.max(4, Math.min(100, service.share))}%` }} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>
          </section>
          <section className="admin-cost-product-grid">
            <ProductHeatmap rows={productRows} />
            <ProductPortfolioMatrix rows={productRows} />
          </section>
        </>
      ) : null}

      <section className="admin-data-note">
        <Database size={16} />
        <p>
          지금 화면은 {isSampleMode ? '샘플 주문' : adminAccessToken ? '서버 리포트 보관 기록' : '현재 브라우저의 리포트 보관 기록'} 기준입니다.
          주문·상품 기록과 분리해 유입 채널, 기기, 세션, 열람률, 생성 지연, 광고비는 아직 추정값입니다. 실측 운영 지표로 전환하려면
          `analytics_events`, `orders`, `payments`, `users`, `reports`, `report_issues`, 광고비 테이블과 서버 관리자 권한 검증을 연결해야 합니다.
        </p>
      </section>
    </main>
  );
}
