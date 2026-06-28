import { Menu } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { beginKakaoLogin, sanitizeAuthReturnTo } from '../lib/auth';

type LoginLocationState = {
  returnTo?: string;
  tabOrigin?: string;
};

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginDemo } = useAuth();
  const [loginError, setLoginError] = useState('');
  const autoStartRef = useRef(false);
  const canUseLocalPreview =
    import.meta.env.DEV && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const shouldAutoStartKakao = searchParams.get('kakao') === '1';

  const returnTo = useMemo(() => {
    const state = (location.state as LoginLocationState) || {};
    return sanitizeAuthReturnTo(state.returnTo || searchParams.get('returnTo') || '/my');
  }, [location.state, searchParams]);

  const handleKakaoLogin = () => {
    const login = beginKakaoLogin(returnTo);

    if (!login.ok) {
      setLoginError(login.message);
      return;
    }

    window.location.href = login.url;
  };

  useEffect(() => {
    if (!shouldAutoStartKakao || autoStartRef.current) {
      return;
    }

    autoStartRef.current = true;
    handleKakaoLogin();
  }, [shouldAutoStartKakao, returnTo]);

  const handleLocalPreviewLogin = () => {
    loginDemo('운월당 미리보기');
    navigate(returnTo, { replace: true });
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

        <section className="login-visual-hero login-poster-hero" aria-label="카카오 로그인">
          <img src="/my-kakao-login-hero.png" alt="운월당 카카오 로그인 안내" className="login-visual-image" />
          <div className="login-visual-gradient" />

          <div className="login-visual-action-card login-poster-action-card">
            <button type="button" className="login-kakao-main-button login-kakao-poster-button" onClick={handleKakaoLogin} aria-label="카카오로 시작하기">
              <span>카카오로 시작하기</span>
            </button>
            {canUseLocalPreview ? (
              <button type="button" className="login-local-preview-button" onClick={handleLocalPreviewLogin}>
                로컬 미리보기로 바로 확인
              </button>
            ) : null}
            {loginError ? <p className="login-inline-error">{loginError}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
