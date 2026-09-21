import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reunionCuts, sampleNotes } from '../../content/reunionWebtoonPanels';

/**
 * 재회운 상세페이지(/detail/love-reunion) 의 계약.
 *
 * 이 화면은 프리미엄 디자인 시스템(reunion-premium.css) 위에 얹혀 있다.
 * 그 시스템의 계약은 reunionPremium.contract.test.ts 가 지킨다. 이 파일은
 * **상세페이지가 그 시스템을 실제로 쓰고 있는지** 와, 시각 개편이 다시 깎아
 * 먹기 쉬운 네 가지를 붙잡는다:
 *
 *   1) 색을 새로 만들지 않는다 — `--rw-*` 는 전부 `--ud-*` 별칭이다.
 *      (개편 전에는 #9c7a55 가 #241414 위에서 4.496:1 로 AA 미달이었다.)
 *   2) 리빌의 **최종 상태가 기본값**이다. `opacity: 0` 을 기본값으로 두면
 *      IntersectionObserver 가 실패한 경로에서 20컷이 숨은 채 남는다.
 *   3) 사실 정합성 — 게이지·띠·명식은 비어 있고, 예시 화면에는 예외 없이
 *      "리포트에서는 이렇게 보여드립니다" 문구가 붙는다.
 *   4) 셸과 계측 프리미티브의 경계를 다시 침범하지 않는다.
 */

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const sheet = () => read('../../styles/reunion-webtoon.css');
const landing = () => read('./ReunionLanding.tsx');
const premium = () => read('../../styles/reunion-premium.css');

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

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

/** 값을 테스트에 베껴 쓰지 않고 시스템 시트에서 읽는다. */
const udToken = (name: string): string => {
  const match = stripComments(premium()).match(new RegExp(`${name}:\\s*([^;]+);`, 'u'));
  expect(match, `${name} is not declared by reunion-premium.css`).not.toBeNull();
  return (match as RegExpMatchArray)[1].trim();
};

describe('reunion detail page (webtoon landing)', () => {
  /* ── 1. 색: 새 값을 만들지 않는다 ──────────────────────────────── */

  it('maps every --rw-* colour token onto a design-system token', () => {
    const root = stripComments(sheet()).match(
      /\.reunion-page\.reunion-webtoon\s*\{([\s\S]*?)\n\}/u
    );
    expect(root, 'the token root rule is gone').not.toBeNull();

    /* 문서화한 지역값 두 개만 예외다. --rw-floor 는 색이 아니라 시스템 토큰을
       가리키는 포인터이고, --rw-bubble-fs 는 아트 폭과 함께 커져야 하는 크기다. */
    const documentedLocals = new Set(['--rw-floor', '--rw-bubble-fs']);

    const offenders = Array.from(
      (root as RegExpMatchArray)[1].matchAll(/(--rw-[\w-]+):\s*([^;]+);/gu)
    )
      .filter(([, name]) => !documentedLocals.has(name))
      .filter(([, , value]) => !/^var\(--ud-[\w-]+\)$/u.test(value.trim()))
      .map(([, name, value]) => `${name}: ${value.trim()}`);

    expect(offenders, `tokens that invent a value: ${offenders.join(' | ')}`).toEqual([]);
  });

  it('keeps the two AA fixes the redesign was required to make', () => {
    const css = stripComments(sheet());

    /* 개편 전: --rw-gold-text #9c7a55 on #241414 = 4.496:1 (미달).
       --rw-crimson #e04a3c 을 글자에 쓰던 자리도 4.40:1 이었다. */
    expect(css).toMatch(/--rw-gold-text:\s*var\(--ud-gold-text\)/u);
    /* 근백색 말풍선(#fbf4ea)이 근검정 지면에 뜨는 것이 가장 값싸 보이는 신호였다. */
    expect(css).toMatch(/--rw-bubble:\s*var\(--ud-bubble\)/u);
    /* 강조는 면·선 전용 진홍이 아니라 글자용 진홍을 쓴다. */
    expect(css).toMatch(/\.rw-hot\s*\{[^}]*color:\s*var\(--ud-crimson-text\)/u);

    const surface3 = udToken('--ud-surface-3');
    for (const name of ['--ud-gold-text', '--ud-cream-mute', '--ud-crimson-text', '--ud-slate']) {
      expect(
        contrast(udToken(name), surface3),
        `${name} is below AA on the brightest text surface`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('never uses the decoration-only metal ramp as a text colour', () => {
    /* 시스템 규격: --ud-metal-0~3 은 장식·테두리 전용이다. 빛나는 금속을 글자로
       쓰면 번짐이 가독을 깎는다. 글자용 금색은 --ud-gold-text / -hi 두 개뿐이다. */
    const offenders = stripComments(sheet())
      .split('}')
      .filter((rule) => /(^|[;{\s])color:\s*var\(--ud-metal-[0-3]\)/u.test(rule))
      /* SVG 장식은 currentColor 를 쓰므로 컨테이너의 color 가 곧 선 색이다. */
      .filter(
        (rule) =>
          !/(rw-stage-corners|rw-plate-corners|rw-plate-lantern|rw-chapter-moon|rw-compare-glyph|rw-cta-arrow|ud-corners)/u.test(
            rule
          )
      )
      .map((rule) => rule.split('{')[0].trim());

    expect(offenders, `metal ramp used as text: ${offenders.join(' | ')}`).toEqual([]);
  });

  /* ── 2. 모션 ───────────────────────────────────────────────────── */

  it('leaves every motion pattern to the design system and only adds delays', () => {
    const css = stripComments(sheet());

    /* 이 시트는 패턴을 새로 만들지 않는다. @keyframes 가 하나도 없어야 한다. */
    expect(css.match(/@keyframes/gu) ?? [], 'the screen sheet declares its own keyframes').toEqual(
      []
    );

    for (const declaration of css.match(/transition:[^;]+;/gu) ?? []) {
      const properties = declaration
        .replace(/transition:\s*/u, '')
        .replace(/;$/u, '')
        .split(',')
        .map((part) => part.trim().split(/\s+/u)[0]);

      for (const property of properties) {
        if (property === 'none') continue;
        expect(
          ['opacity', 'transform', 'stroke-dashoffset'],
          `transition animates ${property}: ${declaration.trim()}`
        ).toContain(property);
      }
    }
  });

  it('declares the reveal with the final state as the default', () => {
    /* 방향이 뒤집혀 있어야 한다. 이전 판은 `.rw-cut { opacity: 0 }` 이어서
       IntersectionObserver 가 실패하면 본문 20컷이 전부 숨은 채 남았다. */
    const css = stripComments(sheet());

    const ungated = css
      .split('}')
      .filter((rule) => /opacity:\s*0\s*;/u.test(rule))
      .filter((rule) => !rule.includes(':not(.is-visible)'))
      .map((rule) => rule.split('{')[0].trim());

    expect(ungated, `ungated opacity:0 rules: ${ungated.join(' | ')}`).toEqual([]);

    /* 이 시트가 직접 거는 두 전환도 같은 방향이어야 한다. */
    for (const gated of ['.rw-branch-row::before', '.rw-band-tick.is-marked']) {
      expect(css, `${gated} has no gated initial state`).toContain(
        `[data-reveal]:not(.is-visible) ${gated}`
      );
    }
  });

  it('neutralises every transition it declares under reduced motion', () => {
    const css = stripComments(sheet());
    const at = css.indexOf('@media (prefers-reduced-motion');
    expect(at, 'no reduced-motion guard').toBeGreaterThan(-1);

    const guard = css.slice(at);

    /* 일괄 `animation-duration: 0.001ms` 무력화는 쓰지 않는다 — 그 방식은
       초기 상태를 최종 상태로 못 박지 못한다. */
    expect(guard).not.toMatch(/animation-duration:\s*0\.001ms/u);

    for (const owned of [
      '.rw-branch-row::before',
      '.rw-band-tick.is-marked',
      '.rw-dock',
      '.rw-bubble .ud-settle',
      '.rw-plate-title-veil.ud-veil > *'
    ]) {
      expect(guard, `${owned} keeps moving under reduced motion`).toContain(owned);
    }
  });

  it('uses the design-system patterns rather than hand-rolled animation', () => {
    const jsx = landing();

    for (const pattern of [
      'ud-rise',
      'ud-settle',
      'ud-veil',
      'ud-ink',
      'ud-tick',
      'ud-bloom-in',
      'ud-float',
      'ud-spark',
      'ud-pressable'
    ]) {
      expect(jsx, `the page never uses ${pattern}`).toContain(pattern);
    }

    /* 선 그리기는 장식 컴포넌트의 `drawable` 이 .ud-draw 를 붙인다. */
    expect(jsx).toMatch(/<UdThread[^>]*drawable/u);
  });

  it('keeps .ud-ink to short display strings, as the system requires', () => {
    /* 16자를 넘는 문장에 글자 단위 등장을 걸면 읽는 속도를 방해한다. */
    const jsx = landing();
    const max = jsx.match(/const INK_MAX_GRAPHEMES = (\d+);/u);

    expect(max, 'the ink-length guard is gone').not.toBeNull();
    expect(Number((max as RegExpMatchArray)[1])).toBeLessThanOrEqual(16);

    /* 줄바꿈이나 [강조] 가 있는 문장은 구조가 있으므로 대상이 아니다. */
    expect(jsx).toMatch(/function canInk[\s\S]{0,220}includes\('\\n'\)/u);
    expect(jsx).toMatch(/function canInk[\s\S]{0,220}includes\('\['\)/u);

    /* 글자를 span 으로 쪼갠 층은 접근성 트리에서 빠지고 문장이 한 번 읽힌다. */
    const ink = jsx.slice(jsx.indexOf('function InkText'), jsx.indexOf('function InkText') + 700);
    expect(ink).toContain('reunion-visually-hidden');
    expect(ink).toContain('aria-hidden="true"');
  });

  /* ── 3. 사실 정합성 ────────────────────────────────────────────── */

  it('puts the "this is only the shape" notice on every example panel', () => {
    /* 배지 하나에만 실려 있으면 스크롤에서 놓친다. 규격 문구가 함께 와야 한다. */
    const badged = reunionCuts.filter((cut) => cut.badge);
    expect(badged.length, 'no example panels left').toBeGreaterThan(0);

    for (const cut of badged) {
      expect(cut.sampleNote, `panel ${cut.n} has a badge but no sample notice`).toBeTruthy();
      expect(cut.sampleNote, `panel ${cut.n} does not say where the values come from`).toContain(
        '리포트에서는 이렇게 보여드립니다'
      );
    }

    for (const note of Object.values(sampleNotes)) {
      /* 운월당의 목소리는 언제나 존댓말이다. */
      expect(note.trim().endsWith('다.'), `sample notice is not 존댓말: ${note}`).toBe(true);
    }

    expect(landing()).toContain('ud-sample-note');
  });

  it('keeps the gauge, band and myeongsik table empty of invented numbers', () => {
    const jsx = landing();

    /* 게이지 칸은 state 없이 렌더된다(빈 칸). 채움 요소를 만들지 않는다. */
    const gauge = jsx.slice(jsx.indexOf('<ReunionMeterGauge'), jsx.indexOf('<ReunionMeterGauge') + 200);
    expect(gauge).toMatch(/cells=\{\[\{ id: 'c1' \}, \{ id: 'c2' \}, \{ id: 'c3' \}\]\}/u);
    expect(gauge, 'the detail gauge must not carry an aria-label it cannot justify').not.toContain(
      'ariaLabel'
    );

    /* 띠 눈금은 장식이고 라벨은 마스킹이다. */
    const band = jsx.slice(jsx.indexOf('<ReunionMeterBand'), jsx.indexOf('<ReunionMeterBand') + 480);
    expect(band).toContain('ticksHidden');
    expect(band).toContain('labelHidden');

    /* 채움 패턴(.ud-fill)은 이 화면에 없어야 한다 — 값이 없으니 수위도 없다. */
    expect(jsx, 'the detail page must not draw a fill level').not.toContain('ud-fill');
    expect(stripComments(sheet()), 'the sheet must not skin a gauge fill').not.toMatch(
      /rw-gauge-(fill|level)/u
    );

    /* 오행 개수와 일간은 전부 '○' 마스킹이고 대체 텍스트가 붙는다. */
    expect(jsx).toContain('다섯 칸의 개수는 모두 예시 값');
  });

  /* ── 4. 경계 ───────────────────────────────────────────────────── */

  it('shares the meter primitives instead of re-writing their markup', () => {
    const jsx = landing();

    for (const name of [
      'ReunionMeterGauge',
      'ReunionMeterBand',
      'ReunionMeterTimeline',
      'ReunionMeterTally'
    ]) {
      expect(jsx, `landing does not use ${name}`).toContain(name);
    }

    for (const owned of [
      'className="rw-gauge-track"',
      'className="rw-band-ticks"',
      'className="rw-tally-num"',
      'className="rw-timeline-dot"'
    ]) {
      expect(jsx, `landing hand-writes ${owned}`).not.toContain(owned);
    }
  });

  it('keeps the class names the shell contract reaches for', () => {
    /* shellStyleContract.test.ts 가 .rw-topbar 를 통합 상단바 목록에서 찾고,
       routeShellAppContract.test.ts 는 이 파일에서 rw-topbar 를 찾는다.
       routeShellPolicy.test.ts 는 .rw-footer 를 contentinfo 로 센다. */
    for (const name of ['rw-topbar', 'rw-wordmark', 'rw-footer', 'rw-main']) {
      expect(landing(), `${name} is gone`).toContain(name);
    }
  });

  it('adds no raw safe-area inset, because that budget is a ratchet', () => {
    /* 세이프 영역은 셸 토큰(--app-safe-* / --app-tabbar-h)으로만 읽는다. */
    expect(stripComments(sheet()).match(/env\(\s*safe-area-inset/gu) ?? []).toEqual([]);
    expect(stripComments(sheet())).toContain('var(--app-safe-bottom');
  });

  it('binds its fixed furniture to the shell frame, not the viewport', () => {
    /* position: fixed 는 뷰포트 기준으로 풀리므로 1280px 창 안의 프레임에서는
       레일 위로 새어 나간다. 세 조각 모두 셸 폭으로 묶여 있어야 한다. */
    const css = stripComments(sheet());

    for (const selector of ['.rw-frame', '.rw-dock']) {
      const at = css.indexOf(`${selector} {`);
      expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
      expect(css.slice(at, css.indexOf('}', at)), `${selector} escapes the frame`).toContain(
        'var(--app-shell-width-px'
      );
    }

    /* 붉은 실은 폭이 40px 고정이라 프레임 왼쪽 가장자리(레일 거터)에 붙인다.
       예전에는 calc(50% - col/2) 로 잡았는데, fixed 의 50% 는 뷰포트의 절반이라
       1440px 창에서 실이 프레임(513~913) 바깥 449px 에 떠 있었다. */
    const thread = css.slice(css.indexOf('.rw-thread {'), css.indexOf('}', css.indexOf('.rw-thread {')));
    expect(thread).toContain('var(--app-rail-gutter');
    expect(thread).not.toContain('50%');
  });

  it('keeps the audited art-band fade geometry', () => {
    /* 위아래 17% 를 지면색으로 녹이는 이중 페이드 + 라디얼은 감사에서 확인된
       값이다. 비율을 바꾸면 컷이 서로 이어 보이지 않는다. */
    const css = stripComments(sheet());
    const at = css.indexOf('.rw-fig-fade {');

    expect(at).toBeGreaterThan(-1);

    const rule = css.slice(at, css.indexOf('}', at));
    expect(rule).toContain('linear-gradient(180deg, var(--rw-floor) 0%, transparent 17%)');
    expect(rule).toContain('linear-gradient(0deg, var(--rw-floor) 0%, transparent 17%)');
    expect(rule).toContain('radial-gradient(120% 90% at 50% 50%, transparent 46%');
  });

  it('renders the shared ornament defs exactly once per page', () => {
    /* `filter: url(#ud-deckle)` 과 네 그라디언트의 id 는 문서 단위로 하나여야 한다.
       카드마다 defs 를 복제하면 중복 id 가 된다. */
    const jsx = landing();
    expect(jsx.match(/<UdOrnamentDefs\s*\/>/gu) ?? []).toHaveLength(1);

    /* 질감과 비네트도 페이지 루트에 한 번만 깐다(컷마다 붙이면 비용이 20배다). */
    expect(jsx.match(/ud-grain/gu) ?? []).toHaveLength(1);
    expect(jsx.match(/ud-vignette/gu) ?? []).toHaveLength(1);
  });

  it('keeps the 20-cut structure and the art replacement seam', () => {
    expect(reunionCuts).toHaveLength(20);
    expect(reunionCuts.filter((cut) => cut.kind === 'cover')).toHaveLength(1);

    /* 아트 교체 지점은 reunionPanelAssets.ts 하나뿐이다. 랜딩이 경로를 직접
       적기 시작하면 발주자가 포스터를 넣을 자리가 사라진다. */
    expect(landing(), 'the landing hard-codes an asset path').not.toContain('/assets/reunion/');
    expect(landing()).toContain('reunionPanelArt');
  });

  it('never re-declares the container geometry the shell owns', () => {
    /* shellStyleContract 가 같은 것을 전 제품 시트에 대해 검사한다.
       여기서는 이 화면의 루트가 셸 폭을 다시 주장하지 않는 것만 못 박는다. */
    const css = stripComments(sheet());
    const at = css.indexOf('.reunion-page.reunion-webtoon {');
    const root = css.slice(at, css.indexOf('\n}', at));

    expect(root).not.toMatch(/(^|[;{\s])max-width:/u);
    expect(root).not.toMatch(/(^|[;{\s])width:/u);
  });
});
