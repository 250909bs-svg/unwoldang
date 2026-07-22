import type { AdminProductStatus } from '../types/admin';

const PRODUCT_STATUS_LABELS: Record<AdminProductStatus, string> = {
  active: '판매 중',
  draft: '초안',
  archived: '판매 종료',
  unknown: '알 수 없음'
};

export function getAdminProductStatusLabel(status: AdminProductStatus) {
  return PRODUCT_STATUS_LABELS[status];
}
