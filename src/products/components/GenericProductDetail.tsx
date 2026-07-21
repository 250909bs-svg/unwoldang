import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { findServiceById } from '../../api/mockData';
import MobileTopBar from '../../components/MobileTopBar';
import NotFound from '../../pages/NotFound';
import { canStartProduct, getProductByRoute } from '../registry';
import ProductUnavailable from './ProductUnavailable';

export default function GenericProductDetail() {
  const { pathname } = useLocation();
  const product = getProductByRoute(pathname);

  if (!product) {
    return <NotFound />;
  }

  if (!canStartProduct(product.id)) {
    return <ProductUnavailable product={product} />;
  }

  const service = findServiceById(product.id);

  if (!service) {
    return <NotFound />;
  }

  const pageStyle = { '--service-accent': service.accent } as CSSProperties;
  const startState = { tabOrigin: product.routes.detail } as const;

  return (
    <main className="mobile-page-shell" style={pageStyle}>
      <div className="mobile-page-card">
        <MobileTopBar title="운월당" backTo="/" backLabel="홈" />

        <div className="mobile-page-content detail-luxe-content">
          <section className="detail-luxe-hero" aria-labelledby="product-detail-title">
            <div className="detail-luxe-copy">
              <div className="detail-luxe-badge-row">
                <span className="detail-luxe-chip">{service.heroTag}</span>
                <span className="detail-luxe-kicker">신규 판매 중</span>
              </div>
              <h1 id="product-detail-title">{product.displayName}</h1>
              <p>{service.subtitle}</p>
              <div className="detail-luxe-price-row">
                <strong>{product.price.toLocaleString('ko-KR')}원</strong>
                <span>개인 맞춤 리포트</span>
              </div>
            </div>

            <aside className="detail-luxe-side-card">
              <span className="detail-luxe-card-label">이 상품이 답하는 것</span>
              <strong>{service.spotlight}</strong>
              <p>{service.teaser}</p>
            </aside>
          </section>

          <section className="detail-luxe-section" aria-labelledby="product-feature-title">
            <div className="detail-luxe-head">
              <div>
                <span className="detail-luxe-kicker">REPORT SCOPE</span>
                <h2 id="product-feature-title">리포트에서 확인할 내용</h2>
              </div>
              <p>상품에 맞춘 입력값과 두 가지 질문을 함께 반영합니다.</p>
            </div>
            <div className="detail-luxe-feature-grid">
              {service.bullets.map((item) => (
                <article key={item} className="detail-luxe-feature-card">
                  <span className="detail-luxe-check">
                    <Check size={17} aria-hidden="true" />
                  </span>
                  <strong>{item}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="detail-luxe-section soft" aria-labelledby="product-process-title">
            <div className="detail-luxe-head">
              <div>
                <span className="detail-luxe-kicker">PROCESS</span>
                <h2 id="product-process-title">진행 순서</h2>
              </div>
              <p>입력부터 결제, 분석과 보관까지 한 흐름으로 이어집니다.</p>
            </div>
            <div className="detail-luxe-timeline">
              {service.process.map((item, index) => (
                <article key={item} className="detail-luxe-step">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="detail-luxe-cta-card" aria-labelledby="product-start-title">
            <ShieldCheck size={24} aria-hidden="true" />
            <h2 id="product-start-title">서버에서 상품과 결제 권한을 다시 확인합니다.</h2>
            <p>{service.description}</p>
            <div className="detail-luxe-cta-actions">
              <Link className="app-black-button" to={product.routes.intake} state={startState}>
                내 리포트 시작하기
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="app-muted-button" to="/">
                다른 상품 보기
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
