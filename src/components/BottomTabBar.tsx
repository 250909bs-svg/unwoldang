import { FlaskConical, Home, User, WalletCards } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  {
    to: '/',
    label: '홈',
    match: (pathname: string) => pathname === '/',
    icon: Home
  },
  {
    to: '/test',
    label: '심리테스트',
    match: (pathname: string) => pathname.startsWith('/test'),
    icon: FlaskConical
  },
  {
    to: '/tarot',
    label: '타로',
    match: (pathname: string) => pathname.startsWith('/tarot'),
    icon: WalletCards
  },
  {
    to: '/my',
    label: '마이',
    match: (pathname: string) => pathname.startsWith('/my') || pathname.startsWith('/login'),
    icon: User
  }
] as const;

export default function BottomTabBar() {
  const location = useLocation();
  const locationState = (location.state as { tabOrigin?: string } | null) ?? null;
  const inFlowPage = ['/detail/', '/form/', '/checkout', '/loading', '/report/', '/admin'].some((path) =>
    location.pathname.startsWith(path)
  );

  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  const effectivePathname = inFlowPage ? locationState?.tabOrigin || '/' : location.pathname;

  return (
    <nav className="bottom-tabbar" aria-label="하단 탭 메뉴">
      <div className="bottom-tabbar-inner">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.match(effectivePathname);

          return (
            <Link key={item.to} to={item.to} className={active ? 'bottom-tab active' : 'bottom-tab'}>
              <Icon size={18} strokeWidth={2.1} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
