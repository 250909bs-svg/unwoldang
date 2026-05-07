import { LogOut, MessageCircleHeart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import { buildKakaoAuthorizeUrl } from '../lib/auth';

type LoginLocationState = {
  returnTo?: string;
  tabOrigin?: string;
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loginDemo, logout } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);

  const returnTo = useMemo(() => {
    const state = (location.state as LoginLocationState) || {};
    return state.returnTo || '/menu';
  }, [location.state]);
  const tabOrigin = useMemo(() => {
    const state = (location.state as LoginLocationState) || {};
    return state.tabOrigin;
  }, [location.state]);

  const hasKakaoConfig = Boolean(import.meta.env.VITE_KAKAO_REST_API_KEY);

  const moveAfterLogin = () => {
    navigate(returnTo, { replace: true, state: tabOrigin ? { tabOrigin } : undefined });
  };

  const handleKakaoLogin = () => {
    const authorizeUrl = buildKakaoAuthorizeUrl(returnTo);

    if (!authorizeUrl) {
      loginDemo('카카오 테스트 회원');
      setNotice('카카오 REST API 키가 없어 테스트 로그인으로 연결했습니다. 키를 넣으면 실제 카카오 인증으로 전환됩니다.');
      moveAfterLogin();
      return;
    }

    window.location.href = authorizeUrl;
  };

  const handleDemoLogin = () => {
    loginDemo('운월당 체험 회원');
    moveAfterLogin();
  };

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="카카오 로그인" backTo={returnTo} backLabel="이전" />

        <section className="mobile-page-content">
          <div className="mobile-hero-card">
            <span className="mobile-chip">운월당 계정 연결</span>
            <h1>로그인 후 바로 이어서 진행하세요</h1>
            <p>상세페이지에서 고른 상품을 그대로 이어받아 사주 정보 입력, 결제 준비, 결과 리포트까지 한 흐름으로 연결됩니다.</p>
          </div>

          <div className="mobile-section-card">
            {isAuthenticated && user ? (
              <div className="mobile-info-stack">
                <strong className="mobile-section-title">{user.nickname}</strong>
                <p className="mobile-muted-copy">이미 로그인된 상태입니다. 바로 다음 단계로 이동하거나 로그아웃할 수 있습니다.</p>
                <button type="button" className="app-black-button" onClick={moveAfterLogin}>
                  이어서 진행하기
                </button>
                <button type="button" className="app-muted-button with-icon-row" onClick={logout}>
                  <LogOut size={16} />
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="mobile-info-stack">
                <strong className="mobile-section-title">카카오 계정으로 시작</strong>
                <p className="mobile-muted-copy">로그인 후 사주 입력, 토스 결제 준비, 결과 리포트까지 같은 흐름으로 이동합니다.</p>
                <button type="button" className="btn-kakao btn-block" onClick={handleKakaoLogin}>
                  카카오로 시작하기
                </button>
                <button type="button" className="app-muted-button" onClick={handleDemoLogin}>
                  테스트 로그인
                </button>
              </div>
            )}
          </div>

          <div className="mobile-section-card">
            <strong className="mobile-section-title">운월당 흐름</strong>
            <ul className="mobile-bullet-list">
              <li>상세 → 로그인 → 입력 → 결제 → 결과</li>
              <li>카카오 키가 없으면 테스트 로그인으로 바로 확인 가능</li>
              <li>나중에 토스 실결제만 붙이면 운영 흐름으로 확장 가능</li>
            </ul>
            <Link to={returnTo} className="mobile-link-row">
              <MessageCircleHeart size={16} />
              이전 화면으로 돌아가기
            </Link>
          </div>

          {notice ? <div className="mobile-notice-box">{notice}</div> : null}
          {!hasKakaoConfig ? (
            <div className="mobile-notice-box">현재 카카오 REST API 키가 없어 로그인 버튼을 누르면 테스트 로그인으로 진입합니다.</div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
