import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { IconComponent } from '../types/admin';
import { formatChangeRate } from '../utils/formatters';

export function MetricCard({
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

export function InsightCard({
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
