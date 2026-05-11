import { Menu, MessageCircle } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildKakaoAuthorizeUrl } from '../lib/auth';

type LoginLocationState = {
  returnTo?: string;
  tabOrigin?: string;
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginDemo } = useAuth();

  const returnTo = useMemo(() => {
    const state = (location.state as LoginLocationState) || {};
    return state.returnTo || '/menu';
  }, [location.state]);

  const tabOrigin = useMemo(() => {
    const state = (location.state as LoginLocationState) || {};
    return state.tabOrigin;
  }, [location.state]);

  const moveAfterLogin = () => {
    navigate(returnTo, { replace: true, state: tabOrigin ? { tabOrigin } : undefined });
  };

  const handleKakaoLogin = () => {
    const authorizeUrl = buildKakaoAuthorizeUrl(returnTo);

    if (!authorizeUrl) {
      loginDemo('카카오 회원');
      moveAfterLogin();
      return;
    }

    window.location.href = authorizeUrl;
  };

  return (
    <main className="login-visual-page">
      <div className="login-visual-shell">
        <header className="login-visual-header">
          <Link to="/" className="login-visual-logo" aria-label="운월당 홈">
            <span>雲</span>
            <strong>운월당</strong>
          </Link>

          <Link to="/menu" className="login-visual-menu" aria-label="메뉴">
            <Menu size={23} />
          </Link>
        </header>

        <section className="login-visual-hero" aria-label="카카오 로그인">
          <img src="/intake-night-blue.png" alt="" className="login-visual-image" />
          <div className="login-visual-gradient" />

          <div className="login-visual-action-card">
            <button type="button" className="login-kakao-main-button" onClick={handleKakaoLogin}>
              <MessageCircle size={18} fill="currentColor" />
              카카오로 로그인/가입
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
