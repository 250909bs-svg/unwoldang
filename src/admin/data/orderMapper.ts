import { findServiceById } from '../../api/mockData';
import type { ReportArchiveEntry } from '../../lib/reportArchive';
import { sampleAges, sampleChannels, sampleDevices } from '../fixtures/sampleOrders';
import type { AdminOrder } from '../types/admin';
import { parsePrice } from '../utils/formatters';

export function toAdminOrder(report: ReportArchiveEntry, index: number): AdminOrder {
  const service = findServiceById(report.productId);

  return {
    id: report.id,
    orderId: report.orderId || report.id,
    productId: report.productId,
    productName: report.title || service.label,
    category: service.category,
    customerName: report.customerName,
    customerEmail: undefined,
    amount: parsePrice(service.price),
    status: 'paid',
    reportStatus: 'done',
    paymentMethod: report.paymentMethod || 'portone',
    createdAt: report.createdAt,
    readRate: Math.min(98, 74 + index * 5),
    issueCount: 0,
    source: 'real',
    sourceChannel: sampleChannels[index % sampleChannels.length],
    device: sampleDevices[index % sampleDevices.length],
    ageRange: sampleAges[index % sampleAges.length],
    reportLatencySec: 22 + index * 4,
    analyticsEstimated: true,
    archive: report
  };
}
