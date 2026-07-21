import type { ReportArchiveEntry } from '../../lib/reportArchive';
import { getProductById } from '../../products';
import type { AdminOrder } from '../types/admin';

export function toAdminOrder(report: ReportArchiveEntry): AdminOrder {
  const productId = String(report.productId || '').trim();
  const product = getProductById(productId);

  return {
    id: report.id,
    orderId: report.orderId || report.id,
    productId,
    productName: product?.displayName || report.title?.trim() || `알 수 없는 상품 (${productId || 'ID 없음'})`,
    productStatus: product?.status || 'unknown',
    category: product?.discovery.category || 'unknown',
    customerName: report.customerName,
    customerEmail: undefined,
    amount: product?.price || 0,
    status: 'paid',
    reportStatus: 'done',
    paymentMethod: report.paymentMethod || 'portone',
    createdAt: report.createdAt,
    readRate: 0,
    issueCount: 0,
    source: 'real',
    sourceChannel: '미수집',
    device: 'unknown',
    ageRange: '미수집',
    reportLatencySec: 0,
    analyticsEstimated: false,
    archive: report
  };
}
