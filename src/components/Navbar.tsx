import { Grid2x2, Heart, ScrollText } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Link to="/" className="brand-mark" aria-label="운월당 홈으로 이동">
          <span className="brand-seal">月</span>
          <span className="brand-copy">
            <strong>운월당</strong>
            <small>모바일 카드형 사주 리포트</small>
          </span>
        </Link>

        <nav className="nav-links" aria-label="주요 메뉴">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            홈
          </NavLink>
          <NavLink to="/menu" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            <Grid2x2 size={14} />
            카테고리
          </NavLink>
          <NavLink
            to="/form/general-signature"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <ScrollText size={14} />
            종합사주
          </NavLink>
          <NavLink
            to="/form/love-reading"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <Heart size={14} />
            연애운
          </NavLink>
        </nav>

        {isAuthenticated && user ? (
          <div className="nav-auth">
            <span className="nav-user-badge">{user.nickname}</span>
            <button type="button" className="nav-ghost-button" onClick={logout}>
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            state={{ returnTo: location.pathname === '/login' ? '/menu' : location.pathname }}
            className="nav-cta"
          >
            카카오 로그인
          </Link>
        )}
      </div>
    </header>
  );
}
