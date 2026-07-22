import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { Card } from '../shared/ui';

export default function NotFound() {
  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="페이지 안내" backTo="/" backLabel="홈" />

        <section className="mobile-page-content centered">
          <Card className="mobile-loading-card" padding="none" role="article">
            <span className="mobile-chip">PAGE CLOSED</span>
            <h1>이 페이지는 종료되었어요.</h1>
            <p>
              이전 상세화면은 더 이상 제공하지 않습니다. 지금 운영 중인 운월당 콘텐츠는 홈에서 확인해 주세요.
            </p>
            <div className="mobile-loading-actions">
              <Link className="app-black-button" to="/">
                운월당 홈으로 가기
              </Link>
              <Link className="app-muted-button" to="/detail/love-reading">
                MZ무당 팩폭 연애운 보기
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
