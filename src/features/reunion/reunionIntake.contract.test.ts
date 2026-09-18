import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * /form/love-reunion 입력창의 계약.
 *
 * 화면이 예뻐졌는지는 테스트가 못 잰다. 대신 예쁘게 만드는 과정에서 부서지기
 * 쉬운 것들 — 대비 · 모션 규격 · 셸 계약 · 동의 명시성 · 네이티브 위젯 회귀 —
 * 을 매번 다시 잰다. 색 대비는 하드코딩한 기대값이 아니라 **토큰에서 실제로
 * 계산**한다. 토큰이 바뀌면 이 테스트가 먼저 깨진다.
 */

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const sheet = () => read('../../styles/reunion-intake.css');
const premium = () => read('../../styles/reunion-premium.css');
const view = () => read('./ReunionIntake.tsx');
const legacy = () => read('../../styles/reunion.css');

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/* ── 색 계산 ─────────────────────────────────────────────────────── */

const channel = (value: number) => {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

/** 기반 시트에서 토큰의 리터럴 hex 를 읽는다(별칭은 한 단계 따라간다). */
const token = (name: string): string => {
  const css = stripComments(premium());
  const match = new RegExp(`${name}:\\s*([^;]+);`, 'u').exec(css);
  if (!match) throw new Error(`${name} is not declared in reunion-premium.css`);
  const value = match[1].trim();
  const alias = /^var\((--[a-z0-9-]+)\)$/u.exec(value);
  return alias ? token(alias[1]) : value;
};

describe('reunion intake contract', () => {
  /* ── 1. 셸 계약 ─────────────────────────────────────────────────── */

  it('never makes the shell container the subject of a rule', () => {
    /* shellStyleContract 가 같은 것을 재지만, 그 테스트는 파일 목록에 이 시트가
       등록되어 있을 때만 돈다. 등록이 빠지는 사고를 여기서 한 번 더 막는다. */
    const subjects = Array.from(stripComments(sheet()).matchAll(/([^{}]+)\{/gu), (m) => m[1])
      .flatMap((selector) => selector.split(','))
      .map((part) => part.trim().split(/\s+|>|\+|~/u).filter(Boolean).pop() ?? '')
      .filter((subject) => subject.includes('app-container'));

    expect(subjects).toEqual([]);
  });

  it('is registered in the shell stylesheet contract', () => {
    expect(read('../../app/shell/shellStyleContract.test.ts')).toContain('styles/reunion-intake.css');
  });

  it('never paints html or body and never spends a raw safe-area inset', () => {
    const css = stripComments(sheet());

    expect(css).not.toMatch(/(^|[,}])\s*(html|body)\b/mu);
    expect(css).not.toContain('env(safe-area-inset');
  });

  it('keeps the two class names the shell locked onto this screen', () => {
    // appShell.css hangs the bottom gap and the desktop frame fix on these two.
    expect(view()).toContain('className="reunion-page reunion-intake-page');
    expect(view()).toContain('className="reunion-intake-actions"');
    // routeShellAppContract requires the product bar to be a real <header>.
    expect(view()).toContain('<header className="reunion-intake-header"');
  });

  it('never needs !important to beat the sheets it loads after', () => {
    expect(stripComments(sheet())).not.toContain('!important');
  });

  it('loads the base system sheet before its own', () => {
    const source = view();
    const base = source.indexOf("styles/reunion-premium.css");
    const own = source.indexOf("styles/reunion-intake.css");

    expect(base).toBeGreaterThan(-1);
    expect(own).toBeGreaterThan(base);
  });

  /* ── 2. 대비 — 아트 위에 글자를 얹지 않으므로 실제로 계산된다 ──── */

  it('puts every small-text surface on an opaque token', () => {
    /* 배경이 알파면 아트와 합성되어 대비를 계산할 수 없다. 이 시트가 칠하는
       배경은 전부 불투명 토큰이거나 스크림 · 틴트 · 유리감뿐이다. */
    const allowed = new Set([
      'var(--ud-floor)',
      'var(--ud-surface-1)',
      'var(--ud-surface-2)',
      'var(--ud-surface-3)',
      'var(--ud-paper)',
      'var(--ud-metal-2)',
      'var(--ri-accent-fill)',
      'var(--ud-glass-bg)',
      'currentcolor',
      'none'
    ]);

    /* 1px 괘선은 글자를 담을 수 없으므로 면이 아니다. 높이가 1px 인 규칙만
       면 검사에서 뺀다 — 예외 목록에 색을 더하는 방식은 검사를 무력화한다. */
    const offenders = Array.from(
      stripComments(sheet()).matchAll(/([^{}]+)\{([^{}]*)\}/gu),
      (m) => ({ selector: m[1].trim(), body: m[2] })
    )
      .filter((rule) => !/height:\s*1px/u.test(rule.body))
      .flatMap((rule) =>
        Array.from(rule.body.matchAll(/(?:^|[;{])\s*background:\s*([^;]+);/gu), (m) => ({
          selector: rule.selector,
          value: m[1].trim()
        }))
      )
      .filter((hit) => !allowed.has(hit.value) && !hit.value.includes('gradient'))
      .map((hit) => `${hit.selector} -> ${hit.value}`);

    expect(offenders).toEqual([]);
  });

  it('clears AA for every text token this screen puts on its darkest four surfaces', () => {
    const surfaces = ['--ud-floor', '--ud-surface-1', '--ud-surface-2', '--ud-surface-3'];
    const texts = [
      '--ud-cream',
      '--ud-cream-dim',
      '--ud-cream-mute',
      '--ud-gold-text',
      '--ud-crimson-text',
      '--ud-slate',
      '--ud-safe'
    ];

    for (const surface of surfaces) {
      for (const text of texts) {
        expect(
          contrast(token(text), token(surface)),
          `${text} on ${surface}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the parchment writing surface and its ink above AA', () => {
    expect(contrast(token('--ud-paper-ink'), token('--ud-paper'))).toBeGreaterThanOrEqual(4.5);
    // placeholder ink is dimmer than the value; it still has to be legible.
    expect(contrast(token('--ud-paper-ink-dim'), token('--ud-paper'))).toBeGreaterThanOrEqual(4.5);
  });

  it('swaps the focus ring for the paper one wherever the surface is paper', () => {
    /* 종이 위에서 금색 링은 1.60:1 이라 WCAG 2.4.11 을 넘지 못한다.
       이 시트의 유일한 종이 면(글 쓰는 자리)은 잉크색 링을 쓴다. */
    expect(contrast(token('--ud-focus-dark'), token('--ud-paper'))).toBeLessThan(3);
    expect(contrast(token('--ud-focus-paper'), token('--ud-paper'))).toBeGreaterThanOrEqual(3);
    expect(stripComments(sheet())).toMatch(
      /\.ri-scribe textarea:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ud-focus-paper\)/u
    );
  });

  it('beats the low-contrast focus ring reunion.css still declares', () => {
    // .reunion-page :focus-visible is rgba(177,82,108,.42) — invisible on near-black.
    expect(stripComments(legacy())).toContain('outline: 3px solid rgba(177, 82, 108, 0.42)');
    expect(stripComments(sheet())).toContain(
      '.reunion-page.reunion-intake-page :is(button, input, textarea, a, summary):focus-visible'
    );
  });

  it('paints the page dark instead of trusting a deleted declaration', () => {
    /* `.reunion-page` 가 밝은 크림을 칠하므로 `.reunion-intake-page` 의 배경
       선언을 지우면 입력창이 다시 밝아진다. 과업 문서의 '선언을 지워도 된다'
       는 이 한 줄 때문에 성립하지 않는다. */
    expect(stripComments(legacy())).toContain('background: var(--reunion-cream)');
    expect(stripComments(sheet())).toMatch(
      /\.reunion-intake-page\s*\{[^}]*background:\s*var\(--ud-floor\)/u
    );
  });

  /* ── 3. 모션 규격 ───────────────────────────────────────────────── */

  it('animates nothing but transform and opacity', () => {
    const css = stripComments(sheet());
    const allowed = new Set(['opacity', 'transform', 'border-bottom-color', 'none']);

    const transitioned = Array.from(css.matchAll(/(?:^|[;{])\s*transition:\s*([^;]+);/gu), (m) => m[1])
      .flatMap((list) => list.split(','))
      .map((part) => part.trim().split(/\s+/u)[0])
      .filter(Boolean);

    expect(transitioned.length).toBeGreaterThan(0);
    for (const property of transitioned) {
      expect(allowed.has(property), `transition animates ${property}`).toBe(true);
    }

    const keyframed = Array.from(css.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/gu), (m) => m[1])
      .flatMap((block) => Array.from(block.matchAll(/\n\s{4}([a-z-]+):/gu), (m) => m[1]));

    expect(keyframed.length).toBeGreaterThan(0);
    for (const property of keyframed) {
      expect(allowed.has(property), `@keyframes animates ${property}`).toBe(true);
    }
  });

  it('pins every animation it declares to a final state under reduced motion', () => {
    const css = stripComments(sheet());
    const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

    expect(reduce).not.toBe('');
    // 일괄 `animation-duration: 0.001ms` 무력화는 쓰지 않는다.
    expect(reduce).not.toMatch(/animation-duration:\s*0\.001ms/u);

    for (const name of Array.from(css.matchAll(/@keyframes\s+([a-z0-9-]+)/gu), (m) => m[1])) {
      expect(css).toContain(`animation: ${name}`);
      expect(reduce, `${name} is not switched off for reduced motion`).toContain('animation: none');
    }

    /* 드리프트를 켜는 규칙은 `[data-active='true']` 를 갖고 있어 특이도가 한 단
       높다. 감속 블록이 클래스만으로 쓰여 있으면 조용히 무시되고 아트가 계속
       움직인다(실측으로 한 번 그렇게 됐다). 같은 선택자를 다시 적었는지 잰다. */
    const off = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    const on = /\.ri-stage-shot\[data-active='true'\]\s*\{[^}]*animation:\s*ri-/u.test(
      css.slice(0, css.indexOf('@media (prefers-reduced-motion: reduce)'))
    );

    expect(on, 'the drift is no longer keyed to [data-active]').toBe(true);
    expect(off).toContain(".ri-stage-shot[data-active='true']");
  });

  it('borrows the step, press and select patterns instead of inventing new ones', () => {
    const source = view();

    for (const utility of ['ud-step', 'ud-pressable', 'ud-selectable']) {
      expect(source, `${utility} is unused`).toContain(utility);
    }
    // 기반 시트가 감속 선호에서 그 세 개를 최종 상태로 못 박는다.
    const reduce = stripComments(premium()).slice(
      stripComments(premium()).indexOf('@media (prefers-reduced-motion: reduce)')
    );
    expect(reduce).toContain('.ud-step');
    expect(reduce).toContain('.ud-pressable');
    expect(reduce).toContain('.ud-selectable');
  });

  /* ── 4. 네이티브 위젯 회귀 ──────────────────────────────────────── */

  it('never brings back the OS date or time picker', () => {
    /* 네이티브 피커는 OS 서체와 OS 색으로 그려지므로 이 화면의 서체 위계와
       금속 팔레트를 무시한다. 여덟 자리 숫자 입력으로 대체했다. */
    const source = view();

    expect(source).not.toMatch(/type="date"/u);
    expect(source).not.toMatch(/type="time"/u);
    expect(source).toContain('inputMode="numeric"');
  });

  it('keeps the big fields out of the global 16px clamp, and never below 16px', () => {
    /* `index.css` 는 `@media (max-width: 768px)` 에서 모든 input · textarea 에
       `font-size: 16px !important` 를 박는다. 의도는 iOS 확대 방지(하한)인데
       `!important` 라서 상한으로도 작동한다 — 실측: 자사 `/form/love-reading` 의
       `clamp(30px, 8vw, 40px)` 대형 필드가 휴대폭에서 16px 로 렌더된다.
       이 화면은 `data-type-scale` 로 빠져나오고, 대신 16px 미만을 쓰지 않는다. */
    const global = read('../../index.css');
    const source = view();
    const css = stripComments(sheet());

    expect(global).toContain(':not([data-type-scale])');
    expect(global).toContain('textarea:not([data-type-scale])');

    const fields = (source.match(/<(?:input|textarea)\b/gu) ?? []).length;
    const optedOut = (source.match(/data-type-scale="own"/gu) ?? []).length;

    // 체크박스 두 개(동의 · 없음)는 확대 대상이 아니므로 빠져 있어도 된다.
    expect(optedOut).toBeGreaterThanOrEqual(fields - 1);

    /* 빠져나온 필드의 글자 크기는 전부 16px 이상이어야 한다. 스케일에서
       16px 미만은 --ud-fs-50(11px) / --ud-fs-100(13px) / --ud-fs-200(15px) 이다. */
    for (const rule of ['.ri-line input', '.ri-line[data-kind=\'name\'] input', '.ri-scribe textarea']) {
      const at = css.indexOf(`${rule} {`);
      expect(at, `${rule} has no font-size rule`).toBeGreaterThan(-1);
      const block = css.slice(at, css.indexOf('}', at));
      const size = /font-size:\s*var\((--ud-fs-\d+)\)/u.exec(block);
      expect(size, `${rule} does not set a scale font-size`).not.toBeNull();
      expect(
        ['--ud-fs-50', '--ud-fs-100', '--ud-fs-200'],
        `${rule} would let iOS zoom the page on focus`
      ).not.toContain((size as RegExpExecArray)[1]);
    }
  });

  it('keeps Georgia out of the funnel', () => {
    // Georgia has no Korean glyphs, so Korean fell through to an unloaded face.
    expect(stripComments(sheet())).not.toContain('Georgia');
    expect(stripComments(legacy())).not.toContain('Georgia');
    expect(stripComments(legacy())).toContain('var(--ud-serif)');
  });

  it('routes every font through the system stacks', () => {
    const families = Array.from(
      stripComments(sheet()).matchAll(/(?:^|[;{])\s*font-family:\s*([^;]+);/gu),
      (m) => m[1].trim()
    );

    expect(families.length).toBeGreaterThan(0);
    for (const family of families) {
      expect(family, `${family} is not a system token`).toMatch(/^var\(--ud-(serif|sans|num|hanja)\)$/u);
    }
  });

  /* ── 5. 동의 ────────────────────────────────────────────────────── */

  it('gives the partner-data consent its own step and never pre-checks it', () => {
    const source = view();

    expect(source).toContain('consentToUsePartnerData');
    // 빈 드래프트는 동의가 false 다.
    expect(read('./reunionFlow.ts')).toContain('consentToUsePartnerData: false');
    // 동의 걸음(5)이 준비되었다는 조건은 동의 그 자체다.
    expect(source).toMatch(/case 5:\s*\n\s*return draft\.consentToUsePartnerData;/u);
    // 그 걸음은 상대방의 출생 정보를 묻는 걸음들보다 앞이다.
    expect(source.indexOf("5: {")).toBeLessThan(source.indexOf("7: {"));
  });

  it('spells out what is taken, what is not, and where it is kept', () => {
    const source = view();

    expect(source).toContain('받는 것');
    expect(source).toContain('받지 않는 것');
    expect(source).toContain('두는 곳');
    // 동의 문구는 캡션 크기로 줄이지 않는다 — 본문 크기다.
    expect(stripComments(sheet())).toMatch(
      /\.ri-consent strong\s*\{[^}]*font-size:\s*var\(--ud-fs-300\)/u
    );
  });

  it('cannot pass the funnel with the consent unchecked', () => {
    const validation = read('../../lib/reunion/validation.ts');

    expect(validation).toContain("value.consentToUsePartnerData !== true");
    // 제출 경로가 그 검증을 실제로 부른다.
    expect(view()).toContain('validateReunionContext(reunionContext)');
  });

  /* ── 6. 제목 위계와 장식 ───────────────────────────────────────── */

  it('renders exactly one h1 and hangs the section label on it', () => {
    const source = view();

    expect((source.match(/<h1/gu) ?? []).length).toBe(1);
    expect(source).toContain('id="reunion-step-title"');
    expect(source).toContain('aria-labelledby="reunion-step-title"');
    // 동의 걸음의 목록 제목만 h2 이고, h3 는 쓰지 않는다.
    expect((source.match(/<h2/gu) ?? []).length).toBe(1);
    expect(source).not.toContain('<h3');
  });

  it('hides every decoration from the accessibility tree', () => {
    const source = view();

    // 아트 무대 · 아트 창 · 장 번호 · 걸음 도트 · 선택 표식
    expect(source).toContain('<div className="ri-stage" aria-hidden="true">');
    /* 아트 창은 액자 장식(뇌문 코너)을 품게 되어 자식이 생겼다.
       접근성 트리에서 감춘다는 계약은 그대로다. */
    expect(source).toContain('<div className="ri-window" aria-hidden="true">');
    expect(source).toContain('<span className="ri-rail-num" aria-hidden="true">');
    expect(source).toContain('<span className="ri-rail-dots" aria-hidden="true">');
    // 아트는 장식이므로 alt 는 빈 문자열이다.
    expect(source).toContain('alt=""');
  });

  it('announces the step outside the remounting panel', () => {
    /* `key={step}` 으로 리마운트되는 노드 안의 live region 은 읽히지 않는다.
       진행 안내는 패널 밖에 있어야 한다.

       주석을 먼저 걷어낸다 — 걷어내지 않으면 마크업을 설명하는 주석 안의
       `<section key={step}>` 같은 문자열이 먼저 잡혀 위치 비교가 뒤집힌다. */
    const source = stripComments(view());
    const status = source.indexOf('role="status"');
    const panel = source.indexOf('key={step}');

    expect(status).toBeGreaterThan(-1);
    expect(panel).toBeGreaterThan(-1);
    expect(status).toBeLessThan(panel);
  });

  /* ── 7. 데이터 계약 ────────────────────────────────────────────── */

  it('still collects everything createReunionFormData demands', () => {
    const source = view();

    for (const field of [
      'birthDate',
      'birthTime',
      'isUnknownTime',
      'calendar',
      'isLeapMonth',
      'gender',
      'name',
      'breakupDuration',
      'contactStatus',
      'desiredOutcome',
      'breakupReason',
      'question',
      'notes',
      'lastContactAt'
    ]) {
      expect(source, `${field} has no control`).toContain(field);
    }

    expect(source).toContain('createReunionFormData(draft)');
    expect(source).toContain('writeReunionDraft(draft, ownerId, reunionContext)');
  });

  it('keeps the draft in the contract shape, not in the typing buffer shape', () => {
    /* 화면은 여덟 자리 버퍼를 들고 있지만 드래프트는 항상 ISO 다.
       그 변환이 한 곳(intakeFields.ts)에만 있어야 계약이 안 깨진다. */
    const source = view();

    expect(source).toContain("from './intakeFields'");
    expect(source).toContain('toIsoBirthDate(digits');
    expect(source).toContain('toClockValue(next)');
  });

  it('validates each person only once their whole chapter is filled', () => {
    // 이름이 마지막에 오므로 그 전에는 name 필수 오류가 언제나 걸린다.
    expect(view()).toMatch(/closing: Partial<Record<IntakeStep, PersonKey>> = \{ 4: 'self', 8: 'partner' \}/u);
  });

  /* ── 8. 아트가 실제로 보이는가 ──────────────────────────────────── */

  it('gives the art window a floor the panel cannot take', () => {
    /* 이 화면이 세 화면 중 가장 값싸 보였던 원인이다. 판이 필요한 만큼 먼저
       가져가고 남은 것이 아트였으므로 13걸음 중 7걸음에서 창이 0 이 됐다. */
    const css = stripComments(sheet());

    expect(css, 'the art window has no floor').toMatch(/--ri-art-min:\s*min\(/u);
    expect(css, 'the art row does not claim the floor').toMatch(
      /grid-template-rows:\s*auto auto minmax\(var\(--ri-art-min\)/u
    );
    /* 판의 상한이 그 하한을 실제로 빼고 계산되어야 한다. 빼지 않으면
       두 행의 합이 뷰포트를 넘어 아트가 다시 밀려난다. */
    expect(css, 'the panel does not subtract the art floor').toMatch(
      /max-height:[\s\S]{0,220}?-\s*var\(--ri-art-min\)/u
    );
  });

  it('sizes the art stage so the crop can actually reach the art', () => {
    /* `object-fit: cover` 는 모자라는 축만 잘라낸다. 무대가 뷰포트 높이면
       세로로 긴 아트는 세로가 통째로 들어가므로 object-position 이 듣지 않고,
       화면 위쪽 창에는 언제나 아트의 맨 윗부분(대개 어두운 하늘)만 걸린다.
       무대를 아트 띠 높이로 묶어야 세로가 잘리고 크롭 좌표가 의미를 갖는다. */
    const css = stripComments(sheet());
    const stage = css.slice(css.indexOf('.reunion-intake-page .ri-stage {'));
    const block = stage.slice(0, stage.indexOf('}'));

    expect(block, 'the stage is still viewport-tall').not.toMatch(/height:\s*100svh/u);
    expect(block).toMatch(/height:\s*calc\([^;]*--ri-art-min/u);

    /* 용해 띠는 비율 상한을 함께 가져야 한다. 고정 높이만 쓰면 낮은 창에서
       베일이 창을 다 먹고 맑은 아트가 10px 만 남는다. */
    expect(css).toMatch(/height:\s*min\(var\(--ri-veil-h\),\s*\d+%\)/u);
  });

  /* ── 9. 걸음 전환의 포커스 ──────────────────────────────────────── */

  it('moves focus into the new step when nothing there claimed it', () => {
    /* 선택지만 있는 걸음(성별 · 동의 · 연락 상태 · 원하는 것)에는 autoFocus
       대상이 없다. 선택지를 눌러 자동 진행하면 눌린 버튼이 언마운트되면서
       포커스가 document.body 로 떨어진다. */
    const source = stripComments(view());

    expect(source).toContain('ref={panelRef}');
    expect(source).toContain('ref={titleRef}');
    expect(source).toContain('tabIndex={-1}');

    /* autoFocus 를 빼앗지 않는다 — 판 안에 이미 포커스가 있으면 건드리지 않는다. */
    expect(source).toMatch(
      /!panel\.contains\(document\.activeElement\)[\s\S]{0,80}titleRef\.current\?\.focus\(\)/u
    );
  });
});
