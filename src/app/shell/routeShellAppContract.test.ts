import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROUTE_SHELL_POLICIES } from './routeShellPolicy';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const appSource = read('../../App.tsx');
const appRoutePaths = Array.from(appSource.matchAll(/<Route\s+path="([^"]+)"/g), (m) => m[1]);

describe('App route and shell-policy integration contract', () => {
  it('declares a shell policy for every route App.tsx renders', () => {
    const declared = new Set(Object.keys(ROUTE_SHELL_POLICIES));

    expect(appRoutePaths.filter((path) => !declared.has(path))).toEqual([]);
  });

  it('keeps every concrete policy entry reachable through a declared route family', () => {
    // /form/general-signature and /report/love-reunion are reached via /form/:id
    // and /report/:id, so the family segment must exist in App.tsx.
    const dynamicFamilies = appRoutePaths
      .filter((path) => path.includes(':'))
      .map((path) => path.split('/')[1]);

    for (const pattern of Object.keys(ROUTE_SHELL_POLICIES)) {
      if (pattern === '*' || appRoutePaths.includes(pattern)) {
        continue;
      }

      expect(dynamicFamilies, `${pattern} has no matching route in App.tsx`).toContain(
        pattern.split('/')[1]
      );
    }
  });

  it('stops AppShell re-implementing the shell decision it now looks up', () => {
    expect(appSource).toContain('getRouteShellPolicy');
    expect(appSource).toContain('useShellDocumentAttributes');

    for (const retired of [
      'usesDarkAppShell',
      'isImmersiveReunionRoute',
      'isImmersiveLoveRoute',
      'isPastLifeLandingRoute',
      'hideGlobalChrome',
      'hideFooter',
      "classList.toggle('home-all-black'"
    ]) {
      expect(appSource, `${retired} came back into App.tsx`).not.toContain(retired);
    }

    // The container class names stay: 30+ product CSS rules are scoped to them.
    // They now come from the policy table instead of an 11-branch ternary.
    expect(appSource).toContain('getShellContainerClassName');
    expect(appSource).not.toMatch(/'app-container [a-z-]+'/);
  });

  it('leaves the tab bar and footer with no route lists of their own', () => {
    const tabBar = read('../../components/BottomTabBar.tsx');
    const footer = read('../../components/Footer.tsx');

    expect(footer).not.toContain('hiddenPrefixes');
    expect(footer).not.toContain('useLocation');
    expect(tabBar).not.toContain('inFlowPage');
    expect(tabBar).not.toContain('isPastLifeExperience');
    // The navigation-state based hide is absorbed by the policy too.
    expect(tabBar).not.toContain('locationState?.product');
    // Only the tabAnchor axis decides which tab reads as current.
    expect(tabBar).toContain('tabAnchor');
    expect(tabBar).toContain('getRouteShellPolicy');
  });

  it('renders an actual top bar on every door-hidden route', () => {
    // The policy promises "the way out is the top bar", so one must exist.
    expect(read('../../pages/LoveReadingEntry.tsx')).toContain('MobileTopBar');
    expect(read('../../pages/GeneralSajuLanding.tsx')).toContain('MobileTopBar');
    expect(read('../../styles/past-life.css')).toContain('.dokkaebi-entry-head');
  });

  /* Every route whose policy says `topBar: 'product'` must actually render a bar,
     and that bar must be one the shell sizes. Checking it from both ends is the
     point: seven routes used to declare a bar and render no <header> at all, and
     `.intake-story-topbar` used to render at 58px because it was missing from the
     shell's selector list. */
  const PRODUCT_TOP_BARS: Readonly<Record<string, readonly [string, ...string[]]>> = {
    '/detail/past-life-goblin': ['pages/PastLifeEntry.tsx:dokkaebi-entry-head'],
    '/detail/love-reunion': ['features/reunion/ReunionLanding.tsx:rw-topbar'],
    '/detail/past-life-goblin/about': ['pages/PastLifeLanding.tsx:dokkaebi-site-head'],
    '/detail/past-life-goblin/immersion': ['pages/PastLifeImmersion.tsx:dokkaebi-immersion-head'],
    '/form/general-signature': [
      'products/general-signature/GeneralSignatureIntake.tsx:gs-intake-topbar'
    ],
    '/form/past-life-goblin': ['pages/Form.tsx:intake-story-topbar'],
    '/form/love-reading': ['pages/LoveReadingIntake.tsx:mz-love-intake-header'],
    '/form/love-reunion': ['features/reunion/ReunionIntake.tsx:reunion-intake-header'],
    '/form/:id': ['pages/Form.tsx:intake-story-topbar'],
    '/preview/love-reading': ['pages/LoveReadingPreview.tsx:mz-love-preview-header'],
    '/preview/love-reunion': ['features/reunion/ReunionPreview.tsx:reunion-intake-header'],
    '/report/general-signature': ['pages/Report.tsx:premium-report-topbar'],
    '/report/love-reading': ['pages/Report.tsx:premium-report-topbar'],
    '/report/love-reunion': ['features/reunion/ReunionReportView.tsx:reunion-topbar'],
    '/report/past-life-goblin': ['pages/Report.tsx:premium-report-topbar'],
    '/report/:id': ['pages/Report.tsx:premium-report-topbar'],
    '/guiyeondo': [
      'features/guiyeondo/GuiyeondoPage.tsx:gy-topbar',
      'features/guiyeondo/GuiyeondoIntro.tsx:gy-topbar'
    ],
    '/g/:publicId': ['features/guiyeondo/GuiyeondoGuestPage.tsx:gy-topbar']
  };

  it('covers exactly the routes whose policy declares a product top bar', () => {
    const declared = Object.entries(ROUTE_SHELL_POLICIES)
      .filter(([, policy]) => policy.topBar === 'product')
      .map(([pattern]) => pattern)
      .sort();

    expect(Object.keys(PRODUCT_TOP_BARS).sort()).toEqual(declared);
  });

  it('renders the declared bar in every component behind those routes', () => {
    for (const [pattern, entries] of Object.entries(PRODUCT_TOP_BARS)) {
      for (const entry of entries) {
        const [file, bar] = entry.split(':');

        expect(read(`../../${file}`), `${pattern} -> ${file} renders no <header> for .${bar}`).toContain(
          `<header className="${bar}`
        );
      }
    }
  });

  it('sizes every rendered product bar from the shell, and sizes nothing dead', () => {
    const css = read('./appShell.css');
    const block = css.slice(css.indexOf('.primary-topbar,'), css.indexOf('}', css.indexOf('.primary-topbar,')));
    const sized = Array.from(block.matchAll(/\.([a-z0-9-]+)/g), (m) => m[1]).sort();
    const rendered = new Set(
      Object.values(PRODUCT_TOP_BARS).flatMap((entries) => entries.map((e) => e.split(':')[1]))
    );

    for (const bar of rendered) {
      expect(sized, `.${bar} is rendered but the shell does not size it`).toContain(bar);
    }

    // `primary-topbar` is the global bar (MobileTopBar); the rest must be rendered.
    for (const bar of sized) {
      expect(
        rendered.has(bar) || bar === 'primary-topbar',
        `.${bar} is sized by the shell but no route renders it`
      ).toBe(true);
    }
  });

  it('marks the current bottom tab for assistive tech, not only with a fill', () => {
    const tabBar = read('../../components/BottomTabBar.tsx');

    expect(tabBar).toContain("aria-current={active ? 'page' : undefined}");
    expect(read('./appShell.css')).toContain('@media (forced-colors: active)');
  });

  it('keeps exactly one page-level header element on the past-life entry route', () => {
    // 62px / 616px / 77px used to be three <header> elements on one screen.
    // Only the real top bar stays a <header>; the SEO blocks are plain divs.
    const entry = read('../../pages/PastLifeEntry.tsx');

    expect(entry.match(/<header\b/g) ?? []).toHaveLength(1);
    expect(entry).toContain('<header className="dokkaebi-entry-head">');
    expect(entry).toContain('dokkaebi-entry-seo-faq-head');
    expect(entry).toContain('<div className="dokkaebi-entry-seo-hero">');
  });

  it('keeps the product lifecycle boundaries composed outside the flow pages', () => {
    expect(appSource).toContain('<ProductIntakeRouteBoundary>');
    expect(appSource).toContain('<ProductCheckoutRouteBoundary>');
    expect(appSource).toContain('<ProductLoadingRouteBoundary>');
    expect(appSource).toContain('<HistoricalReportRouteBoundary>');
  });

  it('loads the shell stylesheet once, from the app entrypoint', () => {
    const main = read('../../main.tsx');

    expect(main).toContain("import './index.css'");
    expect(main).toContain("import './app/shell/appShell.css'");
  });
});
