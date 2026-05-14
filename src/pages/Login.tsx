import { Menu, MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { buildKakaoAuthorizeUrl } from '../lib/auth';

type LoginLocationState = {
  returnTo?: string;
  tabOrigin?: string;
};

export default function Login() {
  const location = useLocation();
  const [loginError, setLoginError] = useState('');

  const returnTo = useMemo(() => {
    const state = (location.state as LoginLocationState) || {};
    return state.returnTo || '/my';
  }, [location.state]);

  const handleKakaoLogin = () => {
    if (window.location.hostname === '127.0.0.1' && window.location.port === '5173') {
      window.location.href = `${window.location.protocol}//localhost:5173/login`;
      return;
    }

    const authorizeUrl = buildKakaoAuthorizeUrl(returnTo);

    if (!authorizeUrl) {
      setLoginError('카카오 REST API 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.');
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
            {loginError ? <p className="login-inline-error">{loginError}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
