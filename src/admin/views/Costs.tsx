import { ProductHeatmap, ProductPortfolioMatrix } from '../components';
import type { buildProductRows } from '../data/adminAnalytics';
import { formatCurrency } from '../utils/formatters';

export function Costs({
  totalRevenue,
  apiCost,
  paymentFee,
  avgLatency,
  netRevenue,
  productRows
}: {
  totalRevenue: number;
  apiCost: number;
  paymentFee: number;
  avgLatency: number;
  netRevenue: number;
  productRows: ReturnType<typeof buildProductRows>;
}) {
  const activeView = 'costs' as const;

  return (
    <>
      {activeView === 'costs' ? (
        <>
          <section className="admin-dashboard-grid">
            <article className="admin-panel">
              <div className="admin-panel-head compact">
                <div>
                  <span>비용 구조</span>
                  <h2>비용 구조</h2>
                </div>
              </div>
              <div className="admin-cost-stack">
                <div><span>매출</span><strong>{formatCurrency(totalRevenue)}</strong></div>
                <div><span>Gemini/KASI 추정</span><strong>{formatCurrency(apiCost)}</strong></div>
                <div><span>결제 수수료 추정</span><strong>{formatCurrency(paymentFee)}</strong></div>
                <div><span>리포트 평균 생성</span><strong>{avgLatency}초</strong></div>
                <div className="net"><span>순매출 추정</span><strong>{formatCurrency(netRevenue)}</strong></div>
              </div>
            </article>
            <article className="admin-panel wide">
              <div className="admin-panel-head">
                <div>
                  <span>상품별 마진</span>
                  <h2>상품별 마진 감시</h2>
                </div>
                <p>저가 상품은 API 원가와 결제 수수료가 더 민감합니다.</p>
              </div>
              <div className="admin-margin-list enhanced">
                {productRows.map((service) => {
                  const cost = service.orders * 92 + service.revenue * 0.033;
                  const margin = service.revenue - cost;

                  return (
                    <article key={service.id}>
                      <strong>{service.label}</strong>
                      <span>{service.orders}건</span>
                      <em>{formatCurrency(service.revenue)}</em>
                      <b>{formatCurrency(margin)}</b>
                      <div className="admin-mini-bar">
                        <i style={{ width: `${Math.max(4, Math.min(100, service.share))}%` }} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>
          </section>
          <section className="admin-cost-product-grid">
            <ProductHeatmap rows={productRows} />
            <ProductPortfolioMatrix rows={productRows} />
          </section>
        </>
      ) : null}

    </>
  );
}
