import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

const shell = () => read('app/shell/appShell.css');

/** Sheets that must not re-assert container geometry or the page background. */
const PRODUCT_STYLESHEETS = [
  'styles/general-saju.css',
  'styles/chat.css',
  'styles/daily.css',
  'styles/gift.css',
  'styles/my.css',
  'styles/mz-love-fact.css',
  'styles/mz-love-intake.css',
  'styles/mz-love-report.css',
  'styles/past-life.css',
  'styles/reunion.css',
  'styles/reunion-premium.css',
  'styles/ud-tokens.css',
  'styles/reunion-intake.css',
  'styles/reunion-webtoon.css',
  'styles/reunion-report.css',
  'styles/guiyeondo.css',
  'products/general-signature/generalSignatureIntake.css',
  'products/general-signature/generalSignatureReport.css',
  'admin/admin.css',
  'index.css'
] as const;

const SHELL_OWNED_PROPERTIES = /(^|[;{\s])(max-width|width|background|box-shadow)\s*:/;

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** `@media print` is a separate rendering target and is exempt. */
const stripPrintBlocks = (css: string) => css.replace(/@media\s+print\s*\{[\s\S]*?\n\}/g, '');

type Rule = { selector: string; body: string };

const toRules = (css: string): Rule[] =>
  Array.from(stripComments(stripPrintBlocks(css)).matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({
    selector: match[1].trim(),
    body: match[2]
  }));

/** True when `.app-container` (or a `*-app-container`) is the rule's subject. */
const targetsContainerItself = (selector: string) =>
  selector
    .split(',')
    .map((part) => part.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() ?? '')
    .some((subject) => subject.includes('app-container'));

describe('shell style contract', () => {
  it('leaves container geometry and background to the shell alone', () => {
    for (const file of PRODUCT_STYLESHEETS) {
      const offenders = toRules(read(file))
        .filter((rule) => targetsContainerItself(rule.selector))
        .filter((rule) => SHELL_OWNED_PROPERTIES.test(rule.body))
        .map((rule) => rule.selector);

      expect(offenders, `${file} re-declares .app-container geometry`).toEqual([]);
    }
  });

  it('never lets a product sheet paint the page background', () => {
    // This is what made /detail/love-reading the only rgb(8,7,9) route.
    for (const file of PRODUCT_STYLESHEETS) {
      const offenders = toRules(read(file))
        .filter((rule) => /(^|,)\s*(html|body)(:has\([^)]*\))?\s*(,|$)/m.test(rule.selector))
        .filter((rule) => /(^|[;{\s])background(-color)?\s*:/.test(rule.body))
        .map((rule) => rule.selector);

      expect(offenders, `${file} paints html/body`).toEqual([]);
    }
  });

  it('defines all four safe-area insets unconditionally on :root', () => {
    const css = shell();

    for (const token of [
      '--app-safe-top',
      '--app-safe-right',
      '--app-safe-bottom',
      '--app-safe-left'
    ]) {
      expect(css).toContain(`${token}: env(safe-area-inset-`);
    }
  });

  it('keeps --app-tabbar-h at 0px unless the bar actually renders', () => {
    const css = shell();

    expect(css).toMatch(/--app-tabbar-h:\s*0px/);
    expect(css).toMatch(/\[data-shell-tabbar='visible'\][^{]*\{[^}]*--app-tabbar-h:\s*calc\(/);
  });

  it('collapses all four hidden tab-bar states to a zero height', () => {
    const css = shell();

    for (const state of ['flow-hidden', 'door-hidden', 'immersive-hidden', 'hidden']) {
      expect(
        css,
        `${state} must not redefine --app-tabbar-h`
      ).not.toMatch(new RegExp(`\\[data-shell-tabbar='${state}'\\][^{]*\\{[^}]*--app-tabbar-h:`));
    }
  });

  it('routes every bottom-spacing magic number through the tab-bar token', () => {
    const css = shell();

    for (const selector of [
      '.intake-story-page',
      '.intake-story-actions',
      '.past-life-goblin-flow-page',
      '.reunion-intake-page',
      '.reunion-intake-actions',
      '.mz-love-intake-footer',
      '.site-footer'
    ]) {
      const at = css.indexOf(`${selector} {`);

      expect(at, `no shell rule for ${selector}`).toBeGreaterThan(-1);
      expect(css.slice(at, at + 400), `${selector} ignores the tab-bar token`).toContain(
        'var(--app-tabbar-h)'
      );
    }
  });

  it('keeps the tab label visually hidden so the 298px pill cannot burst', () => {
    const css = shell();
    const at = css.indexOf('.bottom-tab span');

    expect(at).toBeGreaterThan(-1);
    expect(css.slice(at, at + 280)).toContain('clip: rect(0, 0, 0, 0)');
  });

  it('gives every unified top bar one height token and the top inset', () => {
    const css = shell();
    const at = css.indexOf(".primary-topbar,");

    expect(at).toBeGreaterThan(-1);

    const block = css.slice(at, css.indexOf('}', at));

    expect(block).toContain('var(--app-topbar-h)');
    expect(block).toContain('var(--app-safe-top)');

    for (const bar of [
      '.reunion-topbar',
      '.reunion-intake-header',
      '.gy-topbar',
      '.gs-intake-topbar',
      '.intake-story-topbar',
      '.dokkaebi-entry-head',
      '.dokkaebi-immersion-head',
      '.dokkaebi-site-head',
      '.mz-love-intake-header',
      '.mz-love-preview-header',
      '.premium-report-topbar',
      '.rw-topbar'
    ]) {
      expect(block, `${bar} is not in the unified top-bar rule`).toContain(bar);
    }
  });

  it('spends a bar\'s own hairline out of the 64px budget, not on top of it', () => {
    // .reunion-intake-header / .dokkaebi-site-head / .premium-report-topbar each
    // carry `border-bottom: 1px`, which measured 65px against everyone else's 64.
    const css = shell();
    const at = css.indexOf('--app-topbar-pad-bottom: 5px');

    expect(at).toBeGreaterThan(-1);

    const rule = css.slice(css.lastIndexOf('}', at), at);

    for (const bar of ['.reunion-intake-header', '.dokkaebi-site-head', '.premium-report-topbar']) {
      expect(rule, `${bar} still pays for its border twice`).toContain(bar);
    }

    // The report bar is the outer element now, so the inner column must not add
    // its own 12px block padding back on top.
    const inner = css.indexOf('.premium-report-topbar-inner {');
    expect(inner).toBeGreaterThan(-1);
    expect(css.slice(inner, inner + 220)).toContain('padding-top: 0');
  });

  it('keeps fixed page furniture inside the frame, not the viewport', () => {
    // `position: fixed` resolves against the viewport, so on a 1280px desktop
    // these three escaped the 400px frame and painted over the rail.
    const css = shell();

    const frameBound = css.slice(
      css.indexOf(".app-cta-dock {"),
      css.indexOf('@media (min-width: 768px)')
    );

    for (const selector of [
      '.intake-story-backdrop',
      '.intake-story-shade',
      '.dokkaebi-immersion-page'
    ]) {
      expect(frameBound, `no shell rule binding ${selector} to the frame`).toContain(
        `:root[data-shell-width='phone'] ${selector}`
      );
    }

    const reunion = css.lastIndexOf('.reunion-intake-actions {');
    const block = css.slice(reunion, css.indexOf('}', reunion));

    // `width: auto` alone left left:0/right:0 in charge and stretched the bar.
    expect(block).toContain('width: min(var(--app-shell-width-px), 100%)');
    expect(block).toContain('margin-inline: auto');
    // reunion.css's desktop block also turns the surface off; restore all of it.
    expect(block).toContain('background:');
    expect(block).toContain('border-top:');
    expect(block).toContain('grid-template-columns:');
  });

  it('keeps the flow action dock clear of the home indicator', () => {
    // --app-tabbar-h is 0 on flow routes, so it cannot carry safe-bottom there,
    // and it already contains safe-bottom when the bar is visible: max(), not +.
    const css = shell();
    const at = css.indexOf('.intake-story-actions {');

    expect(css.slice(at, at + 160)).toContain(
      'max(var(--app-tabbar-h), var(--app-safe-bottom))'
    );
  });

  it('caps the raw env(safe-area-inset) left outside the shell so it can only shrink', () => {
    // The shell owns four tokens; 86 hand-written insets survive in product
    // sheets. This is a ratchet, not an approval: lower the number, never raise it.
    const RAW_ENV_BUDGET = 86;
    const total = PRODUCT_STYLESHEETS.concat(['styles/general-signature-loading.css'])
      .map((file) => (stripComments(read(file)).match(/env\(\s*safe-area-inset/g) ?? []).length)
      .reduce((sum, count) => sum + count, 0);

    expect(total).toBeLessThanOrEqual(RAW_ENV_BUDGET);
  });

  it('expresses stacking order as tokens, tab bar below the page dock', () => {
    const css = shell();

    expect(css).toMatch(/--z-page-cta:\s*50/);
    expect(css).toMatch(/--z-tabbar:\s*60/);
    expect(css).toMatch(/--z-page-dock:\s*70/);
  });

  it('never needs !important to beat the product sheets', () => {
    expect(stripComments(shell())).not.toContain('!important');
  });

  it('removed the 104px footer magic number', () => {
    expect(read('index.css')).not.toMatch(/\.site-footer\s*\{[^}]*104px/);
  });

  it('leaves exactly one bottom tab-bar definition in the codebase', () => {
    const roots = PRODUCT_STYLESHEETS.flatMap((file) =>
      toRules(read(file)).filter((rule) =>
        rule.selector
          .split(',')
          .some((part) => part.trim() === '.bottom-tabbar' || part.trim() === '.bottom-tab')
      )
    );

    expect(roots.map((rule) => rule.selector)).toEqual([]);
  });
});
