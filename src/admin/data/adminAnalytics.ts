import { AlertTriangle, Eye, Sparkles, UserRound } from 'lucide-react';
import { serviceCatalog, serviceCategories, type ServiceCategoryId } from '../../api/mockData';
import { buildSampleSignupProfiles, sampleChannels, sampleDevices } from '../fixtures/sampleOrders';
import type {
  AdminDateRange,
  AdminGranularity,
  AdminOrder,
  CategoryRow,
  ChannelPerformanceRow,
  CustomerFilter,
  CustomerProfile,
  CustomerRow,
  DeviceType,
  FunnelStep,
  RetentionCohortRow
} from '../types/admin';
import { countToday, endOfDay, formatDayLabel, getDateKey, startOfDay } from '../utils/dateRanges';
import { getConversion } from '../utils/formatters';
import { maskEmail, maskName } from '../utils/masking';

export function buildFunnel(orders: AdminOrder[]): FunnelStep[] {
  if (!orders.length) {
    return [
      { key: 'home_view', label: '홈 방문', count: 0, benchmark: 0 },
      { key: 'product_detail_view', label: '상품 상세', count: 0, benchmark: 0 },
      { key: 'form_start', label: '입력 시작', count: 0, benchmark: 0 },
      { key: 'form_complete', label: '입력 완료', count: 0, benchmark: 0 },
      { key: 'checkout_view', label: '결제창 진입', count: 0, benchmark: 0 },
      { key: 'payment_success', label: '결제 성공', count: 0, benchmark: 0 },
      { key: 'report_view', label: '리포트 열람', count: 0, benchmark: 0 }
    ];
  }
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

export function buildCustomerRows(orders: AdminOrder[]): CustomerRow[] {
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

export function buildCustomerProfiles(customers: CustomerRow[], orders: AdminOrder[], includeSampleSignups: boolean): CustomerProfile[] {
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

  return [...profiles, ...buildSampleSignupProfiles()];
}

export function filterCustomerProfiles(profiles: CustomerProfile[], filter: CustomerFilter) {
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

export function buildIssueRows(orders: AdminOrder[]) {
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

export function buildCategoryRows(orders: AdminOrder[]): CategoryRow[] {
  return serviceCategories
    .filter((category): category is typeof category & { id: Exclude<ServiceCategoryId, 'all'> } => category.id !== 'all')
    .map((category) => {
      const categoryOrders = orders.filter((order) => order.category === category.id);
      const paidOrders = categoryOrders.filter((order) => order.status === 'paid');
      const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
      const views = categoryOrders.length ? Math.max(categoryOrders.length * 28 + 48, paidOrders.length * 31) : 0;

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

export function buildTimeSeries(orders: AdminOrder[], range: AdminDateRange, granularity: AdminGranularity) {
  const buckets: Array<{
    key: string;
    label: string;
    start: Date;
    end: Date;
  }> = [];

  if (granularity === 'hour') {
    Array.from({ length: 24 }, (_, hour) => {
      const start = new Date(range.start);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(59, 59, 999);
      buckets.push({
        key: `hour-${hour}`,
        label: `${String(hour).padStart(2, '0')}시`,
        start,
        end
      });
    });
  } else if (granularity === 'day') {
    const cursor = startOfDay(range.start);
    let guard = 0;

    while (cursor.getTime() <= range.end.getTime() && guard < 1100) {
      const start = new Date(cursor);
      const key = getDateKey(start);
      const includeYear = range.start.getFullYear() !== range.end.getFullYear();
      buckets.push({
        key,
        label: includeYear ? `${String(start.getFullYear()).slice(2)}.${start.getMonth() + 1}.${start.getDate()}` : formatDayLabel(key),
        start,
        end: endOfDay(start)
      });
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
  } else if (granularity === 'week') {
    const cursor = startOfDay(range.start);
    let guard = 0;

    while (cursor.getTime() <= range.end.getTime() && guard < 220) {
      const start = new Date(cursor);
      const end = endOfDay(new Date(start));
      end.setDate(end.getDate() + 6);
      const key = `week-${getDateKey(start)}`;
      buckets.push({
        key,
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        start,
        end: new Date(Math.min(end.getTime(), range.end.getTime()))
      });
      cursor.setDate(cursor.getDate() + 7);
      guard += 1;
    }
  } else {
    const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    let guard = 0;

    while (cursor.getTime() <= range.end.getTime() && guard < 120) {
      const start = new Date(cursor);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      buckets.push({
        key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        label: `${String(start.getFullYear()).slice(2)}.${start.getMonth() + 1}`,
        start,
        end: new Date(Math.min(end.getTime(), range.end.getTime()))
      });
      cursor.setMonth(cursor.getMonth() + 1);
      guard += 1;
    }
  }

  return buckets.map((bucket) => {
    const bucketOrders = orders.filter((order) => {
      const createdAt = new Date(order.createdAt);

      if (granularity === 'hour') {
        return createdAt.getHours() === Number(bucket.key.replace('hour-', ''));
      }

      const timestamp = createdAt.getTime();
      return timestamp >= bucket.start.getTime() && timestamp <= bucket.end.getTime();
    });
    const paidOrders = bucketOrders.filter((order) => order.status === 'paid');
    const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
    const visitors = bucketOrders.length ? Math.max(paidOrders.length, bucketOrders.length * 34 + Math.round(revenue / 9000)) : 0;

    return {
      key: bucket.key,
      label: bucket.label,
      orders: paidOrders.length,
      revenue,
      visitors,
      conversion: getConversion(paidOrders.length, visitors)
    };
  });
}

export function buildHourlyRows(orders: AdminOrder[]) {
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

export function buildChannelRows(orders: AdminOrder[]) {
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

export function buildChannelPerformanceRows(orders: AdminOrder[]): ChannelPerformanceRow[] {
  return sampleChannels
    .map((channel) => {
      const channelOrders = orders.filter((order) => order.sourceChannel === channel);
      const paidOrders = channelOrders.filter((order) => order.status === 'paid');
      const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
      const sessions = channelOrders.length
        ? Math.max(channelOrders.length * 12, paidOrders.length * 18 + (channel === '직접방문' ? 9 : 16))
        : 0;
      const isOwnedChannel = channel === '직접방문' || channel === '재방문';
      const estimatedSpend = isOwnedChannel || !sessions
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

export function getWeekStart(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const distance = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - distance);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function buildRetentionCohorts(profiles: CustomerProfile[]): RetentionCohortRow[] {
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

export function buildDeviceRows(orders: AdminOrder[]) {
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

export function buildProductRows(orders: AdminOrder[]) {
  const paidOrders = orders.filter((order) => order.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);

  return serviceCatalog
    .map((service) => {
      const serviceOrders = paidOrders.filter((order) => order.productId === service.id);
      const revenue = serviceOrders.reduce((sum, order) => sum + order.amount, 0);
      const avgReadRate = serviceOrders.length
        ? Math.round(serviceOrders.reduce((sum, order) => sum + order.readRate, 0) / serviceOrders.length)
        : 0;
      const estimatedViews = serviceOrders.length ? Math.max(serviceOrders.length * 24 + 24, serviceOrders.length + 1) : 0;

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

export function buildCustomerSegments(customers: CustomerRow[]) {
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

export function getLargestDrop(funnel: FunnelStep[]) {
  if (!funnel.length || funnel.every((step) => step.count === 0)) {
    return { label: '데이터 없음', drop: 0 };
  }
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
