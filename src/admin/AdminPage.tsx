import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Database,
  Lock,
  MessageSquareWarning,
  MousePointerClick,
  RefreshCw,
  Search,
  Server,
  ScrollText,
  ShieldCheck,
  UserRound,
  Users,
  WalletCards,
  X
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  buildCategoryRows,
  buildChannelPerformanceRows,
  buildChannelRows,
  buildCustomerProfiles,
  buildCustomerRows,
  buildCustomerSegments,
  buildDeviceRows,
  buildFunnel,
  buildHourlyRows,
  buildIssueRows,
  buildProductRows,
  buildRetentionCohorts,
  buildTimeSeries,
  filterCustomerProfiles,
  getLargestDrop
} from './data/adminAnalytics';
import { resolveAdminData } from './data/adminDataSource';
import { toAdminOrder } from './data/orderMapper';
import { useAdminAccess } from './hooks/useAdminAccess';
import { useAdminReports } from './hooks/useAdminReports';
import { useAdminUiState } from './hooks/useAdminUiState';
import type {
  AdminComparison,
  AdminGranularity,
  AdminPeriod,
  AdminView,
  CustomerFilter,
  ExecutiveAlert,
  IconComponent
} from './types/admin';
import {
  countToday,
  filterOrdersByRange,
  formatDateRange,
  getAdminDateRange,
  getComparisonDateRange,
  getDateKey,
  getDefaultGranularity,
  getRangeDays
} from './utils/dateRanges';
import {
  clamp,
  formatCurrency,
  formatPercent,
  getChangeRate,
  getConversion
} from './utils/formatters';
import { maskName } from './utils/masking';
import { Costs } from './views/Costs';
import { Customers } from './views/Customers';
import { Funnel } from './views/Funnel';
import { Issues } from './views/Issues';
import { Orders } from './views/Orders';
import { Overview } from './views/Overview';
import { Reports } from './views/Reports';
import './admin.css';

export default function Admin() {
  const {
    adminId,
    setAdminId,
    adminPassword,
    setAdminPassword,
    accessError,
    adminAccessToken,
    isUnlocked,
    isCheckingAccess,
    isVerifyingSession,
    bootstrapReports,
    isLocalOnlyMode,
    isAdminAvailable,
    unlock,
    lockAdmin,
    handleSessionExpired
  } = useAdminAccess();
  const { reports, reportsError, isRefreshing, lastUpdatedAt, refresh } = useAdminReports({
    adminAccessToken,
    isUnlocked,
    bootstrapReports,
    onSessionExpired: handleSessionExpired
  });
  const [uiState, dispatchUi] = useAdminUiState();
  const {
    activeView,
    customerFilter,
    selectedCustomerId,
    selectedOrderId,
    period,
    customStart,
    customEnd,
    granularity,
    comparison,
    adminSearch,
    isSearchOpen
  } = uiState;
  const setActiveView = (view: AdminView) => dispatchUi({ type: 'select-view', view });
  const setCustomerFilter = (filter: CustomerFilter) => dispatchUi({ type: 'select-customer-filter', filter });
  const setSelectedCustomerId = (customerId: string) => dispatchUi({ type: 'select-customer', customerId });
  const setSelectedOrderId = (orderId: string) => dispatchUi({ type: 'select-order', orderId });
  const setPeriod = (nextPeriod: AdminPeriod) => {
    if (nextPeriod !== 'custom') {
      dispatchUi({ type: 'select-preset-period', period: nextPeriod });
    }
  };
  const setCustomStart = (value: string) => dispatchUi({ type: 'change-custom-start', value });
  const setCustomEnd = (value: string) => dispatchUi({ type: 'change-custom-end', value });
  const setGranularity = (nextGranularity: AdminGranularity) =>
    dispatchUi({ type: 'select-granularity', granularity: nextGranularity });
  const setComparison = (nextComparison: AdminComparison) =>
    dispatchUi({ type: 'select-comparison', comparison: nextComparison });
  const setAdminSearch = (value: string) => dispatchUi({ type: 'change-search', value });
  const setIsSearchOpen = (isOpen: boolean) => dispatchUi({ type: isOpen ? 'open-search' : 'close-search' });
  const realOrders = useMemo(() => reports.map(toAdminOrder), [reports]);
  const { mode: dataMode, orders: allOrders } = useMemo(
    () =>
      resolveAdminData(realOrders, {
        isDev: import.meta.env.DEV,
        fixtureEnabled: import.meta.env.VITE_ENABLE_ADMIN_SAMPLE_DATA === 'true'
      }),
    [realOrders]
  );
  const isSampleMode = dataMode === 'sample';
  const dataSourceLabel =
    dataMode === 'sample'
      ? '개발 전용 샘플'
      : dataMode === 'real'
        ? adminAccessToken
          ? '서버 리포트 보관 기록'
          : '브라우저 보관 기록'
        : '연결된 데이터 없음';
  const dataModeLabel =
    dataMode === 'sample'
      ? '개발 샘플 데이터'
      : dataMode === 'real'
        ? '실제 리포트 기록 · 미수집 지표 제외'
        : '데이터 없음';
  const selectedRange = useMemo(
    () => getAdminDateRange(period, allOrders, customStart, customEnd),
    [allOrders, customEnd, customStart, period]
  );
  const comparisonRange = useMemo(
    () => getComparisonDateRange(selectedRange, comparison),
    [comparison, selectedRange]
  );
  const yesterdayRange = useMemo(
    () => getAdminDateRange('yesterday', allOrders, customStart, customEnd),
    [allOrders, customEnd, customStart]
  );
  const orders = useMemo(() => filterOrdersByRange(allOrders, selectedRange), [allOrders, selectedRange]);
  const previousOrders = useMemo(() => filterOrdersByRange(allOrders, comparisonRange), [allOrders, comparisonRange]);
  const previousDayOrders = useMemo(() => filterOrdersByRange(allOrders, yesterdayRange), [allOrders, yesterdayRange]);
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
  const timeSeries = useMemo(
    () => buildTimeSeries(orders, selectedRange, granularity),
    [granularity, orders, selectedRange]
  );
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
  const bestProduct = productRows.find((row) => row.status === 'active' && row.orders > 0);
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
  const periodDays = getRangeDays(selectedRange);
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
    { label: '결제', value: hasEstimatedAnalytics ? successRate : 0, display: hasEstimatedAnalytics ? formatPercent(successRate) : '미수집', note: hasEstimatedAnalytics ? '성공/시도' : '주문 원장 필요' },
    { label: '열람', value: hasEstimatedAnalytics ? avgReadRate : 0, display: hasEstimatedAnalytics ? `${avgReadRate}%` : '미수집', note: hasEstimatedAnalytics ? '평균 완독 신호' : '열람 이벤트 필요' },
    { label: '마진', value: clamp(marginRate), display: formatPercent(marginRate), note: '카탈로그 기준 추정' },
    { label: '속도', value: hasEstimatedAnalytics ? clamp(100 - avgLatency) : 0, display: hasEstimatedAnalytics ? `${avgLatency}초` : '미수집', note: hasEstimatedAnalytics ? '생성 시간' : '생성 이벤트 필요' },
    { label: '품질', value: hasEstimatedAnalytics ? clamp(100 - issueRate * 3) : 0, display: hasEstimatedAnalytics ? formatPercent(issueRate) : '미수집', note: hasEstimatedAnalytics ? '신고율' : '신고 이벤트 필요' },
    { label: '모바일', value: hasEstimatedAnalytics ? mobileShare : 0, display: hasEstimatedAnalytics ? formatPercent(mobileShare) : '미수집', note: hasEstimatedAnalytics ? '결제 비중' : '기기 이벤트 필요' }
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
      severity: hasEstimatedAnalytics ? successRate < 85 ? 'critical' : successRate < 95 ? 'warning' : 'stable' : 'watch',
      title: hasEstimatedAnalytics ? successRate < 95 ? '결제 성공률이 목표선 아래입니다' : '결제 흐름이 안정적입니다' : '실제 주문 성공률을 확인할 수 없습니다',
      metric: hasEstimatedAnalytics ? formatPercent(successRate) : '미수집',
      body: hasEstimatedAnalytics
        ? successRate < 95
          ? '실패 콜백, 중복 클릭, 모바일 결제창 복귀 경로를 순서대로 확인하세요.'
          : '실패 주문만 개별 확인하고 결제 흐름은 유지해도 됩니다.'
        : '현재 관리자 API는 완료된 리포트 보관 기록만 제공하며 실패·대기·환불 주문 원장은 제공하지 않습니다.',
      owner: '결제 운영',
      sla: hasEstimatedAnalytics ? successRate < 85 ? '30분 이내' : '오늘 중' : 'API 계약 필요'
    },
    {
      id: 'report-latency',
      severity: hasEstimatedAnalytics ? avgLatency > 60 ? 'critical' : avgLatency > 45 ? 'warning' : 'stable' : 'watch',
      title: hasEstimatedAnalytics ? avgLatency > 45 ? '리포트 생성 지연을 관찰해야 합니다' : '리포트 생성 속도가 안정권입니다' : '리포트 생성 시간 이벤트가 없습니다',
      metric: hasEstimatedAnalytics ? `${avgLatency}초` : '미수집',
      body: hasEstimatedAnalytics
        ? avgLatency > 45
          ? 'Gemini 응답 시간과 재시도 횟수, 로딩 중 이탈률을 같은 시간축으로 확인하세요.'
          : '현재 속도를 기준선으로 저장하고 45초 초과 시 자동 알림을 연결하세요.'
        : '생성 지연을 추정하지 않으며 서버 측 생성 상태·시간 계약이 필요합니다.',
      owner: 'AI 품질',
      sla: hasEstimatedAnalytics ? avgLatency > 60 ? '1시간 이내' : '24시간' : '이벤트 연결 필요'
    },
    {
      id: 'funnel-drop',
      severity: hasEstimatedAnalytics && largestDrop.drop >= 60 ? 'warning' : 'watch',
      title: hasEstimatedAnalytics ? `${largestDrop.label}에서 고객이 가장 많이 빠집니다` : '유입·전환 이벤트가 연결되지 않았습니다',
      metric: hasEstimatedAnalytics ? formatPercent(largestDrop.drop) : '미수집',
      body: hasEstimatedAnalytics ? '이 구간의 가격, 필수 입력, 버튼 위치를 한 번에 바꾸지 말고 한 요소씩 실험하세요.' : '방문·입력·결제창 이벤트가 없으므로 병목을 추정하지 않습니다.',
      owner: '전환 최적화',
      sla: hasEstimatedAnalytics ? '이번 주' : '이벤트 연결 필요'
    },
    {
      id: 'quality-issues',
      severity: hasEstimatedAnalytics ? highSeverityIssues ? 'critical' : issueRows.length ? 'warning' : 'stable' : 'watch',
      title: hasEstimatedAnalytics ? issueRows.length ? '고객 신고 검수 큐가 남아 있습니다' : '미처리 고객 신고가 없습니다' : '고객 신고 이벤트가 연결되지 않았습니다',
      metric: hasEstimatedAnalytics ? `${issueRows.length}건` : '미수집',
      body: hasEstimatedAnalytics
        ? issueRows.length
          ? '계산 불일치와 결제 실패를 먼저 처리하고, 오타 신고는 같은 템플릿 반복 여부를 확인하세요.'
          : '신고 없는 상태를 유지하되 원국 회귀 테스트와 문장 검수는 배포마다 실행하세요.'
        : '신고가 0건이라고 간주하지 않으며 report_issues 계약이 필요합니다.',
      owner: '고객 품질',
      sla: hasEstimatedAnalytics ? highSeverityIssues ? '2시간 이내' : '24시간' : '이벤트 연결 필요'
    }
  ];
  const actionRows = [
    {
      status: '매출',
      title: hasEstimatedAnalytics ? `${largestDrop.label} 병목 개선` : '유입 분석 데이터 연결',
      body: hasEstimatedAnalytics ? `이탈 ${formatPercent(largestDrop.drop)} 구간입니다. 이 단계의 버튼, 금액 안내, 로딩 문구를 가장 먼저 줄여보세요.` : '실측 방문·입력·결제창 이벤트가 없으므로 이탈 구간을 추정하지 않습니다.',
      tone: 'warn' as const
    },
    {
      status: '상품',
      title: bestProduct ? `판매 중 ${bestProduct.label} 성과 확인` : '판매 중 상품 기록 미수집',
      body: bestProduct ? `현재 ${dataMode === 'real' ? '카탈로그 합계' : '매출'} 비중 ${formatPercent(bestProduct.share)}입니다. active 상품 안에서만 판매 노출을 검토합니다.` : 'archived 과거 기록은 조회만 유지하고 신규 판매 추천에 사용하지 않습니다.',
      tone: 'good' as const
    },
    {
      status: '품질',
      title: hasEstimatedAnalytics ? `리포트 생성 ${avgLatency}초 관리` : '리포트 품질 이벤트 미수집',
      body: hasEstimatedAnalytics ? avgLatency > 45 ? '로딩 화면에서 원국·오행 미리보기와 진행 문구를 더 촘촘하게 보여줘야 합니다.' : '현재 속도는 안정권입니다. 실패 주문과 신고 큐만 먼저 확인하면 됩니다.' : '생성 시간·열람률·신고율을 추정하지 않습니다.'
    },
    {
      status: 'CRM',
      title: hasEstimatedAnalytics ? `${customerSegments[1]?.value || 0}명 재구매 후보` : '고객 행동 분석 미수집',
      body: hasEstimatedAnalytics ? '열람률이 높은 고객에게 판매 중인 후속 상품 동선을 검토합니다.' : '실제 열람·재방문 이벤트가 연결되기 전에는 재구매 후보를 추정하지 않습니다.'
    }
  ];
  const periodLabels: Record<AdminPeriod, string> = {
    today: '오늘',
    yesterday: '어제',
    '7d': '최근 7일',
    '30d': '최근 30일',
    month: '이번 달',
    quarter: '이번 분기',
    year: '올해',
    all: '전체 기간',
    custom: '직접 지정'
  };
  const granularityLabels: Record<AdminGranularity, string> = {
    hour: '시간대별',
    day: '일별',
    week: '주별',
    month: '월별'
  };
  const comparisonLabels: Record<AdminComparison, string> = {
    previous: '직전 기간',
    yearAgo: '전년 동기',
    none: '비교 안 함'
  };
  const selectedRangeLabel = formatDateRange(selectedRange);
  const comparisonRangeLabel = comparisonRange ? formatDateRange(comparisonRange) : '';
  const trendLabel = comparisonLabels[comparison];
  const todayInputKey = getDateKey(new Date());
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

  const openView = (view: AdminView) => {
    setActiveView(view);

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const selectPeriod = (nextPeriod: Exclude<AdminPeriod, 'custom'>) => {
    setPeriod(nextPeriod);
    setGranularity(getDefaultGranularity(nextPeriod));
  };

  const updateCustomStart = (value: string) => {
    setCustomStart(value);
    setPeriod('custom');
    setGranularity('day');
  };

  const updateCustomEnd = (value: string) => {
    setCustomEnd(value);
    setPeriod('custom');
    setGranularity('day');
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
      detailBody: dataMode === 'real' ? '완료 리포트 기록과 카탈로그 가격 합계를 보여주며 미수집 운영 지표는 추정하지 않습니다.' : '매출, 이탈, 상품 성과, 액션 큐를 압축해서 보는 관제 화면입니다. 하루 시작할 때 이 화면만 먼저 보면 됩니다.',
      highlights: [
        { label: dataMode === 'real' ? '오늘 완료 리포트' : '오늘 결제', value: `${todayPaidCount}건` },
        { label: dataMode === 'real' ? '카탈로그 합계' : '오늘 매출', value: formatCurrency(todayRevenue) },
        { label: '판매 중 주력', value: bestProduct?.label || '데이터 없음' }
      ],
      icon: BarChart3,
      tone: 'good'
    },
    {
      id: 'funnel',
      label: '유입·이탈',
      value: hasEstimatedAnalytics ? formatPercent(largestDrop.drop) : '미수집',
      description: hasEstimatedAnalytics ? '고객이 빠지는 구간' : '유입 이벤트 미수집',
      detailTitle: '방문부터 결제까지 이탈 구간 분석',
      detailBody: '홈 방문, 상품 상세, 입력폼, 결제창, 리포트 열람까지 이어지는 흐름을 단계별로 분리해서 봅니다.',
      highlights: [
        { label: '최대 이탈', value: hasEstimatedAnalytics ? formatPercent(largestDrop.drop) : '미수집' },
        { label: '병목 구간', value: largestDrop.label },
        { label: '모바일 비중', value: hasEstimatedAnalytics ? formatPercent(mobileShare) : '미수집' }
      ],
      icon: MousePointerClick,
      tone: 'warn'
    },
    {
      id: 'orders',
      label: '결제·주문',
      value: dataMode === 'real' ? `${formatCurrency(todayRevenue)} · 카탈로그` : formatCurrency(todayRevenue),
      description: dataMode === 'real' ? '완료 리포트 보관 기록 기준' : '주문과 결제 상태',
      detailTitle: dataMode === 'real' ? '완료된 리포트 보관 기록 관리' : '결제 성공, 대기, 실패 주문 관리',
      detailBody: dataMode === 'real' ? '현재 관리자 API가 제공하는 완료 리포트 기록을 표시합니다. 실패·대기·환불 주문 원장은 미수집입니다.' : '주문번호, 고객, 유입 채널, 기기, 결제 상태, 리포트 생성 상태를 한 번에 확인합니다.',
      highlights: [
        { label: '성공률', value: hasEstimatedAnalytics ? formatPercent(successRate) : '미수집' },
        { label: '대기 주문', value: hasEstimatedAnalytics ? `${orders.filter((order) => order.status === 'pending').length}건` : '미수집' },
        { label: '실패 주문', value: hasEstimatedAnalytics ? `${orders.filter((order) => order.status === 'failed').length}건` : '미수집' }
      ],
      icon: CreditCard,
      tone: 'good'
    },
    {
      id: 'customers',
      label: '고객·카카오',
      value: `${customerProfiles.length}명`,
      description: '고객군과 재구매',
      detailTitle: hasEstimatedAnalytics ? '카카오 고객과 재구매 후보 관리' : '리포트 고객 기록 관리',
      detailBody: hasEstimatedAnalytics ? '고객을 마스킹해서 보되, 구매 횟수, 누적 매출, 열람률로 재구매 가능성을 빠르게 나눕니다.' : '리포트 기록의 고객명은 마스킹하고, 가입·열람·재방문 지표와 실제 결제액은 추정하지 않습니다.',
      highlights: [
        { label: '전체 고객', value: `${customerProfiles.length}명` },
        { label: '고관여', value: hasEstimatedAnalytics ? `${customerSegments[1]?.value || 0}명` : '미수집' },
        { label: hasEstimatedAnalytics ? 'VIP 후보' : '반복 리포트', value: `${customerSegments[0]?.value || 0}명` }
      ],
      icon: Users,
      tone: 'blue'
    },
    {
      id: 'reports',
      label: '리포트 품질',
      value: hasEstimatedAnalytics ? `${avgReadRate}%` : '미수집',
      description: hasEstimatedAnalytics ? '열람과 생성 속도' : '품질 이벤트 미수집',
      detailTitle: '리포트 만족도와 생성 품질 확인',
      detailBody: '열람률, 생성 시간, 신고율을 함께 보고 고객이 끝까지 읽는 결과지인지 확인합니다.',
      highlights: [
        { label: '평균 열람', value: hasEstimatedAnalytics ? `${avgReadRate}%` : '미수집' },
        { label: '90% 이상', value: hasEstimatedAnalytics ? formatPercent(reportRead90) : '미수집' },
        { label: '생성 시간', value: hasEstimatedAnalytics ? `${avgLatency}초` : '미수집' }
      ],
      icon: ScrollText
    },
    {
      id: 'issues',
      label: '오류 신고',
      value: hasEstimatedAnalytics ? `${highSeverityIssues}건` : '미수집',
      description: hasEstimatedAnalytics ? '검수와 문의 처리' : '신고 API 미수집',
      detailTitle: '오류, 오타, 계산 불일치 신고함',
      detailBody: '신고가 들어온 리포트와 주문을 묶어서 보고, 심각도 높은 건부터 처리할 수 있게 정리합니다.',
      highlights: [
        { label: '긴급 검수', value: hasEstimatedAnalytics ? `${highSeverityIssues}건` : '미수집' },
        { label: '총 신고', value: hasEstimatedAnalytics ? `${issueRows.length}건` : '미수집' },
        { label: '신고율', value: hasEstimatedAnalytics ? formatPercent(issueRate) : '미수집' }
      ],
      icon: MessageSquareWarning,
      tone: highSeverityIssues ? 'warn' : undefined
    },
    {
      id: 'costs',
      label: '비용·마진',
      value: `${formatCurrency(netRevenue)} · 추정`,
      description: dataMode === 'real' ? '카탈로그 기준 원가 추정' : '원가와 순매출',
      detailTitle: 'API 비용, 결제 수수료, 상품별 마진 추정',
      detailBody: dataMode === 'real' ? '실제 결제액과 원가 API가 없어 카탈로그 가격과 고정 비용 가정으로 계산한 추정치입니다.' : '저가 상품이 실제로 남는지, API 비용과 결제 수수료를 제외한 순매출을 확인합니다.',
      highlights: [
        { label: '순매출 추정', value: formatCurrency(netRevenue) },
        { label: '마진율 추정', value: formatPercent(marginRate) },
        { label: 'API 비용 추정', value: formatCurrency(apiCost) }
      ],
      icon: WalletCards,
      tone: 'blue'
    }
  ];
  const activeCategory = categoryCards.find((card) => card.id === activeView) || categoryCards[0];

  if (isVerifyingSession) {
    return (
      <main className="admin-page">
        <section className="admin-lock-card" aria-live="polite">
          <span className="admin-icon-circle">
            <ShieldCheck size={24} />
          </span>
          <h1>관리자 세션 확인 중</h1>
          <p>저장된 토큰을 서버에서 검증한 뒤 관리자 데이터를 표시합니다.</p>
        </section>
      </main>
    );
  }


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
          {accessError ? <small role="alert">{accessError}</small> : null}
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
          <span className={`admin-mode-badge ${dataMode}`}>
            {dataModeLabel}
          </span>
          <button type="button" onClick={refresh} title="데이터 새로고침" disabled={isRefreshing}>
            <RefreshCw size={16} />
            <span>{isRefreshing ? '동기화 중' : '새로고침'}</span>
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

      {reportsError ? (
        <section className="admin-warning admin-api-error" role="alert">
          <MessageSquareWarning size={18} />
          <p>{reportsError}</p>
        </section>
      ) : null}

      <section className="admin-operations-bar">
        <div>
          <span className="admin-live-label"><i /> {dataMode === 'sample' ? '개발 샘플 운영' : dataMode === 'real' ? '보관 기록 운영' : '관리자 데이터'}</span>
          <h1>{activeCategory.detailTitle}</h1>
          <p>{periodLabels[period]} · {selectedRangeLabel} · 마지막 동기화 {new Date(lastUpdatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="admin-period-control" role="group" aria-label="분석 기간">
          {([
            ['today', '오늘'],
            ['yesterday', '어제'],
            ['7d', '7일'],
            ['30d', '30일'],
            ['month', '이번 달'],
            ['quarter', '분기'],
            ['year', '올해'],
            ['all', '전체']
          ] as Array<[Exclude<AdminPeriod, 'custom'>, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={period === id ? 'active' : ''}
              onClick={() => selectPeriod(id)}
              aria-pressed={period === id}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="admin-date-command" aria-label="기간 상세 설정">
        <div className="admin-date-summary">
          <span className="admin-date-icon"><CalendarDays size={18} /></span>
          <div>
            <small>현재 분석 범위</small>
            <strong>{selectedRangeLabel}</strong>
            <span>{periodDays.toLocaleString('ko-KR')}일 · 주문 {orders.length.toLocaleString('ko-KR')}건 · 결제 {paidOrders.length.toLocaleString('ko-KR')}건</span>
          </div>
        </div>

        <div className="admin-date-fields">
          <label>
            <span>시작일</span>
            <input
              type="date"
              value={customStart}
              max={customEnd || todayInputKey}
              onChange={(event) => updateCustomStart(event.target.value)}
              aria-label="분석 시작일"
            />
          </label>
          <i>~</i>
          <label>
            <span>종료일</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={todayInputKey}
              onChange={(event) => updateCustomEnd(event.target.value)}
              aria-label="분석 종료일"
            />
          </label>
        </div>

        <div className="admin-date-segment">
          <span>집계 단위</span>
          <div role="group" aria-label="그래프 집계 단위">
            {([
              ['hour', '시간'],
              ['day', '일'],
              ['week', '주'],
              ['month', '월']
            ] as Array<[AdminGranularity, string]>).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={granularity === id ? 'active' : ''}
                onClick={() => setGranularity(id)}
                aria-pressed={granularity === id}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-date-segment comparison">
          <span>비교 기준</span>
          <div role="group" aria-label="비교 기준">
            {([
              ['previous', '직전'],
              ['yearAgo', '전년'],
              ['none', '없음']
            ] as Array<[AdminComparison, string]>).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={comparison === id ? 'active' : ''}
                onClick={() => setComparison(id)}
                aria-pressed={comparison === id}
              >
                {label}
              </button>
            ))}
          </div>
          <small>{comparisonRangeLabel || '비교 지표를 숨깁니다'}</small>
        </div>
      </section>

      <section className="admin-system-strip" aria-label="핵심 운영 상태">
        <article className={hasEstimatedAnalytics ? successRate < 90 ? 'warn' : 'good' : ''}>
          <CheckCircle2 size={17} />
          <span>결제 시스템</span>
          <strong>{hasEstimatedAnalytics ? successRate >= 90 ? '정상' : '점검 필요' : dataMode === 'empty' ? '데이터 없음' : '미수집'}</strong>
          <small>{hasEstimatedAnalytics ? `성공률 ${formatPercent(successRate)}` : '실제 주문 원장 필요'}</small>
        </article>
        <article className={hasEstimatedAnalytics ? avgLatency > 45 ? 'warn' : 'good' : ''}>
          <Activity size={17} />
          <span>AI 리포트</span>
          <strong>{hasEstimatedAnalytics ? avgLatency > 45 ? '지연 관찰' : '안정' : dataMode === 'empty' ? '데이터 없음' : '미수집'}</strong>
          <small>{hasEstimatedAnalytics ? `평균 ${avgLatency}초` : '생성 시간 이벤트 필요'}</small>
        </article>
        <article>
          <Server size={17} />
          <span>데이터 소스</span>
          <strong>{dataSourceLabel}</strong>
          <small>{allOrders.length.toLocaleString('ko-KR')}개 기록</small>
        </article>
        <article className={hasEstimatedAnalytics ? highSeverityIssues ? 'warn' : 'good' : ''}>
          <MessageSquareWarning size={17} />
          <span>긴급 검수</span>
          <strong>{hasEstimatedAnalytics ? highSeverityIssues ? `${highSeverityIssues}건 대기` : '대기 없음' : dataMode === 'empty' ? '데이터 없음' : '미수집'}</strong>
          <small>{hasEstimatedAnalytics ? `전체 신고 ${issueRows.length}건` : '신고 이벤트 필요'}</small>
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

      {dataMode === 'empty' ? (
        <section className="admin-panel admin-empty">
          <Database size={22} />
          <h2>표시할 실제 관리자 데이터가 없습니다</h2>
          <p>운영 화면에는 샘플 fixture가 자동으로 합쳐지지 않습니다. 서버 또는 브라우저 보관 기록을 연결한 뒤 새로고침하세요.</p>
        </section>
      ) : null}

      {dataMode !== 'empty' && activeView === 'overview' ? (
        <Overview
          todayPaidCount={todayPaidCount}
          todayPaidChange={todayPaidChange}
          todayRevenue={todayRevenue}
          previousDayRevenue={previousDayRevenue}
          periodLabels={periodLabels}
          period={period}
          totalRevenue={totalRevenue}
          avgOrderValue={avgOrderValue}
          aovChange={aovChange}
          revenueChange={revenueChange}
          successRate={successRate}
          paidOrders={paidOrders}
          orders={orders}
          successRateChange={successRateChange}
          trendLabel={trendLabel}
          avgReadRate={avgReadRate}
          reportRead90={reportRead90}
          readRateChange={readRateChange}
          largestDrop={largestDrop}
          comparison={comparison}
          previousLargestDrop={previousLargestDrop}
          netRevenue={netRevenue}
          apiCost={apiCost}
          paymentFee={paymentFee}
          netRevenueChange={netRevenueChange}
          healthScore={healthScore}
          forecastRevenue={forecastRevenue}
          opportunityRevenue={opportunityRevenue}
          repeatRate={repeatRate}
          bestChannel={bestChannel}
          hasEstimatedAnalytics={hasEstimatedAnalytics}
          executiveAlerts={executiveAlerts}
          timeSeries={timeSeries}
          granularityLabels={granularityLabels}
          granularity={granularity}
          selectedRangeLabel={selectedRangeLabel}
          channelRows={channelRows}
          allOrders={allOrders}
          setSelectedOrderId={setSelectedOrderId}
          setActiveView={setActiveView}
          funnel={funnel}
          healthItems={healthItems}
          channelPerformanceRows={channelPerformanceRows}
          retentionCohorts={retentionCohorts}
          productRows={productRows}
          actionRows={actionRows}
        />
      ) : null}

      {dataMode !== 'empty' && activeView === 'funnel' ? <Funnel largestDrop={largestDrop} funnel={funnel} mobileShare={mobileShare} /> : null}

      {dataMode !== 'empty' && activeView === 'orders' ? (
        <Orders
          todayRevenue={todayRevenue}
          todayOrders={todayOrders}
          orders={orders}
          mobileShare={mobileShare}
          timeSeries={timeSeries}
          granularityLabels={granularityLabels}
          granularity={granularity}
          selectedRangeLabel={selectedRangeLabel}
          hourlyRows={hourlyRows}
          channelRows={channelRows}
          selectedOrder={selectedOrder}
          selectedOrderCustomer={selectedOrderCustomer}
          setSelectedCustomerId={setSelectedCustomerId}
          setActiveView={setActiveView}
          allOrders={allOrders}
          setSelectedOrderId={setSelectedOrderId}
        />
      ) : null}

      {dataMode !== 'empty' && activeView === 'customers' ? (
        <Customers
          customerSegments={customerSegments}
          customerProfiles={customerProfiles}
          customerFilter={customerFilter}
          setCustomerFilter={setCustomerFilter}
          setSelectedCustomerId={setSelectedCustomerId}
          selectedCustomer={selectedCustomer}
          allOrders={allOrders}
          setSelectedOrderId={setSelectedOrderId}
          setActiveView={setActiveView}
          selectedOrder={selectedOrder}
          selectedOrderCustomer={selectedOrderCustomer}
          filteredCustomerProfiles={filteredCustomerProfiles}
        />
      ) : null}

      {dataMode !== 'empty' && activeView === 'reports' ? (
        <Reports
          deviceRows={deviceRows}
          avgReadRate={avgReadRate}
          avgLatency={avgLatency}
          issueRows={issueRows}
          orders={orders}
        />
      ) : null}

      {dataMode !== 'empty' && activeView === 'issues' ? <Issues highSeverityIssues={highSeverityIssues} issueRows={issueRows} hasIssueData={hasEstimatedAnalytics} /> : null}

      {dataMode !== 'empty' && activeView === 'costs' ? (
        <Costs
          totalRevenue={totalRevenue}
          apiCost={apiCost}
          paymentFee={paymentFee}
          avgLatency={avgLatency}
          netRevenue={netRevenue}
          productRows={productRows}
        />
      ) : null}

      <section className="admin-data-note">
        <Database size={16} />
        <p>
          기록 기준: {dataSourceLabel}.{' '}
          {dataMode === 'sample'
            ? '현재 값은 개발 전용 fixture이며 실제 운영 실적이 아닙니다.'
            : dataMode === 'real'
              ? `${adminAccessToken ? '서버' : '브라우저'} 리포트 보관 기록과 상품 registry 가격만 사용합니다. 관리자 API가 제공하지 않는 실제 결제 금액, 유입, 기기, 세션, 열람률, 생성 지연, 광고비는 미수집으로 표시하며 추정 트래픽을 만들지 않습니다.`
              : '실제 기록이 없고 개발 fixture도 비활성화되어 있습니다. 운영 빌드에는 샘플 데이터가 자동 추가되지 않습니다.'}{' '}
          실측 운영 지표로 전환하려면 `analytics_events`, `orders`, `payments`, `users`, `reports`, `report_issues`,
          광고비 테이블과 서버 관리자 권한 검증을 연결해야 합니다.
        </p>
      </section>
    </main>
  );
}
