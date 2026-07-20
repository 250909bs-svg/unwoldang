import { Archive, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../../components/MobileTopBar';
import type { ProductDefinition } from '../types';

type ProductUnavailableProps = {
  product: ProductDefinition;
};

export default function ProductUnavailable({ product }: ProductUnavailableProps) {
  const isDraft = product.status === 'draft';

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="상품 안내" backTo="/" backLabel="홈" />

        <section className="mobile-page-content centered">
          <article className="mobile-loading-card">
            <span className="mobile-chip">{isDraft ? 'COMING SOON' : 'SALES ARCHIVED'}</span>
            <h1>
              {product.displayName}은 현재 {isDraft ? '준비 중이에요.' : '개편 중이에요.'}
            </h1>
            <p>
              이 상품은 새로운 정보 입력과 결제를 받지 않습니다. 이전에 구매해 완성한 리포트는 보관함에서
              계속 다시 볼 수 있습니다.
            </p>
            <div className="mobile-loading-actions">
              <Link className="app-black-button" to="/my">
                <Archive size={17} aria-hidden="true" />
                이전 리포트 보기
              </Link>
              <Link className="app-muted-button" to="/">
                판매 중인 상품 보기
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
