import { useLayoutEffect } from 'react';
import type { RouteShellPolicy } from './routeShellPolicy';

const THEME_COLOR: Record<RouteShellPolicy['theme'], string> = {
  dark: '#18191a',
  light: '#ffffff'
};

/**
 * Projects the route shell policy onto `<html data-shell-*>`.
 * `appShell.css` reads those attributes, so every shell decision is made once.
 */
export function useShellDocumentAttributes(policy: RouteShellPolicy) {
  useLayoutEffect(() => {
    const root = document.documentElement;

    root.dataset.shellTheme = policy.theme;
    root.dataset.shellWidth = policy.width;
    root.dataset.shellTopbar = policy.topBar;
    root.dataset.shellTabbar = policy.bottomTab;
    root.dataset.shellFooter = policy.footer ? 'visible' : 'hidden';
    root.dataset.shellSurface = policy.surface;

    /* Compatibility bridge, not a route list: index.css still carries ~380
       `body.home-all-black .x` component rules that paint the dark theme.
       The class is now derived from the single policy table instead of the
       hand-maintained `usesDarkAppShell` boolean, which is why routes such as
       /checkout, /loading, /form/:id, /detail/:id and NotFound stop falling
       through to the cream shell. Drop this line once those rules are keyed to
       `:root[data-shell-theme='dark']` directly. */
    document.body.classList.toggle('home-all-black', policy.theme === 'dark');

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[policy.theme]);
  }, [policy]);
}
