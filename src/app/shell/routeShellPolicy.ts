/**
 * Declarative app-shell policy.
 *
 * Every visual decision the global shell makes for a route lives in one frozen
 * table. `AppShell`, `BottomTabBar`, `appShell.css` and the boot guard in
 * index.html all derive from it, so the shell can no longer disagree with
 * itself the way the hand-maintained booleans in App.tsx used to.
 *
 * Follows the declarative-table precedent of `src/app/guards/routeAccessPolicy.ts`,
 * but resolves purely from the table instead of re-implementing it with `if`s.
 */

export type ShellTheme = 'dark' | 'light';

/** `card` (520px) is a light-shell leftover. No route may use it. */
export type ShellWidth = 'phone' | 'card' | 'canvas' | 'wide' | 'full';

export type ShellTopBar = 'global' | 'product' | 'none';

export type ShellBottomTab =
  | 'visible'
  | 'flow-hidden'
  | 'door-hidden'
  | 'immersive-hidden'
  | 'hidden';

/** `origin` keeps the tab highlight on the tab the user came from. */
export type ShellTabAnchor = 'self' | 'origin';

export type ShellSurface =
  | 'default'
  | 'general-signature'
  | 'love-reading'
  | 'love-reunion'
  | 'past-life-goblin'
  | 'guiyeondo'
  | 'admin';

export type RouteShellPolicy = Readonly<{
  theme: ShellTheme;
  width: ShellWidth;
  topBar: ShellTopBar;
  bottomTab: ShellBottomTab;
  tabAnchor: ShellTabAnchor;
  footer: boolean;
  surface: ShellSurface;
  /**
   * Extra class on `.app-container`. Kept because 34 product CSS rules are
   * scoped to these names for things other than width and background.
   */
  containerClass: string;
}>;

/** The home shell is the baseline. Other routes deviate only where measured. */
export const SHELL_BASELINE: RouteShellPolicy = Object.freeze({
  theme: 'dark',
  width: 'phone',
  topBar: 'global',
  bottomTab: 'visible',
  tabAnchor: 'self',
  footer: true,
  surface: 'default',
  containerClass: ''
});

const shell = (overrides: Partial<RouteShellPolicy> = {}): RouteShellPolicy =>
  Object.freeze({ ...SHELL_BASELINE, ...overrides });

/** Purchase funnel: no exit bait, and no second bar under the page's own action bar. */
const FLOW = { bottomTab: 'flow-hidden', tabAnchor: 'origin', footer: false } as const;

/** 100svh single-screen entry cut. The page's own CTA owns the bottom; exit is the top bar. */
const DOOR = { bottomTab: 'door-hidden', tabAnchor: 'origin', footer: false } as const;

/** Full-bleed cinematic landing that renders its own footer and its own fixed dock. */
const IMMERSIVE = { bottomTab: 'immersive-hidden', tabAnchor: 'origin', footer: false } as const;

export const ROUTE_SHELL_POLICIES = Object.freeze({
  /* ── Home and shared browsing ─────────────────────────────────────── */
  '/': shell(),
  '/menu': shell(), // <Navigate to="/" />
  '/tarot': shell(), // <Navigate to="/" />
  '/test': shell(),
  '/test/face-ai': shell(),
  /* 마이는 고객센터·약관을 자기 화면 안에 그린다(참고한 마이페이지들처럼 메뉴 끝에
     붙는 자리다). 전역 푸터까지 켜 두면 한 화면에 같은 연락처와 같은 약관 링크가 두 번
     나온다. 귀연도와 같은 이유로 여기서만 푸터를 끈다. */
  '/my': shell({ footer: false, containerClass: 'ud-app-container' }),
  /* 마이 아래 두 화면. 탭 매처가 `startsWith('/my')` 라서 여기 서 있어도 마이 탭이
     켜진다 — `self` 로 두어야 그 강조가 맞는다. 상단바는 페이지가 직접 그린다.
     이 둘은 자기 약관 블록이 없으므로 전역 푸터를 그대로 쓴다. */
  '/my/reports': shell({ containerClass: 'ud-app-container' }),
  '/my/manseryeok': shell({ containerClass: 'ud-app-container' }),
  '/my/coupons': shell({ containerClass: 'ud-app-container' }),
  /* 채팅은 자기 입력줄을 바닥에 고정한다. 전역 푸터가 그 아래 깔리면 스크롤이
     엉키므로 끈다. 탭바는 그대로 둔다 — 대화 중에도 나갈 길은 있어야 한다. */
  '/chat': shell({ tabAnchor: 'origin', footer: false, containerClass: 'ud-app-container' }),
  /* 오늘의 운세는 마이에서 들어가지만 탭 목적지는 아니다. 'origin' 으로 두어야
     들어온 탭이 계속 켜져 있는다. */
  '/today': shell({ tabAnchor: 'origin', containerClass: 'ud-app-container' }),
  '/login': shell(),
  /* Not tab destinations: no nav item matches them, so `self` would leave the
     bar with no tab lit at all. `origin` falls back to the tab the reader came
     from, which is the home tab by default. */
  '/search': shell({ tabAnchor: 'origin' }),
  '/terms': shell({ tabAnchor: 'origin' }),
  '/privacy': shell({ tabAnchor: 'origin' }),
  '/refund': shell({ tabAnchor: 'origin' }),
  '*': shell({ tabAnchor: 'origin' }), // NotFound

  /* ── Product entry cuts (100svh single screen, own bottom CTA) ─────── */
  '/detail/general-saju': shell({
    surface: 'general-signature',
    containerClass: 'general-saju-app-container',
    ...DOOR
  }),
  '/detail/love-reading': shell({
    surface: 'love-reading',
    containerClass: 'mz-love-app-container',
    ...DOOR
  }),
  '/detail/past-life-goblin': shell({
    topBar: 'product',
    surface: 'past-life-goblin',
    containerClass: 'past-life-app-container',
    ...DOOR
  }),

  /* ── Full-bleed landings that own their column, dock and footer ────── */
  '/detail/love-reunion': shell({
    topBar: 'product',
    surface: 'love-reunion',
    containerClass: 'reunion-app-container',
    ...IMMERSIVE
  }),
  '/detail/past-life-goblin/about': shell({
    topBar: 'product',
    surface: 'past-life-goblin',
    containerClass: 'past-life-app-container',
    ...IMMERSIVE
  }),
  '/detail/past-life-goblin/immersion': shell({
    topBar: 'product',
    surface: 'past-life-goblin',
    containerClass: 'past-life-app-container',
    ...IMMERSIVE
  }),

  /* ── Generic detail (used to fall through to the light 520px shell) ── */
  '/detail/:id': shell({ tabAnchor: 'origin' }),

  /* ── Purchase funnel ──────────────────────────────────────────────── */
  '/form/general-signature': shell({
    topBar: 'product',
    surface: 'general-signature',
    containerClass: 'general-saju-intake-app-container',
    ...FLOW
  }),
  '/form/past-life-goblin': shell({ topBar: 'product', surface: 'past-life-goblin', ...FLOW }),
  '/form/love-reading': shell({
    topBar: 'product',
    surface: 'love-reading',
    containerClass: 'mz-love-intake-app-container',
    ...FLOW
  }),
  '/form/love-reunion': shell({
    topBar: 'product',
    surface: 'love-reunion',
    containerClass: 'reunion-app-container',
    ...FLOW
  }),
  '/form/:id': shell({ topBar: 'product', ...FLOW }),
  '/preview/love-reading': shell({
    topBar: 'product',
    surface: 'love-reading',
    containerClass: 'mz-love-intake-app-container',
    ...FLOW
  }),
  '/preview/love-reunion': shell({
    topBar: 'product',
    surface: 'love-reunion',
    containerClass: 'reunion-app-container',
    ...FLOW
  }),
  '/checkout': shell({ ...FLOW }),
  '/loading': shell({ ...FLOW }),
  '/auth/kakao/callback': shell({ topBar: 'none', ...FLOW }),
  '/payment/portone/callback': shell({ topBar: 'none', ...FLOW }),

  /* ── Reports: long-form documents, so the frame is the viewport ─────── */
  /* 리포트도 폰 프레임이다. 예전에는 canvas(= 프레임 폭 == 뷰포트 폭)를 써야 했다.
     제품 시트가 레이아웃을 뷰포트에 물었기 때문에, 1280px 창 안의 400px 프레임에서는
     데스크톱 그리드가 폰 폭 상자 안에서 돌며 고정 컬럼이 본문을 레일 밖으로 밀어냈다.
     지금은 그 쿼리들이 전부 @container app 으로 바뀌어 프레임을 재므로, 폭을 묶어도
     거짓말을 하지 않는다. PC 에서도 폰 화면 그대로 보인다. */
  '/report/general-signature': shell({
    topBar: 'product',
    surface: 'general-signature',
    containerClass: 'general-signature-report-app-container',
    ...FLOW
  }),
  '/report/love-reading': shell({
    topBar: 'product',
    surface: 'love-reading',
    containerClass: 'mz-love-report-app-container',
    ...FLOW
  }),
  '/report/love-reunion': shell({
    topBar: 'product',
    surface: 'love-reunion',
    containerClass: 'reunion-app-container',
    ...FLOW
  }),
  '/report/past-life-goblin': shell({
    topBar: 'product',
    surface: 'past-life-goblin',
    containerClass: 'past-life-report-app-container',
    ...FLOW
  }),
  '/report/:id': shell({ topBar: 'product', ...FLOW }),

  /* ── Guiyeondo ──────────────────────────────────────────────────────── */
  /* This once opened to 1440px at >=960px so the map and the person list could
     sit side by side. That exception is gone: `wide` now resolves to the same
     400px as every other customer route (see appShell.css), because the product
     follows one rule — the phone frame, on a desktop window too. The token is
     kept rather than folded into `phone` so the two-column layout has a name to
     come back to; it lives in guiyeondo.css's `@container` queries now.
     What still makes this route an exception among the four bottom-tab
     destinations is the footer: it renders its own legal links. */
  '/guiyeondo': shell({
    width: 'wide',
    topBar: 'product',
    surface: 'guiyeondo',
    containerClass: 'guiyeondo-app-container',
    /* `self`, like the other three tab destinations: with `origin` the 귀연도
       tab was the one tab that never lit up while you stood on it. */
    footer: false
  }),
  '/g/:publicId': shell({
    width: 'wide',
    topBar: 'product',
    surface: 'guiyeondo',
    containerClass: 'guiyeondo-app-container',
    bottomTab: 'hidden',
    tabAnchor: 'origin',
    footer: false
  }),

  /* ── Admin: the only light, full-width surface. There is no /admin/* route. ──
     `topBar: 'none'` is the honest value: the operator console renders its own
     `.admin-hero` band and the three lock screens render nothing, so no bar on
     this route is ever sized by the shell. */
  '/admin': shell({
    theme: 'light',
    width: 'full',
    topBar: 'none',
    surface: 'admin',
    containerClass: 'admin-app-container',
    bottomTab: 'hidden',
    tabAnchor: 'origin',
    footer: false
  })
} as const satisfies Readonly<Record<string, RouteShellPolicy>>);

/* ── Resolver: derived from the table only, never re-implemented with ifs ── */

const normalizePathname = (pathname: string) => {
  const normalized = pathname.trim() || '/';
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
};

const toSegments = (value: string) => value.split('/').filter(Boolean);

type CompiledPattern = Readonly<{
  segments: readonly string[];
  staticCount: number;
  policy: RouteShellPolicy;
}>;

const COMPILED_PATTERNS: readonly CompiledPattern[] = Object.freeze(
  Object.entries(ROUTE_SHELL_POLICIES)
    .filter(([pattern]) => pattern.includes(':'))
    .map(([pattern, policy]) => {
      const segments = toSegments(pattern);
      return Object.freeze({
        segments,
        staticCount: segments.filter((segment) => !segment.startsWith(':')).length,
        policy
      });
    })
    .sort((a, b) => b.staticCount - a.staticCount || b.segments.length - a.segments.length)
);

export function getRouteShellPolicy(pathname: string): RouteShellPolicy {
  const target = normalizePathname(pathname);
  const exact = (ROUTE_SHELL_POLICIES as Record<string, RouteShellPolicy | undefined>)[target];

  if (exact) {
    return exact;
  }

  const targetSegments = toSegments(target);

  for (const pattern of COMPILED_PATTERNS) {
    if (targetSegments.length !== pattern.segments.length) {
      continue;
    }

    const matched = pattern.segments.every(
      (segment, index) => segment.startsWith(':') || segment === targetSegments[index]
    );

    if (matched) {
      return pattern.policy;
    }
  }

  return ROUTE_SHELL_POLICIES['*'];
}

/** The invariant the index.html boot guard encodes. A contract test compares them. */
export function isDarkBootRoute(pathname: string): boolean {
  return getRouteShellPolicy(pathname).theme === 'dark';
}

/** `.app-container` class list for a route. */
export function getShellContainerClassName(policy: RouteShellPolicy): string {
  return policy.containerClass ? `app-container ${policy.containerClass}` : 'app-container';
}
