import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 계정 시트의 스코프 계약.
 *
 * `my.css` · `daily.css` · `chat.css` · `gift.css` 는 선택자를
 * `.ud-app-container.ud-app-container` 로 시작한다. 클래스를 두 번 적는 것은 보기에
 * 군더더기라 다음 사람이 "정리" 하기 쉬운데, **지우면 화면이 조용히 되돌아간다.**
 *
 * 이유: index.css 가 계정 화면의 옛 규칙을 `body.home-all-black .my-replay-title span`
 * 처럼 적어 두었고, 그 선택자는 (0,2,2) 다. `.ud-app-container .x` 는 (0,2,1) 이라
 * 한 끗 차이로 진다 — 실제로 마이 본화면만 새 색으로 그려지고 그 아래 화면들은
 * 옛 회색으로 남아 있었다. 두 번 적으면 (0,3,1) 이 되어 이긴다.
 *
 * 그래서 이 계약이 있다. 지울 때는 index.css 쪽 옛 규칙을 함께 걷어내야 한다.
 */
const SHEETS = ['my.css', 'daily.css', 'chat.css', 'gift.css'];

const read = (name: string) =>
  readFileSync(new URL(`../../styles/${name}`, import.meta.url), 'utf8');

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** 선택자만 뽑는다. @규칙 · 키프레임 단계는 제외한다. */
function selectors(css: string) {
  return [...stripComments(css).matchAll(/([^{}]+)\{[^{}]*\}/gu)]
    .flatMap((match) => match[1].split(','))
    .map((part) => part.trim())
    .filter(Boolean)
    .filter(
      (part) =>
        !part.startsWith('@') && !part.endsWith('%') && part !== 'from' && part !== 'to'
    );
}

describe('계정 시트 스코프 계약', () => {
  it('계정 화면 선택자는 스코프를 두 번 적어 index.css 를 이긴다', () => {
    for (const sheet of SHEETS) {
      /* 토큰만 선언하는 `.ud-app-container { --udm-*: … }` 블록은 예외다. 커스텀
         프로퍼티는 상속으로 내려가므로 명시도 싸움에 끼지 않는다. */
      const scoped = selectors(read(sheet)).filter(
        (selector) => selector.includes('.ud-app-container') && selector !== '.ud-app-container'
      );

      expect(scoped.length, `${sheet} 에 스코프된 선택자가 없다`).toBeGreaterThan(0);

      for (const selector of scoped) {
        expect(
          selector,
          `${sheet}: "${selector}" 가 스코프를 한 번만 적었다 — index.css 에 진다`
        ).toContain('.ud-app-container.ud-app-container');
      }
    }
  });

  it('index.css 가 아직 그 옛 규칙을 들고 있다', () => {
    /* 이 단언이 깨지면 옛 규칙이 사라진 것이고, 그때는 위의 중복 스코프를 걷어내도 된다.
       먼저 지우지 말라는 뜻이 아니라, 지울 시점을 알려 주는 표식이다. */
    const index = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

    expect(index).toContain('body.home-all-black .my-replay-title span');
  });

  it('결제 화면 규칙은 이 스코프 밖이라 예외다', () => {
    /* 결제는 계정 컨테이너를 달지 않는다. 그 몇 줄은 스코프 없이 남아 있어야 한다. */
    const unscoped = selectors(read('my.css')).filter(
      (selector) => !selector.includes('.ud-app-container')
    );

    expect(unscoped.every((selector) => selector.startsWith('.checkout-')), unscoped.join(' | ')).toBe(
      true
    );
  });
});
