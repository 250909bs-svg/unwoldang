import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 계정 화면 중성 램프의 계약.
 *
 * 재회운 토큰은 `reunionPremium.contract.test.ts` 가 지킨다. 그 파일은 각 토큰의
 * **첫 번째** 선언을 읽으므로, 뒤에서 덮은 계정용 값은 거기서 검증되지 않는다.
 * 그래서 여기서 따로 다시 계산한다 — 주석에 적은 대비비를 믿지 않고.
 */
const sheet = readFileSync(new URL('../../styles/ud-tokens.css', import.meta.url), 'utf8');

/* 주석을 먼저 걷어낸다. 걷어내지 않으면 선택자 앞의 설명 문단이 선택자 문자열에
   그대로 붙어 `.ud-app-container` 와 일치하지 않는다. */
const withoutComments = sheet.replace(/\/\*[\s\S]*?\*\//g, '');

/** `.ud-app-container` 단독 선언 블록(= 계정용 덮어쓰기)만 잘라 낸다. */
const accountBlock = (() => {
  const blocks = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/gu)];
  const match = blocks.find((block) => block[1].trim() === '.ud-app-container');

  if (!match) throw new Error('.ud-app-container 단독 블록을 찾지 못했다');
  return match[2];
})();

function token(name: string) {
  const match = accountBlock.match(new RegExp(`${name}:\\s*([^;]+);`, 'u'));
  expect(match, `${name} 가 계정 블록에 없다`).not.toBeNull();
  return (match as RegExpMatchArray)[1].trim();
}

function channel(value: number) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  expect(match, `${hex} 는 6자리 hex 가 아니다`).not.toBeNull();
  const value = (match as RegExpMatchArray)[1];
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string) {
  const [a, b] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (a + 0.05) / (b + 0.05);
}

describe('계정 화면 중성 램프 계약', () => {
  it('바닥이 순검정이라 셸과 이음새가 생기지 않는다', () => {
    /* 셸은 계정 라우트(surface: default)에 #000000 을 칠한다. 페이지가 다른 값을
       쓰면 프레임 경계에 선이 보인다. */
    const shell = readFileSync(new URL('../../app/shell/appShell.css', import.meta.url), 'utf8');

    expect(token('--ud-floor')).toBe('#000000');
    expect(shell).toContain('--app-shell-bg: #000000;');
  });

  it('면 사다리가 단조 증가한다', () => {
    const ladder = ['--ud-floor', '--ud-surface-1', '--ud-surface-2', '--ud-surface-3', '--ud-surface-4']
      .map(token)
      .map(luminance);

    for (let index = 1; index < ladder.length; index += 1) {
      expect(ladder[index], `${index} 단계가 앞 단계보다 어둡다`).toBeGreaterThan(ladder[index - 1]);
    }
  });

  it('면이 전부 불투명하다', () => {
    /* 알파로 칠하면 검정 위에 합성되어 대비가 1.000:1 — 카드가 배경과 같은 색이 된다.
       재회운 시트가 한 번 겪고 고친 문제다. */
    for (const name of ['--ud-floor', '--ud-surface-1', '--ud-surface-2', '--ud-surface-3', '--ud-surface-4']) {
      expect(token(name), name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('작은 글자 토큰이 가장 밝은 글자용 면에서 AA 를 넘는다', () => {
    const brightest = token('--ud-surface-3');

    for (const name of ['--ud-cream', '--ud-cream-dim', '--ud-cream-mute', '--ud-gold-text']) {
      expect(contrast(token(name), brightest), `${name} on surface-3`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('본문 글자가 흰색이다', () => {
    expect(token('--ud-cream')).toBe('#ffffff');
  });

  it('회색 램프가 누렇지 않다', () => {
    /*
     * 요구는 "황토색 말고 옅은 예쁜 회색" 이었다. 여기서 막아야 할 것은 **따뜻함**이지
     * 색기 자체가 아니다 — 아주 옅은 푸른 기가 도는 회색이 죽은 무채색보다 예쁘고,
     * 참고 화면의 회색도 그쪽이다. 그래서 규칙 두 개로 적는다.
     *
     *   1) 파랑이 빨강보다 작지 않다(= 누렇지 않다). 재회운의 #17100f 은 R 이 B 보다
     *      8 크고, 그것이 황토빛의 정체다.
     *   2) 기울기가 세지는 않다. 넘으면 회색이 아니라 색이 된다.
     */
    const names = [
      '--ud-surface-1',
      '--ud-surface-2',
      '--ud-surface-3',
      '--ud-surface-4',
      '--ud-cream-dim',
      '--ud-cream-mute'
    ];

    for (const name of names) {
      const hex = token(name);
      const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

      expect(b, `${name} = ${hex} 이 누렇다`).toBeGreaterThanOrEqual(r);
      expect(
        Math.max(r, g, b) - Math.min(r, g, b),
        `${name} = ${hex} 은 회색이라기엔 색이 세다`
      ).toBeLessThanOrEqual(12);
    }
  });

  it('재회운의 따뜻한 값은 그대로 남아 있다', () => {
    /* 계정용 덮어쓰기가 공유 선언을 고쳐 버리면 재회운 세 화면의 측정값이 무너진다. */
    const shared = sheet.match(/\.reunion-app-container,\s*\.ud-app-container\s*\{([\s\S]*?)\n\}/u);

    expect(shared, '공유 선언 블록을 찾지 못했다').not.toBeNull();
    expect((shared as RegExpMatchArray)[1]).toContain('--ud-surface-1: #17100f;');
    expect((shared as RegExpMatchArray)[1]).toContain('--ud-cream: #f3e6d2;');
  });
});
