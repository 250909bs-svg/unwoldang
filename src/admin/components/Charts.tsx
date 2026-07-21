import { PieChart } from 'lucide-react';
import { buildHourlyRows, buildProductRows, buildTimeSeries } from '../data/adminAnalytics';
import { clamp, formatCurrency, formatPercent, getConversion } from '../utils/formatters';
import { getAdminProductStatusLabel } from '../utils/productStatus';

const chartColors = ['#111827', '#8a7258', '#2f6f68', '#b54708', '#7c3aed', '#475467'];

export function RevenueTrendChart({
  data,
  title = '선택 기간 매출 흐름',
  rangeLabel
}: {
  data: ReturnType<typeof buildTimeSeries>;
  title?: string;
  rangeLabel?: string;
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
  const labelInterval = Math.max(1, Math.ceil(points.length / 7));

  return (
    <div className="admin-chart-card admin-trend-card">
      <div className="admin-chart-head">
        <div>
          <span>매출 추이</span>
          <h3>{title}</h3>
          {rangeLabel ? <small>{rangeLabel}</small> : null}
        </div>
        <strong>{formatCurrency(data.reduce((sum, point) => sum + point.revenue, 0))}</strong>
      </div>
      <svg className="admin-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} 그래프`}>
        <polygon points={area} />
        <polyline points={polyline} />
        {points.map((point, index) => (
          <g key={point.key}>
            {points.length <= 80 || index % labelInterval === 0 || index === points.length - 1 ? (
              <circle cx={point.x} cy={point.y} r="4" />
            ) : null}
            {index % labelInterval === 0 || index === points.length - 1 ? (
              <text x={point.x} y={height - 16} textAnchor="middle">
                {point.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function HourlyBarChart({
  data,
  isPaymentData = true
}: {
  data: ReturnType<typeof buildHourlyRows>;
  isPaymentData?: boolean;
}) {
  const maxOrders = Math.max(1, ...data.map((row) => row.orders));

  return (
    <div className="admin-chart-card">
      <div className="admin-chart-head">
        <div>
          <span>시간대 분석</span>
          <h3>{isPaymentData ? '시간대별 결제' : '보관 시각별 완료 리포트'}</h3>
        </div>
        <strong>{data.reduce((sum, row) => sum + row.orders, 0)}건</strong>
      </div>
      <div className="admin-hour-bars" aria-label={isPaymentData ? '시간대별 결제 막대그래프' : '보관 시각별 완료 리포트 막대그래프'}>
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

export function DonutChart({
  title,
  rows,
  centerLabel
}: {
  title: string;
  rows: Array<{ label: string; value: number; revenue?: number }>;
  centerLabel: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const ratioTotal = total || 1;
  let cursor = 0;
  const gradient = rows
    .map((row, index) => {
      const start = cursor;
      const end = cursor + (row.value / ratioTotal) * 360;
      cursor = end;
      return `${chartColors[index % chartColors.length]} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div className="admin-chart-card admin-donut-card">
      <div className="admin-chart-head">
        <div>
          <span>분포 분석</span>
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

export function HealthRadar({
  items,
  isEstimated
}: {
  items: Array<{ label: string; value: number; display: string; note: string }>;
  isEstimated: boolean;
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
      pointX: center + Math.cos(angle) * radius * ((isEstimated ? clamp(item.value) : 0) / 100),
      pointY: center + Math.sin(angle) * radius * ((isEstimated ? clamp(item.value) : 0) / 100),
      labelX: center + Math.cos(angle) * (radius + 24),
      labelY: center + Math.sin(angle) * (radius + 24)
    };
  });
  const polygon = axis.map((item) => `${item.pointX},${item.pointY}`).join(' ');
  const average = isEstimated ? Math.round(items.reduce((sum, item) => sum + clamp(item.value), 0) / items.length) : 0;

  return (
    <article className="admin-command-panel admin-health-radar">
      <div className="admin-command-head">
        <div>
          <span>운영 건강도</span>
          <h2>운영 건강도</h2>
        </div>
        <strong>{isEstimated ? `${average}점` : '미수집'}</strong>
      </div>
      <div className="admin-radar-wrap">
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={isEstimated ? '운영 건강도 레이더 차트' : '운영 건강도 분석 미수집'}>
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

export function ProductHeatmap({
  rows
}: {
  rows: ReturnType<typeof buildProductRows>;
}) {
  const maxOrders = Math.max(1, ...rows.map((row) => row.orders));
  const visibleRows = rows.slice(0, 7);
  const cells = [
    { key: 'share', label: '매출비중', get: (row: (typeof rows)[number]) => row.share, display: (value: number) => formatPercent(value) },
    { key: 'orders', label: '주문', get: (row: (typeof rows)[number]) => getConversion(row.orders, maxOrders), display: (_value: number, row: (typeof rows)[number]) => `${row.orders}건` },
    { key: 'conversion', label: '전환', get: (row: (typeof rows)[number]) => row.conversion, display: (value: number, row: (typeof rows)[number]) => row.analyticsAvailable ? formatPercent(value) : '미수집' },
    { key: 'read', label: '열람', get: (row: (typeof rows)[number]) => row.avgReadRate, display: (value: number, row: (typeof rows)[number]) => row.analyticsAvailable ? `${Math.round(value)}%` : '미수집' }
  ];

  return (
    <article className="admin-command-panel admin-product-heatmap">
      <div className="admin-command-head">
        <div>
          <span>상품 성과</span>
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
            <strong>
              {row.label}
              <small className={`admin-product-status ${row.status}`}>
                {getAdminProductStatusLabel(row.status)}
              </small>
            </strong>
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

export function ProductPortfolioMatrix({ rows }: { rows: ReturnType<typeof buildProductRows> }) {
  const visibleRows = rows.filter((row) => row.orders > 0 && row.analyticsAvailable).slice(0, 8);
  const width = 560;
  const height = 268;
  const left = 46;
  const right = 22;
  const top = 20;
  const bottom = 42;
  const maxConversion = Math.max(1, ...visibleRows.map((row) => row.conversion));
  const points = visibleRows.map((row, index) => ({
    ...row,
    index: index + 1,
    x: left + (row.conversion / maxConversion) * (width - left - right),
    y: top + (1 - row.avgReadRate / 100) * (height - top - bottom),
    radius: clamp(8 + row.share / 6, 8, 22)
  }));

  return (
    <article className="admin-command-panel admin-product-portfolio">
      <div className="admin-command-head">
        <div>
          <span>상품 포트폴리오</span>
          <h2>전환율과 고객 몰입도</h2>
        </div>
        <strong>원 크기 = 매출 비중</strong>
      </div>
      <div className="admin-portfolio-layout">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="상품 전환율과 열람률 포트폴리오">
          <line className="axis" x1={left} y1={top} x2={left} y2={height - bottom} />
          <line className="axis" x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} />
          <line className="guide" x1={(left + width - right) / 2} y1={top} x2={(left + width - right) / 2} y2={height - bottom} />
          <line className="guide" x1={left} y1={(top + height - bottom) / 2} x2={width - right} y2={(top + height - bottom) / 2} />
          <text className="quadrant" x={left + 8} y={top + 14}>몰입 높음 · 전환 개선</text>
          <text className="quadrant" x={width - right - 8} y={top + 14} textAnchor="end">핵심 성장 상품</text>
          <text className="quadrant" x={left + 8} y={height - bottom - 10}>정리 후보</text>
          <text className="quadrant" x={width - right - 8} y={height - bottom - 10} textAnchor="end">첫 화면 보강</text>
          <text className="axis-label" x={12} y={(top + height - bottom) / 2} transform={`rotate(-90 12 ${(top + height - bottom) / 2})`} textAnchor="middle">열람률</text>
          <text className="axis-label" x={(left + width - right) / 2} y={height - 12} textAnchor="middle">결제 전환율</text>
          {points.map((point) => (
            <g key={point.id} className="portfolio-point">
              <circle cx={point.x} cy={point.y} r={point.radius} />
              <text x={point.x} y={point.y + 4} textAnchor="middle">{point.index}</text>
              <title>{`${point.label}: 전환 ${formatPercent(point.conversion)}, 열람 ${point.avgReadRate}%`}</title>
            </g>
          ))}
        </svg>
        <div className="admin-portfolio-legend">
          {points.map((point) => (
            <div key={point.id}>
              <span>{point.index}</span>
              <p>
                <strong>{point.label}</strong>
                <small className={`admin-product-status ${point.status}`}>{getAdminProductStatusLabel(point.status)}</small>
                <small>전환 {formatPercent(point.conversion)} · 열람 {point.avgReadRate}%</small>
              </p>
              <b>{formatCurrency(point.revenue)}</b>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
