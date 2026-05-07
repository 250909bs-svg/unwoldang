import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { legalPages, siteBusinessInfo, type LegalPageKey } from '../content/legal';

type LegalPageProps = {
  pageKey: LegalPageKey;
};

export default function LegalPage({ pageKey }: LegalPageProps) {
  const page = legalPages[pageKey];

  return (
    <main className="mobile-page-shell legal-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title={page.title} backTo="/" backLabel="홈" />

        <section className="mobile-page-content legal-page-content">
          <div className="mobile-hero-card legal-hero-card">
            <span className="mobile-chip">LEGAL</span>
            <h1>{page.title}</h1>
            <p>{page.subtitle}</p>
          </div>

          <div className="mobile-section-card legal-business-card">
            <strong className="mobile-section-title">사업자 정보</strong>
            <div className="legal-business-grid">
              <article>
                <span>상호</span>
                <strong>
                  {siteBusinessInfo.companyName}({siteBusinessInfo.serviceName})
                </strong>
              </article>
              <article>
                <span>대표자</span>
                <strong>{siteBusinessInfo.representative}</strong>
              </article>
              <article>
                <span>사업자등록번호</span>
                <strong>{siteBusinessInfo.businessRegistrationNumber}</strong>
              </article>
              <article>
                <span>통신판매업 신고번호</span>
                <strong>{siteBusinessInfo.telecomSalesRegistrationNumber}</strong>
              </article>
              <article>
                <span>주소</span>
                <strong>{siteBusinessInfo.address}</strong>
              </article>
              <article>
                <span>고객센터</span>
                <strong>{siteBusinessInfo.customerCenter}</strong>
              </article>
            </div>
            <p className="legal-page-note">{siteBusinessInfo.launchChecklistNote}</p>
          </div>

          {page.sections.map((section) => (
            <div key={section.title} className="mobile-section-card legal-section-card">
              <strong className="mobile-section-title">{section.title}</strong>
              <div className="legal-copy-stack">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}

          <div className="mobile-section-card legal-links-card">
            <strong className="mobile-section-title">바로가기</strong>
            <div className="legal-link-row">
              <Link to="/terms" className="app-muted-button">
                이용약관
              </Link>
              <Link to="/privacy" className="app-muted-button">
                개인정보처리방침
              </Link>
              <Link to="/refund" className="app-muted-button">
                환불정책
              </Link>
            </div>
            {siteBusinessInfo.fairTradeUrl ? (
              <a href={siteBusinessInfo.fairTradeUrl} className="app-black-button" target="_blank" rel="noreferrer">
                공정위 사업자정보 확인
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
