import type { AdminComparison, AdminDateRange, AdminGranularity, AdminOrder, AdminPeriod } from '../types/admin';

export function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDayLabel(dateKey: string) {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export function countToday(orders: AdminOrder[]) {
  const today = new Date().toDateString();
  return orders.filter((order) => new Date(order.createdAt).toDateString() === today);
}

export function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function parseDateInput(value: string, useEndOfDay = false) {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  const date = new Date(year, month - 1, day);
  return useEndOfDay ? endOfDay(date) : startOfDay(date);
}

export function getAdminDateRange(
  period: AdminPeriod,
  orders: AdminOrder[],
  customStart: string,
  customEnd: string,
  referenceDate = new Date()
): AdminDateRange {
  const now = new Date(referenceDate);
  const today = startOfDay(now);
  let start = new Date(today);
  let end = new Date(now);

  if (period === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end = endOfDay(start);
  } else if (period === '7d') {
    start.setDate(start.getDate() - 6);
  } else if (period === '30d') {
    start.setDate(start.getDate() - 29);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'quarter') {
    start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (period === 'all') {
    const timestamps = orders
      .map((order) => new Date(order.createdAt).getTime())
      .filter((timestamp) => Number.isFinite(timestamp));
    start = timestamps.length ? startOfDay(new Date(Math.min(...timestamps))) : today;
  } else if (period === 'custom') {
    const parsedStart = parseDateInput(customStart);
    const parsedEnd = parseDateInput(customEnd, true);

    if (parsedStart && parsedEnd) {
      start = parsedStart.getTime() <= parsedEnd.getTime() ? parsedStart : startOfDay(parsedEnd);
      end = parsedStart.getTime() <= parsedEnd.getTime() ? parsedEnd : endOfDay(parsedStart);
    }
  }

  return { start, end };
}

export function getComparisonDateRange(range: AdminDateRange, comparison: AdminComparison): AdminDateRange | undefined {
  if (comparison === 'none') {
    return undefined;
  }

  if (comparison === 'yearAgo') {
    const start = new Date(range.start);
    const end = new Date(range.end);
    start.setFullYear(start.getFullYear() - 1);
    end.setFullYear(end.getFullYear() - 1);
    return { start, end };
  }

  const duration = Math.max(0, range.end.getTime() - range.start.getTime());
  const end = new Date(range.start.getTime() - 1);
  const start = new Date(end.getTime() - duration);
  return { start, end };
}

export function filterOrdersByRange(orders: AdminOrder[], range?: AdminDateRange) {
  if (!range) {
    return [];
  }

  const start = range.start.getTime();
  const end = range.end.getTime();
  return orders.filter((order) => {
    const createdAt = new Date(order.createdAt).getTime();
    return createdAt >= start && createdAt <= end;
  });
}

export function getRangeDays(range: AdminDateRange) {
  const duration = Math.max(0, range.end.getTime() - range.start.getTime());
  return Math.max(1, Math.ceil(duration / (1000 * 60 * 60 * 24)));
}

export function formatDateRange(range: AdminDateRange) {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  return `${formatter.format(range.start)} ~ ${formatter.format(range.end)}`;
}

export function getDefaultGranularity(period: AdminPeriod): AdminGranularity {
  if (period === 'today' || period === 'yesterday') {
    return 'hour';
  }

  if (period === 'quarter') {
    return 'week';
  }

  if (period === 'year' || period === 'all') {
    return 'month';
  }

  return 'day';
}
