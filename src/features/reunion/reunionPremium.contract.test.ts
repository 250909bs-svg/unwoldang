import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 재회운 프리미엄 디자인 시스템의 계약.
 *
 * 다음 단계에서 상세 · 입력 · 리포트 세 화면을 **동시에** 세 사람이 만든다.
 * 이 파일은 그 세 사람이 합의한 것을 문자열이 아니라 검증으로 붙잡아 둔다:
 *   1) 토큰 이름이 사라지거나 값이 조용히 바뀌지 않는다.
 *   2) 주석에 적은 대비비가 실제로 맞는다(여기서 다시 계산한다).
 *   3) 면 사다리가 단조 증가하고, 각 단계가 눈에 보이는 폭을 유지한다.
 *   4) 모션이 레이아웃 속성을 건드리지 않는다.
 *   5) 선언한 모든 애니메이션이 감속 선호 블록에서 무력화된다.
 *   6) 셸이 소유한 컨테이너 폭·배경을 다시 주장하지 않는다.
 */

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const sheet = () => read('../../styles/reunion-premium.css');
const ornaments = () => read('./reunionOrnaments.tsx');
const meters = () => read('./reunionMeters.tsx');

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 토큰 값을 시트에서 그대로 읽는다. 값을 테스트에 베껴 쓰지 않는다.
 * `var(--other)` 별칭은 한 단계씩 따라간다(순환이면 던진다).
 */
const token = (name: string, depth = 0): string => {
  const match = stripComments(sheet()).match(new RegExp(`${name}:\\s*([^;]+);`, 'u'));
  expect(match, `${name} is not declared`).not.toBeNull();
  const value = (match as RegExpMatchArray)[1].trim();

  const alias = value.match(/^var\(\s*(--[\w-]+)\s*\)$/u);
  if (!alias) return value;

  expect(depth, `${name} aliases in a cycle`).toBeLessThan(8);
  return token(alias[1], depth + 1);
};

/* ── 대비 계산 (WCAG 2.x relative luminance) ─────────────────────── */

const channel = (value: number) => {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (hex: string) => {
  const clean = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(clean.slice(at, at + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('reunion premium design system', () => {
  /* ── 면 사다리 ───────────────────────────────────────────────── */

  it('keeps the surface ladder opaque, monotonic and perceptible', () => {
    /* 밤티의 1차 원인은 표면을 알파로 칠해 배경과 합성 대비가 1.000:1 이 된 것이다.
       사다리는 전부 불투명 hex 여야 하고, 아래에서 위로 단조 증가해야 한다. */
    const ladder = ['--ud-floor', '--ud-surface-1', '--ud-surface-2', '--ud-surface-3', '--ud-surface-4'].map(
      (name) => {
        const value = token(name);
        expect(value, `${name} must be an opaque hex, not an alpha colour`).toMatch(
          /^#[0-9a-f]{6}$/iu
        );
        return { name, value };
      }
    );

    for (let at = 1; at < ladder.length; at += 1) {
      const step = contrast(ladder[at].value, ladder[at - 1].value);
      expect(
        step,
        `${ladder[at].name} vs ${ladder[at - 1].name} is ${step.toFixed(3)}:1 — the eye cannot find that edge`
      ).toBeGreaterThanOrEqual(1.06);
      expect(luminance(ladder[at].value)).toBeGreaterThan(luminance(ladder[at - 1].value));
    }

    /* 바닥에서 가장 밝은 글자용 면까지는 확실히 벌어져 있어야 한다. */
    expect(contrast(token('--ud-surface-3'), token('--ud-floor'))).toBeGreaterThanOrEqual(1.24);
  });

  it('starts the ladder on the shell background so the page never seams', () => {
    /* 셸이 `[data-shell-surface='love-reunion']` 에 --app-shell-bg 를 준다.
       바닥 토큰이 그것과 다르면 아트가 끝나는 지점에 경계선이 보인다. */
    const shell = read('../../app/shell/appShell.css');
    const block = shell.slice(shell.indexOf("[data-shell-surface='love-reunion']"));
    const bg = block.slice(0, block.indexOf('}')).match(/--app-shell-bg:\s*(#[0-9a-f]{6})/iu);

    expect(bg).not.toBeNull();
    expect(token('--ud-floor').toLowerCase()).toBe((bg as RegExpMatchArray)[1].toLowerCase());
  });

  /* ── 대비 ────────────────────────────────────────────────────── */

  it('keeps every small-text token AA on every text-bearing surface', () => {
    /* 규격: 작은 글자는 **가장 밝은 글자용 면**까지 4.5:1 이상.
       가장 어두운 면(--ud-floor)을 기준으로 재면 실제 사용처보다 값이 후하게 나와
       카드 안의 작은 글자가 조용히 AA 아래로 내려간다.
       기존 시트가 실제로 어기던 조합을 여기서 막는다
       (#9c7a55 on #241414 = 4.496:1, #a07d58 on #2c1e1b = 4.26:1,
        --rw-crimson #e04a3c on #241414 = 4.40:1). */
    const surfaces = ['--ud-floor', '--ud-surface-1', '--ud-surface-2', '--ud-surface-3', '--ud-surface-4'];

    for (const name of [
      '--ud-cream',
      '--ud-cream-dim',
      '--ud-cream-mute',
      '--ud-gold-text',
      '--ud-gold-text-hi',
      '--ud-crimson-text',
      '--ud-safe',
      '--ud-slate',
      '--ud-terra'
    ]) {
      for (const surface of surfaces) {
        const ratio = contrast(token(name), token(surface));
        expect(ratio, `${name} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps each element glyph AA on its own recessed well', () => {
    for (const element of ['wood', 'fire', 'earth', 'metal', 'water']) {
      const ratio = contrast(token(`--ud-el-${element}`), token(`--ud-well-${element}`));
      expect(ratio, `${element} glyph on its well is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5
      );
    }
  });

  it('keeps the wells brighter than the card so they read as recesses, not cards', () => {
    for (const element of ['wood', 'fire', 'earth', 'metal', 'water']) {
      expect(luminance(token(`--ud-well-${element}`))).toBeGreaterThan(
        luminance(token('--ud-surface-2'))
      );
    }
  });

  it('keeps paper and bubble ink AA on their own paper', () => {
    for (const [ink, paper] of [
      ['--ud-paper-ink', '--ud-paper'],
      ['--ud-paper-ink', '--ud-paper-hi'],
      ['--ud-paper-ink-dim', '--ud-paper'],
      ['--ud-crimson-paper', '--ud-paper'],
      ['--ud-bubble-ink', '--ud-bubble'],
      ['--ud-bubble-ink', '--ud-bubble-deep']
    ] as const) {
      const ratio = contrast(token(ink), token(paper));
      expect(ratio, `${ink} on ${paper} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives paper its own focus ring, because gold on paper is 1.6:1', () => {
    /* WCAG 2.4.11 은 포커스 표시가 인접색 대비 3:1 이상이기를 요구한다.
       종이 위 금색 링은 1.60:1 이라 못 맞춘다 — 기존 시트가 알고도 부분적으로만 고친 자리다. */
    expect(contrast(token('--ud-focus-dark'), token('--ud-surface-3'))).toBeGreaterThanOrEqual(3);
    expect(contrast(token('--ud-focus-paper'), token('--ud-paper'))).toBeGreaterThanOrEqual(3);
    expect(contrast(token('--ud-focus-paper'), token('--ud-paper-hi'))).toBeGreaterThanOrEqual(3);
  });

  it('marks the decoration-only golds as decoration-only', () => {
    /* --ud-metal-* 램프와 --ud-crimson 은 선·면·글로우 전용이다.
       글자로 쓰면 AA 아래로 내려가므로 주석이 그 사실을 적고 있어야 한다. */
    const css = sheet();
    expect(css).toContain('장식·테두리 전용');
    expect(contrast(token('--ud-crimson'), token('--ud-surface-3'))).toBeLessThan(4.5);
    expect(css).toMatch(/--ud-crimson 은 \*\*면·선·글로우 전용\*\*/u);
  });

  /* ── 서체 ────────────────────────────────────────────────────── */

  it('only names webfont families that index.html actually loads', () => {
    /* 'Noto Serif KR' 은 src 전체에서 37회 참조되는데 로드되지 않는다(죽은 폴백).
       'Pretendard Variable' / 'SUIT Variable' 도 @font-face 가 없다.
       스택이 거짓이면 기기마다 서체가 달라진다. */
    const html = read('../../../index.html');
    const loaded = Array.from(html.matchAll(/family=([A-Za-z+]+)/gu), (m) =>
      m[1].replace(/\+/g, ' ')
    );

    expect(loaded).toContain('Nanum Myeongjo');
    expect(loaded).toContain('Noto Sans KR');

    const stacks = stripComments(sheet()).match(/--ud-(serif|sans|num|hanja):[^;]+;/gu) ?? [];
    expect(stacks.length).toBe(4);

    for (const stack of stacks) {
      for (const dead of ['Noto Serif KR', 'Pretendard', 'SUIT']) {
        expect(stack, `${stack.trim()} names ${dead}, which index.html does not load`).not.toContain(
          dead
        );
      }
    }
  });

  it('spaces the type scale far enough apart to be seen as steps', () => {
    /* 기존 리포트는 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13px 로 5px 안에 10단계다.
       독자는 그것을 한 가지 크기로 지각한다. 인접 단은 15% 이상 벌린다. */
    const sizes = [50, 100, 200, 300, 400, 500, 600, 700, 800].map((step) => {
      const value = token(`--ud-fs-${step}`);
      expect(value).toMatch(/^\d+px$/u);
      return Number.parseInt(value, 10);
    });

    for (let at = 1; at < sizes.length; at += 1) {
      expect(
        sizes[at] / sizes[at - 1],
        `${sizes[at - 1]}px → ${sizes[at]}px is not a visible step`
      ).toBeGreaterThanOrEqual(1.15);
    }

    /* 어두운 지면에서 본문 하한은 18px 다. 11.5px 산문으로 돌아가지 않는다. */
    expect(sizes[3]).toBeGreaterThanOrEqual(18);
  });

  it('never offers a weight the loaded families do not have', () => {
    /* Nanum Myeongjo 는 400/700/800, Noto Sans KR 은 400/500/700/800 이다.
       600 은 둘 다 없어서 브라우저가 합성하거나 700 으로 스냅한다 — 그 결과
       의도한 3단 위계가 실질 2단이 된다. */
    const weights = ['--ud-w-body', '--ud-w-medium', '--ud-w-bold', '--ud-w-display'].map((name) =>
      Number.parseInt(token(name), 10)
    );

    expect(weights).toEqual([400, 500, 700, 800]);
    expect(stripComments(sheet())).not.toMatch(/font-weight:\s*600/u);
  });

  /* ── 여백 ────────────────────────────────────────────────────── */

  it('builds the spacing scale on a 4px base with no hand-picked values', () => {
    const scale = [1, 2, 3, 4, 5, 6, 7, 8].map((step) =>
      Number.parseInt(token(`--ud-s${step}`), 10)
    );

    expect(scale).toEqual([4, 8, 12, 16, 24, 32, 48, 72]);
    for (const value of scale) expect(value % 4).toBe(0);

    /* 카드 내부 상하 패딩을 12~14px 에서 32px 로 올리는 것이 단일 최대 레버다.
       리듬 별칭은 전부 위 스케일 위에서만 만든다. */
    for (const alias of [
      '--ud-gap-tight',
      '--ud-gap',
      '--ud-gap-loose',
      '--ud-card-pad',
      '--ud-card-pad-inline',
      '--ud-cut-gap',
      '--ud-chapter-gap'
    ]) {
      expect(scale, `${alias} is not on the 4px scale`).toContain(
        Number.parseInt(token(alias), 10)
      );
    }

    expect(Number.parseInt(token('--ud-card-pad'), 10)).toBeGreaterThanOrEqual(32);
    /* 320px 하한. 리포트 계약이 잠근 --rr-gutter 와 같은 값을 쓴다. */
    expect(token('--ud-gutter')).toBe('16px');
  });

  /* ── 모션 ────────────────────────────────────────────────────── */

  it('animates nothing that moves layout or forces a re-raster', () => {
    const css = stripComments(sheet());

    /* transition 속성 목록과 @keyframes 안에서 금지 속성을 찾는다. */
    const banned = /(width|height|margin|padding|top|left|right|bottom|font-size|letter-spacing|filter|box-shadow)/u;

    for (const declaration of css.match(/transition:[^;]+;/gu) ?? []) {
      const properties = declaration
        .replace(/transition:\s*/u, '')
        .replace(/;$/u, '')
        .split(',')
        .map((part) => part.trim().split(/\s+/u)[0]);

      for (const property of properties) {
        if (property === 'none') continue;
        expect(
          banned.test(property),
          `transition animates ${property}, which moves layout: ${declaration.trim()}`
        ).toBe(false);
        expect(
          ['opacity', 'transform', 'stroke-dashoffset', 'border-bottom-color'],
          `transition animates ${property}, which is outside the allowed set`
        ).toContain(property);
      }
    }

    for (const frames of css.match(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gu) ?? []) {
      const properties = Array.from(frames.matchAll(/([a-z-]+)\s*:/gu), (match) => match[1]).filter(
        (property) => property !== 'transform' && property !== 'opacity'
      );
      expect(properties, `keyframes animate ${properties.join(', ')}`).toEqual([]);
    }
  });

  it('declares the reveal patterns with the final state as the default', () => {
    /* 방향이 중요하다. `opacity: 0` 을 기본값으로 두면 IntersectionObserver 가
       실패한 경로나 JS 가 죽은 경로에서 콘텐츠가 숨겨진 채 남는다.
       초기 상태는 `[data-reveal]:not(.is-visible)` 안에서만 적용되어야 한다. */
    const css = stripComments(sheet());

    for (const pattern of ['ud-rise', 'ud-settle', 'ud-tick', 'ud-veil', 'ud-fill', 'ud-draw']) {
      expect(css, `${pattern} has no gated initial state`).toMatch(
        new RegExp(`\\[data-reveal\\]:not\\(\\.is-visible\\)[^{]*\\.${pattern}`, 'u')
      );
    }

    /* ★ 숨김은 `useRevealOnScroll` 이 무장했을 때만 성립해야 한다.
       `[data-reveal]` 만으로 숨기면 훅이 마운트 시점에 관찰하지 못한 노드
       (게이트 전환으로 나중에 마운트되는 컷)가 영구히 투명해진다. */
    const hidingSelectors = css
      .split('}')
      .filter((rule) => rule.includes(':not(.is-visible)'))
      .flatMap((rule) => rule.split('{')[0].split(','))
      .map((selector) => selector.trim())
      .filter((selector) => selector.includes(':not(.is-visible)'));

    expect(hidingSelectors.length, 'no reveal initial-state rules found').toBeGreaterThan(10);

    const unarmed = hidingSelectors.filter(
      (selector) => !selector.includes('[data-reveal-armed]')
    );
    expect(unarmed, `hiding rules not gated on the armed flag: ${unarmed.join(' | ')}`).toEqual([]);

    /* 기본 선언에 opacity:0 이 남아 있으면 위 보장이 깨진다. */
    const ungated = css
      .split('}')
      .filter((rule) => /opacity:\s*0\s*;/u.test(rule))
      .filter((rule) => !rule.includes(':not(.is-visible)'))
      .filter((rule) => !rule.includes('@keyframes') && !rule.includes('%'))
      .map((rule) => rule.split('{')[0].trim());

    expect(ungated, `ungated opacity:0 rules: ${ungated.join(' | ')}`).toEqual([]);
  });

  it('neutralises every animation it declares under reduced motion', () => {
    const css = stripComments(sheet());
    const at = css.indexOf('@media (prefers-reduced-motion');
    expect(at).toBeGreaterThan(-1);

    const guard = css.slice(at);
    const outside = css.slice(0, at);

    /* duration 만 0 으로 만드는 방식은 쓰지 않는다 — 최종 상태가 보장되지 않는다. */
    expect(guard).not.toMatch(/animation-duration:\s*0\.001ms/u);

    /* 선언한 모든 패턴 클래스가 감속 블록에 등장해야 한다. */
    for (const pattern of [
      'ud-rise',
      'ud-settle',
      'ud-veil',
      'ud-ink',
      'ud-draw',
      'ud-fill',
      'ud-tick',
      'ud-bloom-in',
      'ud-step',
      'ud-pressable',
      'ud-selectable',
      'ud-float',
      'ud-spark',
      'ud-arc-progress',
      'ud-scorerow-bar'
    ]) {
      expect(outside, `${pattern} is not declared at all`).toContain(pattern);
      expect(guard, `${pattern} is not neutralised under reduced motion`).toContain(pattern);
    }

    /* 호 게이지는 값을 dashoffset 이 나른다. 0 으로 밀면 만점으로 보인다. */
    const arc = guard.slice(guard.indexOf('.ud-arc-progress'));
    expect(arc.slice(0, 200)).toContain('var(--ud-arc-rest');
  });

  /* ── 셸 계약 ─────────────────────────────────────────────────── */

  it('declares only custom properties on the shell container itself', () => {
    /* shellStyleContract.test.ts 가 width / max-width / background / box-shadow 를
       금지한다. 면을 칠할 때는 자손 선택자로 내려간다. */
    const css = stripComments(sheet());
    const rules = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/gu));

    for (const [, selector, body] of rules) {
      const subject = selector.trim().split(/\s+|>|\+|~/u).filter(Boolean).pop() ?? '';
      if (!subject.includes('app-container')) continue;

      const declarations = body
        .split(';')
        .map((part) => part.split(':')[0].trim())
        .filter(Boolean);

      for (const property of declarations) {
        expect(
          property.startsWith('--'),
          `${selector.trim()} declares ${property} on the shell container`
        ).toBe(true);
      }
    }
  });

  it('scopes every rule under the reunion shell container', () => {
    const css = stripComments(sheet());
    const selectors = Array.from(css.matchAll(/([^{}]+)\{[^{}]*\}/gu), (match) => match[1])
      .flatMap((group) => group.split(','))
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !part.startsWith('@') && !part.endsWith('%') && part !== 'from' && part !== 'to');

    const stray = selectors.filter((selector) => !selector.startsWith('.reunion-app-container'));
    expect(stray, `unscoped selectors: ${stray.join(' | ')}`).toEqual([]);
  });

  it('adds no new raw safe-area inset, because that budget is a ratchet', () => {
    expect(stripComments(sheet())).not.toMatch(/env\(\s*safe-area-inset/u);
  });

  it('keeps !important inside the reduced-motion guard only', () => {
    const css = stripComments(sheet());
    const at = css.indexOf('@media (prefers-reduced-motion');
    expect(css.slice(0, at)).not.toContain('!important');
  });

  /* ── 컴포넌트 계약 ───────────────────────────────────────────── */

  it('exports the ornament library the three screens agreed on', () => {
    const source = ornaments();

    for (const name of [
      'UdOrnamentDefs',
      'UdFret',
      'UdRosette',
      'UdSpandrel',
      'UdCorners',
      'UdFrameBox',
      'UdPlaque',
      'UdCartouche',
      'UdGlyph',
      'UdMedallion',
      'UdChapterRule',
      'UdFretDivider',
      'UdBreathRule',
      'UdThread',
      'UdBubble',
      'UdQuoteMarks'
    ]) {
      expect(source, `${name} is not exported from reunionOrnaments`).toMatch(
        new RegExp(`export (function|const) ${name}\\b`, 'u')
      );
    }
  });

  it('keeps every ornament decorative and out of the accessibility tree', () => {
    const source = ornaments();
    const svgTags = source.match(/<svg[\s\S]*?>/gu) ?? [];

    expect(svgTags.length).toBeGreaterThan(6);
    for (const tag of svgTags) {
      expect(tag, `an ornament <svg> is not hidden from assistive tech: ${tag}`).toContain(
        'decorative'
      );
    }
    /* 장식이 색을 직접 정하면 세 화면이 같은 문양을 다른 색으로 쓰게 된다. */
    expect(source).not.toMatch(/(stroke|fill)="#[0-9a-f]{3,6}"/iu);
  });

  it('keeps the shared SVG defs a singleton so ids cannot collide', () => {
    /* 참고 페이지는 filter0_i_beige 를 6번, arc-gradient 를 2번 중복 선언한다.
       지금 동작하는 것은 우연이다. id 는 UdOrnamentDefs 한 곳에만 있어야 한다. */
    const source = ornaments();
    const ids = Array.from(source.matchAll(/id="([^"]+)"/gu), (match) => match[1]);

    expect(new Set(ids).size, `duplicate SVG ids: ${ids.join(', ')}`).toBe(ids.length);

    const defs = source.slice(source.indexOf('export function UdOrnamentDefs'));
    for (const id of ids) {
      expect(defs, `${id} is declared outside UdOrnamentDefs`).toContain(`id="${id}"`);
    }
  });

  it('extends the shared meters instead of forking a second set', () => {
    const source = meters();

    /* 기존 네 프리미티브는 그대로 남아 있어야 한다(reunionReport.contract.test.ts 가 잠근다). */
    for (const name of [
      'ReunionMeterGauge',
      'ReunionMeterBand',
      'ReunionMeterTimeline',
      'ReunionMeterTally',
      'ReunionMeterArc',
      'ReunionMeterVessel',
      'ReunionMeterScoreRow',
      'ReunionMeterHeadline',
      'ReunionMeterPillars',
      'useReunionCountUp'
    ]) {
      expect(source, `${name} is not exported from reunionMeters`).toContain(
        `export function ${name}`
      );
    }

    /* 화면별 스킨은 ns 로만 갈린다. 두 번째 파일을 만들면 문법이 갈라진다. */
    expect(source).toContain('ReunionMeterNamespace');
  });

  it('cannot draw a number the engine did not calculate', () => {
    /* 상세페이지의 게이지·타임라인은 비어 있어야 하고 '리포트에서는 이렇게
       보여드립니다' 표시가 함께 있어야 한다. CH00 보류도 같은 자리를 쓴다.
       그 규격을 마크업 층에서 강제하는 것이 ReunionMeterReading 이다. */
    const source = meters();

    expect(source).toContain("{ kind: 'value'; value: number; ariaLabel: string }");
    expect(source).toContain("{ kind: 'sample'; note: string }");
    expect(source).toContain("{ kind: 'hold'; note: string }");

    /* 값이 아닌 상태에서 숫자를 그리는 경로가 없어야 한다: 숫자를 그리는 JSX 는
       전부 `reading.kind === 'value'` 가드 안에 있다. */
    const premium = source.slice(source.indexOf('export type ReunionMeterReading'));
    const numerals = premium.match(/\{Math\.round\([^)]*\)\}/gu) ?? [];
    expect(numerals.length).toBeGreaterThan(2);

    for (const numeral of numerals) {
      const before = premium.slice(Math.max(0, premium.indexOf(numeral) - 400), premium.indexOf(numeral));
      expect(before, `${numeral} is rendered without a value guard`).toContain(
        "reading.kind === 'value'"
      );
    }
  });

  it('respects reduced motion inside the count-up, the one JS animation', () => {
    const source = meters();
    const hook = source.slice(source.indexOf('export function useReunionCountUp'));

    expect(hook).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(hook).toContain('requestAnimationFrame');
    expect(hook).toContain('cancelAnimationFrame');
  });

  /**
   * 리빌 훅은 이 시트의 숨김 블록을 켜는 유일한 스위치다.
   * 규격: 숨김은 '관찰이 살아 있다' 의 결과여야 하고, 마운트 뒤에 들어온
   * 리빌 루트도 반드시 관찰 대상이 되어야 한다. 후자가 깨졌을 때 실제로
   * 유료 리포트 본문이 CH00 게이트 전환 뒤 영구히 투명해졌다.
   *
   * 이 저장소의 vitest 는 environment: 'node' 이고 include 가 `*.test.ts` 라
   * 컴포넌트를 렌더해 DOM 을 단언할 수 없다. 렌더 테스트를 도입하려면
   * jsdom + testing-library 의존과 include 확장이 필요하다 — 그 전까지는
   * 훅 소스의 구조적 불변식을 여기서 잡는다.
   */
  it('arms the reveal hiding block only while observation is actually live', () => {
    const source = read('../../hooks/useRevealOnScroll.ts');

    /* 무장은 첫 페인트 전에 끝나야 한다. useEffect 로 미루면 콘텐츠가
       한 프레임 보였다가 숨는 깜빡임이 된다. */
    expect(source).toContain('useLayoutEffect');
    expect(source).not.toMatch(/\buseEffect\(/u);

    /* 관찰 수단이 하나라도 없으면 무장하지 않는다. */
    expect(source).toContain("'IntersectionObserver' in window");
    expect(source).toContain("'MutationObserver' in window");

    const armAt = source.indexOf("setAttribute('data-reveal-armed'");
    expect(armAt, 'the hook never arms the root').toBeGreaterThan(-1);

    /* 무장은 두 관찰자를 모두 세운 뒤에만 일어난다. */
    const beforeArm = source.slice(0, armAt);
    expect(beforeArm).toContain('new IntersectionObserver');
    expect(beforeArm).toContain('new MutationObserver');
    expect(beforeArm).toMatch(/mutations\.observe\([^)]*\{[^}]*subtree:\s*true/u);

    /* 나중에 마운트되는 리빌 루트를 관찰 대상에 넣는다. */
    expect(source).toContain('addedNodes');

    /* 안전망과 정리는 무장을 반드시 되돌린다 — 되돌리지 않으면 관찰이 죽은
       화면이 숨김 블록을 켠 채로 남는다. */
    expect(
      source.match(/removeAttribute\('data-reveal-armed'\)/gu)?.length ?? 0,
      'the armed flag is not withdrawn on both the failsafe and the cleanup path'
    ).toBeGreaterThanOrEqual(2);
  });
});
