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
  '/my': shell(),
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
    width: 'canvas',
    topBar: 'product',
    surface: 'love-reunion',
    containerClass: 'reunion-app-container',
    ...IMMERSIVE
  }),
  '/detail/past-life-goblin/about': shell({
    width: 'canvas',
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
  /* Every report stylesheet keys its layout to the viewport (`max-width: 767px`
     in generalSignatureReport.css, `min-width: 768px` in reunion.css,
     `min-width: 680px` in mz-love-report.css, `max-width: 640px` for the shared
     premium report). A 400px frame inside a 1280px window makes those queries
     lie: the desktop grid runs in a phone-width box and its fixed columns push
     the body text onto the rail. `canvas` keeps frame width == viewport width,
     so the queries stay truthful at every size, and on a phone it is identical
     to `phone`. It is also what these routes measured before the shell refactor. */
  '/report/general-signature': shell({
    width: 'canvas',
    topBar: 'product',
    surface: 'general-signature',
    containerClass: 'general-signature-report-app-container',
    ...FLOW
  }),
  '/report/love-reading': shell({
    width: 'canvas',
    topBar: 'product',
    surface: 'love-reading',
    containerClass: 'mz-love-report-app-container',
    ...FLOW
  }),
  '/report/love-reunion': shell({
    width: 'canvas',
    topBar: 'product',
    surface: 'love-reunion',
    containerClass: 'reunion-app-container',
    ...FLOW
  }),
  '/report/past-life-goblin': shell({
    width: 'canvas',
    topBar: 'product',
    surface: 'past-life-goblin',
    containerClass: 'past-life-report-app-container',
    ...FLOW
  }),
  '/report/:id': shell({ width: 'canvas', topBar: 'product', ...FLOW }),

  /* ── Guiyeondo: the one intentional desktop two-column surface ─────── */
  /* Deliberate exception among the four bottom-tab destinations: the only one
     that is not a 400px frame (it opens to 1440px at >=960px, where the map and
     the person list sit side by side) and the only one without the global
     footer (it renders its own legal links). On a phone it is 400px like the
     others, so the tab bar still lands on one consistent frame. */
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
