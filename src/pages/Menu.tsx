import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { findCategoryById, serviceCatalog, serviceCategories, type ServiceCategoryId } from '../api/mockData';

const accentPalette = ['rose', 'indigo', 'amber'] as const;

export default function Menu() {
  const [activeCategory, setActiveCategory] = useState<ServiceCategoryId>('all');

  const visibleServices = useMemo(() => {
    if (activeCategory === 'all') {
      return serviceCatalog;
    }

    return serviceCatalog.filter((service) => service.category === activeCategory);
  }, [activeCategory]);

  const activeCategoryInfo = findCategoryById(activeCategory);

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="전체 메뉴" backTo="/" backLabel="홈" />

        <section className="mobile-page-content">
          <div className="mobile-hero-card">
            <span className="mobile-chip">ALL CATEGORY</span>
            <h1>운월당 전체 리포트</h1>
            <p>{activeCategoryInfo.lead}</p>
          </div>

          <div className="mobile-section-card">
            <div className="mobile-section-head">
              <span className="mobile-chip">FILTER</span>
              <span className="mobile-inline-label">{activeCategoryInfo.description}</span>
            </div>

            <div className="menu-mobile-chips">
              {serviceCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={activeCategory === category.id ? 'quick-chip active' : 'quick-chip'}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className="menu-service-list">
            {visibleServices.map((service, index) => (
              <Link
                key={service.id}
                to={`/form/${service.id}`}
                className={`app-report-card ${accentPalette[index % accentPalette.length]}`}
              >
                <div className="app-report-badge">{service.heroTag}</div>
                <div className="app-report-copy">
                  <strong>{service.label}</strong>
                  <p>{service.subtitle}</p>
                  <span>{service.price} · 상세 보기</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mobile-section-card">
            <strong className="mobile-section-title">카테고리 설명</strong>
            <p className="mobile-muted-copy">{activeCategoryInfo.lead}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
