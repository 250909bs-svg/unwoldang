import { Archive, FlaskConical, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getRouteShellPolicy } from '../app/shell';

function GuiyeondoIcon({ size = 18, strokeWidth = 2.1 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="5" cy="7" r="1.55" fill="currentColor" />
      <circle cx="19" cy="7" r="1.55" fill="currentColor" />
      <circle cx="5" cy="17" r="1.55" fill="currentColor" />
      <circle cx="19" cy="17" r="1.55" fill="currentColor" />
      <path d="M7 8.2 9.6 10M17 8.2 14.4 10M7 15.8 9.6 14M17 15.8 14.4 14" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

const discoveryItem = {
  to: '/guiyeondo',
  label: '귀연도',
  match: (pathname: string) => pathname.startsWith('/guiyeondo'),
  icon: GuiyeondoIcon
};

/** Exported so a contract test can prove every tab-bar route lights one tab. */
export const BOTTOM_TAB_ITEMS = [
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
  discoveryItem,
  {
    to: '/my',
    label: '보관함',
    match: (pathname: string) => pathname.startsWith('/my') || pathname.startsWith('/login'),
    icon: Archive
  }
] as const;

export default function BottomTabBar() {
  const location = useLocation();
  const locationState = (location.state as { tabOrigin?: string } | null) ?? null;
  /* Whether this bar renders at all is decided once, by the route shell policy
     in App.tsx. This component only decides which tab reads as current. */
  const { tabAnchor } = getRouteShellPolicy(location.pathname);
  const effectivePathname =
    tabAnchor === 'origin' ? locationState?.tabOrigin || '/' : location.pathname;

  return (
    <nav className="bottom-tabbar" aria-label="하단 탭 메뉴">
      <div className="bottom-tabbar-inner">
        {BOTTOM_TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.match(effectivePathname);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={active ? 'bottom-tab active' : 'bottom-tab'}
              /* The only visual difference between tabs is the pill fill, and
                 the label is visually hidden, so this is the sole cue a screen
                 reader gets for "you are here". */
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={2.1} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
