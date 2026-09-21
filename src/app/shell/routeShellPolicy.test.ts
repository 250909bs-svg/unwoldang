import { describe, expect, it } from 'vitest';
import { BOTTOM_TAB_ITEMS } from '../../components/BottomTabBar';
import {
  ROUTE_SHELL_POLICIES,
  SHELL_BASELINE,
  getRouteShellPolicy,
  getShellContainerClassName,
  isDarkBootRoute
} from './routeShellPolicy';

describe('route shell policy', () => {
  it('treats the home shell as the baseline every other route measures against', () => {
    expect(ROUTE_SHELL_POLICIES['/']).toEqual(SHELL_BASELINE);
  });

  it.each([
    ['/', 'phone'],
    ['/detail/general-saju', 'phone'],
    ['/detail/love-reading', 'phone'],
    ['/detail/past-life-goblin', 'phone'],
    ['/detail/past-life-goblin/immersion', 'phone'],
    ['/detail/tarot-basic', 'phone'],
    ['/checkout', 'phone'],
    ['/loading', 'phone'],
    ['/form/general-signature', 'phone'],
    // 몰입형 랜딩과 리포트도 폰 프레임이다. 제품 시트가 @container app 으로 프레임을
    // 재므로 폭을 묶어도 데스크톱 블록이 잘못 발동하지 않는다.
    ['/detail/love-reunion', 'phone'],
    ['/detail/past-life-goblin/about', 'phone'],
    ['/report/8f2c0f1a-0000-4000-8000-000000000000', 'phone'],
    ['/guiyeondo', 'wide'],
    ['/g/abc123', 'wide'],
    ['/admin', 'full']
  ] as const)('resolves %s to the %s width token', (pathname, width) => {
    expect(getRouteShellPolicy(pathname).width).toBe(width);
  });

  it('keeps every customer route in the phone frame, on a desktop window too', () => {
    // 발주자 요구: PC 에서도 모바일 화면 그대로 보여야 한다.
    // 예전에는 리포트 시트가 레이아웃을 뷰포트에 물어서 canvas 가 필요했다. 그 쿼리들이
    // 전부 @container app 으로 바뀌었으므로 폰 폭으로 묶어도 거짓말을 하지 않는다.
    for (const pathname of [
      '/',
      '/detail/love-reunion',
      '/detail/past-life-goblin/about',
      '/form/love-reunion',
      '/checkout',
      '/report/general-signature',
      '/report/love-reading',
      '/report/love-reunion',
      '/report/past-life-goblin',
      '/report/8f2c0f1a-0000-4000-8000-000000000000'
    ]) {
      expect(getRouteShellPolicy(pathname).width, pathname).toBe('phone');
    }
  });

  it('keeps full width for the admin dashboard only', () => {
    for (const [pattern, policy] of Object.entries(ROUTE_SHELL_POLICIES)) {
      expect(policy.width === 'full', pattern).toBe(pattern === '/admin');
    }
  });

  it('leaves the deprecated 520px card and canvas widths unused', () => {
    const widths = new Set(Object.values(ROUTE_SHELL_POLICIES).map((policy) => policy.width));

    expect(widths.has('card')).toBe(false);
    expect([...widths].sort()).toEqual(['full', 'phone', 'wide']);
  });

  it('keeps the light theme on /admin only, which is what index.html boots on', () => {
    for (const [pattern, policy] of Object.entries(ROUTE_SHELL_POLICIES)) {
      expect(policy.theme === 'light', pattern).toBe(pattern === '/admin');
    }

    expect(isDarkBootRoute('/admin')).toBe(false);
    for (const pathname of ['/', '/checkout', '/loading', '/form/general-signature', '/no-such']) {
      expect(isDarkBootRoute(pathname), pathname).toBe(true);
    }
  });

  it('matches /admin exactly, because App.tsx declares no /admin/* route', () => {
    expect(getRouteShellPolicy('/admin').surface).toBe('admin');
    // /admin/reports renders NotFound. A light full-width shell there is a bug.
    expect(getRouteShellPolicy('/admin/reports')).toEqual(ROUTE_SHELL_POLICIES['*']);
  });

  it('hides both the tab bar and the footer across the purchase funnel', () => {
    for (const pathname of [
      '/form/love-reunion',
      '/form/general-signature',
      '/form/past-life-goblin',
      '/form/anything',
      '/preview/love-reunion',
      '/preview/love-reading',
      '/checkout',
      '/loading',
      '/report/love-reunion',
      '/report/general-signature',
      '/report/some-uuid',
      '/auth/kakao/callback',
      '/payment/portone/callback'
    ]) {
      const policy = getRouteShellPolicy(pathname);

      expect(policy.bottomTab, pathname).toBe('flow-hidden');
      expect(policy.footer, pathname).toBe(false);
      expect(policy.tabAnchor, pathname).toBe('origin');
    }
  });

  it('gives every product entry cut a top bar instead of a tab bar', () => {
    // Measured reason: .mz-love-intro-action and .dokkaebi-film-entry-action are
    // absolutely positioned at the bottom of a 100svh stage, so a 70px tab bar
    // covers the CTA. The escape hatch is the top bar.
    for (const pathname of [
      '/detail/general-saju',
      '/detail/love-reading',
      '/detail/past-life-goblin'
    ]) {
      const policy = getRouteShellPolicy(pathname);

      expect(policy.bottomTab, pathname).toBe('door-hidden');
      expect(policy.topBar, pathname).not.toBe('none');
      expect(policy.footer, pathname).toBe(false);
    }
  });

  it('never adds the global footer to a landing that renders its own', () => {
    // ReunionLanding.tsx <footer className="rw-footer">
    // PastLifeLanding.tsx <footer className="dokkaebi-footer">
    // PastLifeEntry.tsx  <footer className="dokkaebi-entry-seo-footer">
    for (const pathname of [
      '/detail/love-reunion',
      '/detail/past-life-goblin/about',
      '/detail/past-life-goblin'
    ]) {
      expect(getRouteShellPolicy(pathname).footer, pathname).toBe(false);
    }
  });

  it('keeps the reunion webtoon landing full-bleed with no global chrome', () => {
    const policy = getRouteShellPolicy('/detail/love-reunion');

    expect(policy).toEqual({
      theme: 'dark',
      width: 'phone',
      topBar: 'product',
      bottomTab: 'immersive-hidden',
      tabAnchor: 'origin',
      footer: false,
      surface: 'love-reunion',
      containerClass: 'reunion-app-container'
    });
  });

  it('anchors the tab highlight to the originating tab on non-destination routes', () => {
    for (const pathname of ['/terms', '/privacy', '/refund', '/search', '/detail/tarot-basic']) {
      const policy = getRouteShellPolicy(pathname);

      expect(policy.bottomTab, pathname).toBe('visible');
      expect(policy.tabAnchor, pathname).toBe('origin');
    }

    for (const pathname of ['/', '/test', '/my', '/login']) {
      expect(getRouteShellPolicy(pathname).tabAnchor, pathname).toBe('self');
    }
  });

  it('lights exactly one tab on every route that shows the bar', () => {
    // `tabAnchor` decides which pathname the bar matches against. Getting it
    // wrong shows up as zero lit tabs (/search, /guiyeondo, NotFound all did).
    for (const pathname of [
      '/',
      '/test',
      '/test/face-ai',
      '/guiyeondo',
      '/my',
      '/login',
      '/search',
      '/terms',
      '/privacy',
      '/refund',
      '/detail/tarot-basic',
      '/nope-404'
    ]) {
      const policy = getRouteShellPolicy(pathname);

      expect(policy.bottomTab, pathname).toBe('visible');

      const effective = policy.tabAnchor === 'origin' ? '/' : pathname;
      const lit = BOTTOM_TAB_ITEMS.filter((item) => item.match(effective));

      expect(lit.map((item) => item.to), pathname).toHaveLength(1);
    }
  });

  it('lets every bottom-tab destination light its own tab', () => {
    // BottomTabBar reads `tabAnchor: 'origin'` as "ignore where you are", so a
    // destination that declares it can never read as current. /guiyeondo did.
    for (const pathname of ['/', '/test', '/guiyeondo', '/my']) {
      const policy = getRouteShellPolicy(pathname);

      expect(policy.bottomTab, pathname).toBe('visible');
      expect(policy.tabAnchor, pathname).toBe('self');
    }
  });

  it('accepts only the five declared bottom-tab states', () => {
    for (const policy of Object.values(ROUTE_SHELL_POLICIES)) {
      expect(['visible', 'flow-hidden', 'door-hidden', 'immersive-hidden', 'hidden']).toContain(
        policy.bottomTab
      );
    }
  });

  it('prefers the pattern with more static segments over the dynamic one', () => {
    expect(getRouteShellPolicy('/detail/love-reunion').surface).toBe('love-reunion');
    expect(getRouteShellPolicy('/detail/tarot-basic').surface).toBe('default');
    expect(getRouteShellPolicy('/report/love-reading').surface).toBe('love-reading');
    expect(getRouteShellPolicy('/report/zzz').surface).toBe('default');
    expect(getRouteShellPolicy('/form/past-life-goblin').surface).toBe('past-life-goblin');
  });

  it('falls back to the baseline shell for unknown paths, not the light 520px one', () => {
    // NotFound differs from the baseline on one axis: no nav item matches an
    // unknown path, so the highlight falls back to the tab the reader came from.
    expect(getRouteShellPolicy('/no-such-page')).toEqual({
      ...SHELL_BASELINE,
      tabAnchor: 'origin'
    });
    expect(getRouteShellPolicy('')).toEqual(getRouteShellPolicy('/'));
    expect(getRouteShellPolicy('/my/')).toEqual(getRouteShellPolicy('/my'));
    expect(getRouteShellPolicy('  /my  ')).toEqual(getRouteShellPolicy('/my'));
  });

  it('keeps the container class names the product stylesheets are scoped to', () => {
    const expected: Record<string, string> = {
      '/admin': 'app-container admin-app-container',
      '/detail/general-saju': 'app-container general-saju-app-container',
      '/form/general-signature': 'app-container general-saju-intake-app-container',
      '/report/general-signature': 'app-container general-signature-report-app-container',
      '/guiyeondo': 'app-container guiyeondo-app-container',
      '/g/abc': 'app-container guiyeondo-app-container',
      '/detail/love-reading': 'app-container mz-love-app-container',
      '/form/love-reading': 'app-container mz-love-intake-app-container',
      '/preview/love-reading': 'app-container mz-love-intake-app-container',
      '/report/love-reading': 'app-container mz-love-report-app-container',
      '/detail/love-reunion': 'app-container reunion-app-container',
      '/form/love-reunion': 'app-container reunion-app-container',
      '/preview/love-reunion': 'app-container reunion-app-container',
      '/report/love-reunion': 'app-container reunion-app-container',
      '/detail/past-life-goblin': 'app-container past-life-app-container',
      '/detail/past-life-goblin/about': 'app-container past-life-app-container',
      '/detail/past-life-goblin/immersion': 'app-container past-life-app-container',
      '/report/past-life-goblin': 'app-container past-life-report-app-container',
      '/': 'app-container',
      '/checkout': 'app-container',
      '/detail/tarot-basic': 'app-container'
    };

    for (const [pathname, className] of Object.entries(expected)) {
      expect(getShellContainerClassName(getRouteShellPolicy(pathname)), pathname).toBe(className);
    }
  });

  it('freezes the table and every policy in it', () => {
    expect(Object.isFrozen(ROUTE_SHELL_POLICIES)).toBe(true);
    for (const policy of Object.values(ROUTE_SHELL_POLICIES)) {
      expect(Object.isFrozen(policy)).toBe(true);
    }
  });
});
