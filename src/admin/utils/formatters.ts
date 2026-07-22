export function parsePrice(price: string) {
  return Number(price.replace(/[^\d]/g, '')) || 0;
}

export function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getConversion(current: number, previous: number) {
  if (!previous) {
    return 0;
  }

  return (current / previous) * 100;
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function getChangeRate(current: number, previous: number): number | undefined {
  if (!previous) {
    return current ? undefined : 0;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatChangeRate(value?: number) {
  if (typeof value !== 'number') {
    return '비교 기준 없음';
  }

  const direction = value > 0 ? '+' : '';
  return `${direction}${value.toFixed(1)}%`;
}
