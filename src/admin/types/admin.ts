import type { LucideIcon } from 'lucide-react';
import type { ServiceCategoryId } from '../../api/mockData';
import type { ReportArchiveEntry } from '../../lib/reportArchive';
import type { ProductStatus } from '../../products';

export type AdminView = 'overview' | 'funnel' | 'orders' | 'customers' | 'reports' | 'issues' | 'costs';

export type AdminPeriod =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'month'
  | 'quarter'
  | 'year'
  | 'all'
  | 'custom';

export type AdminGranularity = 'hour' | 'day' | 'week' | 'month';

export type AdminComparison = 'previous' | 'yearAgo' | 'none';

export type AdminDateRange = {
  start: Date;
  end: Date;
};

export type IconComponent = LucideIcon;

export type SourceChannel = '카카오' | '네이버검색' | '인스타그램' | '직접방문' | '재방문' | '미수집';

export type DeviceType = 'mobile' | 'desktop' | 'unknown';

export type AdminProductStatus = ProductStatus | 'unknown';

export type CustomerFilter = 'all' | 'registered' | 'paid' | 'vip' | 'risk';

export type AdminOrder = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productStatus: AdminProductStatus;
  category: Exclude<ServiceCategoryId, 'all'> | 'unknown';
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

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  benchmark: number;
};

export type CategoryRow = {
  id: Exclude<ServiceCategoryId, 'all'>;
  label: string;
  orders: number;
  revenue: number;
  views: number;
  conversion: number;
  avgReadRate: number;
};

export type CustomerRow = {
  name: string;
  maskedName: string;
  email: string;
  orders: number;
  spent: number;
  lastProduct: string;
  lastSeen: string;
  readRate: number;
  analyticsAvailable: boolean;
};

export type CustomerProfile = CustomerRow & {
  id: string;
  provider: 'kakao' | 'demo' | 'unknown';
  signedAt: string;
  paidOrders: number;
  status: 'registered' | 'paid';
  sourceChannel: SourceChannel;
  device: DeviceType;
  segment: 'VIP' | '재구매 후보' | '신규' | '이탈 위험' | '가입만 완료';
  riskScore: number;
  nextAction: string;
};

export type ChannelPerformanceRow = {
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

export type RetentionCohortRow = {
  key: string;
  label: string;
  customers: number;
  retention: number[];
};

export type ExecutiveAlert = {
  id: string;
  severity: 'critical' | 'warning' | 'watch' | 'stable';
  title: string;
  metric: string;
  body: string;
  owner: string;
  sla: string;
};
