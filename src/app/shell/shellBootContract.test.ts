import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROUTE_SHELL_POLICIES } from './routeShellPolicy';

const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(
  readFileSync(new URL('../../../public/manifest.webmanifest', import.meta.url), 'utf8')
) as { theme_color: string; background_color: string };

describe('boot guard contract', () => {
  it('keeps no hand-maintained route list in the boot script', () => {
    expect(html).not.toContain('darkPrefixes');
    expect(html).not.toContain('usesDarkShell');
  });

  it('sets the shell attributes before React mounts, so there is no cream flash', () => {
    expect(html).toContain('dataset.shellTheme');
    expect(html).toContain('dataset.shellWidth');
  });

  it('keeps the boot heuristic (light means /admin) in step with the policy table', () => {
    for (const [pattern, policy] of Object.entries(ROUTE_SHELL_POLICIES)) {
      expect(policy.theme === 'light', `${pattern} disagrees with the boot heuristic`).toBe(
        pattern === '/admin'
      );
    }

    expect(html).toContain("pathname === '/admin'");
  });

  it('matches theme-color and the PWA manifest to the dark shell rail', () => {
    expect(html).toContain('name="theme-color" content="#18191a"');
    expect(manifest.theme_color).toBe('#18191a');
    expect(manifest.background_color).toBe('#18191a');
  });

  it('keeps the fragments the SEO page generator validates', () => {
    // scripts/generate-seo-pages.mjs does an exact substring check. Breaking any
    // of these fails `npm run build`, not just this test.
    expect(html).toContain('id="app-boot-guard"');
    expect(html).toContain('html.app-booting #root > .seo-static-fallback');
    expect(html).toContain("classList.add('app-booting')");
  });

  it('boots on the rail colour so the first paint already matches the shell', () => {
    expect(html).toMatch(/html\.app-booting[\s\S]{0,200}background:\s*#18191a/);
  });

  it('removes the same classes the boot script adds', () => {
    const main = readFileSync(new URL('../../main.tsx', import.meta.url), 'utf8');

    expect(html).toContain("classList.add('app-booting-light')");
    expect(main).toContain("classList.remove('app-booting', 'app-booting-light')");
    expect(html).not.toContain('app-booting-dark');
    expect(main).not.toContain('app-booting-dark');
  });
});
