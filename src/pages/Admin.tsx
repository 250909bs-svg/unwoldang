import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  Clock,
  CreditCard,
  Database,
  Eye,
  LineChart,
  Lock,
  MessageSquareWarning,
  MousePointerClick,
  PieChart,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  Zap
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { findServiceById, serviceCatalog, serviceCategories, type ServiceCategoryId, type ServiceId } from '../api/mockData';
import { readStoredAuthUser } from '../lib/auth';
import { readReportArchiveEntries, type ReportArchiveEntry } from '../lib/reportArchive';

const ADMIN_SESSION_KEY = 'unwoldang.admin.session.v2';
const ADMIN_CREDENTIAL_HASH = '1772a644a9ccd340736c342b6dfe5b928d316deaa8646746b85cd2cf714a57ab';

type AdminView = 'overview' | 'funnel' | 'orders' | 'customers' | 'reports' | 'issues' | 'costs';
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
    paymentMethod: report.paymentMethod || 'toss',
    createdAt: report.createdAt,
    readRate: Math.min(98, 74 + index * 5),
    issueCount: 0,
    source: 'real',
    sourceChannel: channel,
    device: sampleDevices[index % sampleDevices.length],
    ageRange: sampleAges[index % sampleAges.length],
    reportLatencySec: 22 + index * 4,
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
      paymentMethod: index % 3 === 0 ? 'kakaoPay' : 'toss',
      createdAt,
      readRate: seed.readRate,
      issueCount: seed.issueCount || 0,
      source: 'sample',
      sourceChannel: seed.channel,
      device: seed.device,
      ageRange: seed.ageRange,
      reportLatencySec: seed.reportLatencySec
    };
  });
}

function countToday(orders: AdminOrder[]) {
  const today = new Date().toDateString();
  return orders.filter((order) => new Date(order.createdAt).toDateString() === today);
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
  const fallback = orders.slice(0, 4);
  const targets = issueOrders.length ? issueOrders : fallback;
  const issueTypes = ['오타 신고', '계산 불일치 확인', '결제 문의', '리포트 생성 지연'];

  return targets.map((order, index) => ({
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
  tone,
  icon: Icon
}: {
  title: string;
  value: string;
  delta: string;
  tone?: 'good' | 'warn' | 'blue';
  icon: IconComponent;
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
          <span>7 DAY REVENUE</span>
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
          <span>TIME BAND</span>
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
          <span>SEGMENT</span>
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
          <span>LIVE CUSTOMER JOURNEY</span>
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
          <span>OPERATION HEALTH</span>
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
          <span>PRODUCT HEATMAP</span>
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
          <span>TODAY ACTION BOARD</span>
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
        <span>NEXT BEST ACTION</span>
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
          <span>PAYMENT HISTORY</span>
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
          <span>ORDER DETAIL</span>
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
        <span>ORDER ACTION</span>
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
  const [isUnlocked, setIsUnlocked] = useState(() => window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'ok');
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [reports, setReports] = useState(() => readReportArchiveEntries());
  const authUser = readStoredAuthUser();
  const isLocalOnlyMode = isLocalAdminHost();
  const realOrders = useMemo(() => reports.map(toAdminOrder), [reports]);
  const isSampleMode = realOrders.length === 0;
  const orders = useMemo(() => (realOrders.length ? realOrders : buildSampleOrders()), [realOrders]);
  const todayOrders = useMemo(() => countToday(orders), [orders]);
  const paidOrders = orders.filter((order) => order.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
  const todayRevenue = todayOrders.filter((order) => order.status === 'paid').reduce((sum, order) => sum + order.amount, 0);
  const avgOrderValue = paidOrders.length ? totalRevenue / paidOrders.length : 0;
  const avgReadRate = paidOrders.length ? Math.round(paidOrders.reduce((sum, order) => sum + order.readRate, 0) / paidOrders.length) : 0;
  const avgLatency = paidOrders.length ? Math.round(paidOrders.reduce((sum, order) => sum + order.reportLatencySec, 0) / paidOrders.length) : 0;
  const funnel = useMemo(() => buildFunnel(orders), [orders]);
  const categoryRows = useMemo(() => buildCategoryRows(orders), [orders]);
  const customerRows = useMemo(() => buildCustomerRows(orders), [orders]);
  const customerProfiles = useMemo(() => buildCustomerProfiles(customerRows, orders, isSampleMode), [customerRows, orders, isSampleMode]);
  const issueRows = useMemo(() => buildIssueRows(orders), [orders]);
  const dailyTrend = useMemo(() => buildDailyTrend(orders), [orders]);
  const hourlyRows = useMemo(() => buildHourlyRows(orders), [orders]);
  const channelRows = useMemo(() => buildChannelRows(orders), [orders]);
  const deviceRows = useMemo(() => buildDeviceRows(orders), [orders]);
  const productRows = useMemo(() => buildProductRows(orders), [orders]);
  const customerSegments = useMemo(() => buildCustomerSegments(customerProfiles), [customerProfiles]);
  const filteredCustomerProfiles = useMemo(() => filterCustomerProfiles(customerProfiles, customerFilter), [customerProfiles, customerFilter]);
  const largestDrop = useMemo(() => getLargestDrop(funnel), [funnel]);
  const apiCost = paidOrders.length * 92;
  const paymentFee = totalRevenue * 0.033;
  const netRevenue = totalRevenue - apiCost - paymentFee;
  const successRate = getConversion(paidOrders.length, orders.length);
  const reportRead90 = getConversion(orders.filter((order) => order.readRate >= 90).length, orders.length);
  const mobileShare = getConversion(orders.filter((order) => order.device === 'mobile').length, orders.length);
  const bestProduct = productRows[0];
  const bestCategory = [...categoryRows].sort((left, right) => right.revenue - left.revenue)[0];
  const highSeverityIssues = issueRows.filter((issue) => issue.severity === 'high').length;
  const selectedCustomer = customerProfiles.find((profile) => profile.id === selectedCustomerId) || filteredCustomerProfiles[0] || customerProfiles[0];
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || orders[0];
  const selectedOrderCustomer = selectedOrder ? customerProfiles.find((profile) => profile.name === selectedOrder.customerName) : undefined;
  const marginRate = getConversion(netRevenue, totalRevenue || 1);
  const issueRate = getConversion(issueRows.length, orders.length);
  const healthItems = [
    { label: '결제', value: successRate, display: formatPercent(successRate), note: '성공/시도' },
    { label: '열람', value: avgReadRate, display: `${avgReadRate}%`, note: '평균 완독 신호' },
    { label: '마진', value: clamp(marginRate), display: formatPercent(marginRate), note: '추정 순매출' },
    { label: '속도', value: clamp(100 - avgLatency), display: `${avgLatency}초`, note: '생성 시간' },
    { label: '품질', value: clamp(100 - issueRate * 3), display: formatPercent(issueRate), note: '신고율' },
    { label: '모바일', value: mobileShare, display: formatPercent(mobileShare), note: '결제 비중' }
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

  const unlock = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setIsCheckingAccess(true);

    try {
      const credentialHash = await hashAdminCredential(adminId, adminPassword);

      if (credentialHash === ADMIN_CREDENTIAL_HASH) {
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
        setAdminPassword('');
        setIsUnlocked(true);
        setAccessError('');
        return;
      }

      setAccessError('아이디 또는 비밀번호가 맞지 않습니다.');
    } catch {
      setAccessError('브라우저 보안 모듈을 사용할 수 없어 로그인할 수 없습니다.');
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const lockAdmin = () => {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsUnlocked(false);
    setAdminPassword('');
  };

  const openView = (view: AdminView) => {
    setActiveView(view);

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    setReports(readReportArchiveEntries());
  };

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
          <Link to="/" className="admin-back-link">
            <ChevronLeft size={18} />
            홈으로
          </Link>
          <div>
            <span className="admin-kicker">UNWOLDANG COMMAND CENTER</span>
            <h1>운월당 운영 대시보드</h1>
            <p>결제, 이탈, 고객, 리포트 품질, 비용, 신고 큐를 한눈에 보는 운영 센터입니다.</p>
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
          <button type="button" onClick={lockAdmin}>
            <Lock size={16} />
            잠금
          </button>
        </div>
      </header>

      {isLocalOnlyMode ? (
        <section className="admin-warning">
          <ShieldCheck size={18} />
          <p>로컬 개발용 화면입니다. 출시용 어드민은 서버 권한 검증, DB, 관리자 접속 로그, 개인정보 접근 이력을 붙여야 합니다.</p>
        </section>
      ) : null}

      <section className="admin-top-categories">
        <div className="admin-top-category-head">
          <div>
            <span>OPERATIONS CATEGORY</span>
            <h2>카테고리별 상세 보기</h2>
          </div>
          <div className="admin-login-chip">
            <UserRound size={17} />
            <span>{authUser ? `${maskName(authUser.nickname)} · ${authUser.provider}` : '관리자 접속 중'}</span>
          </div>
        </div>

        <div className="admin-category-hub" aria-label="운영 카테고리">
          {categoryCards.map((card) => {
            const Icon = card.icon;

            return (
              <button
                key={card.id}
                type="button"
                className={`${activeView === card.id ? 'active' : ''} ${card.tone || ''}`}
                onClick={() => openView(card.id)}
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
        </div>
      </section>

      <section className={`admin-selected-category ${activeCategory.tone || ''}`}>
        <div>
          <span>SELECTED DETAIL</span>
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
          <MetricCard title="오늘 결제" value={`${todayPaidCount}건`} delta={formatCurrency(todayRevenue)} icon={CreditCard} tone="good" />
          <MetricCard title="총 매출" value={formatCurrency(totalRevenue)} delta={`객단가 ${formatCurrency(avgOrderValue)}`} icon={WalletCards} tone="good" />
          <MetricCard title="결제 성공률" value={formatPercent(successRate)} delta={`${paidOrders.length}/${orders.length}건 성공`} icon={TrendingUp} />
          <MetricCard title="리포트 열람" value={`${avgReadRate}%`} delta={`90% 이상 ${formatPercent(reportRead90)}`} icon={Eye} />
          <MetricCard title="이탈 집중 구간" value={formatPercent(largestDrop.drop)} delta={largestDrop.label} icon={MousePointerClick} tone="warn" />
          <MetricCard title="추정 순매출" value={formatCurrency(netRevenue)} delta={`API ${formatCurrency(apiCost)} · 수수료 ${formatCurrency(paymentFee)}`} icon={LineChart} tone="blue" />
        </section>
      ) : null}

      {activeView === 'overview' ? (
        <>
          <section className="admin-command-grid">
            <CustomerJourneyMap funnel={funnel} largestDrop={largestDrop} />
            <HealthRadar items={healthItems} />
          </section>

          <section className="admin-visual-grid">
            <ProductHeatmap rows={productRows} />
            <ActionCommand actions={actionRows} />
          </section>
        </>
      ) : null}

      {activeView === 'funnel' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>DROP-OFF ANALYSIS</span>
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
              <span>PAYMENT OPS</span>
              <h2>주문 관리</h2>
            </div>
            <p>주문번호, 유입, 기기, 금액, 리포트 생성 상태를 한 줄에서 확인합니다.</p>
          </div>

          <div className="admin-insight-grid">
            <InsightCard title="오늘 매출" value={formatCurrency(todayRevenue)} body={`${todayOrders.length}건의 결제 흐름`} icon={CalendarDays} tone="good" />
            <InsightCard title="대기 주문" value={`${orders.filter((order) => order.status === 'pending').length}건`} body="결제 콜백 또는 리포트 생성 확인" icon={Clock} />
            <InsightCard title="실패 주문" value={`${orders.filter((order) => order.status === 'failed').length}건`} body="토스 실패 콜백과 고객 안내 필요" icon={AlertTriangle} tone="warn" />
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
              orders={orders}
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
              <span>KAKAO CRM</span>
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
              orders={orders}
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
              <span>REPORT QUALITY</span>
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
              <span>ISSUE INBOX</span>
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
              <div><span>리포트 평균 생성</span><strong>{avgLatency}초</strong></div>
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
      ) : null}

      <section className="admin-data-note">
        <Database size={16} />
        <p>
          지금 화면은 {isSampleMode ? '샘플 데이터' : '현재 브라우저 저장 데이터'} 기준입니다. 실제 운영 데이터로 바꾸려면
          `analytics_events`, `orders`, `payments`, `users`, `reports`, `report_issues` 테이블과 서버 관리자 권한 검증을 연결하면 됩니다.
        </p>
      </section>
    </main>
  );
}
