import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUTE_SHELL_POLICIES } from './routeShellPolicy';

/**
 * 발주자 요구: "PC에서도 모바일 화면으로 완벽하게 나와야 한다. 모든 화면들이."
 *
 * 그러려면 프레임이 400px 로 묶여야 하고, 제품 시트가 레이아웃을 물을 때 **뷰포트가
 * 아니라 프레임**을 재야 한다. 1440px 창 안의 400px 프레임에서 `@media (min-width: 768px)`
 * 는 참이 되어 데스크톱 그리드가 폰 폭 상자 안에서 돌고, 고정 컬럼이 본문을 레일로 민다.
 *
 * 이 계약이 없으면 다음 사람이 `@media` 한 줄을 습관적으로 추가하는 순간 조용히 깨진다.
 */

const root = path.resolve(__dirname, '../..');

/** 고객이 보는 제품 시트. admin 은 의도적으로 데스크톱 대시보드라 제외한다. */
const PRODUCT_SHEETS = [
  'styles/general-saju.css',
  'styles/general-signature-loading.css',
  'styles/guiyeondo.css',
  'styles/daily.css',
  'styles/my.css',
  'styles/mz-love-fact.css',
  'styles/mz-love-intake.css',
  'styles/mz-love-report.css',
  'styles/past-life.css',
  'styles/reunion-intake.css',
  'styles/reunion-premium.css',
  'styles/ud-tokens.css',
  'styles/reunion-report.css',
  'styles/reunion-webtoon.css',
  'styles/reunion.css',
  'products/general-signature/generalSignatureIntake.css',
  'products/general-signature/generalSignatureReport.css'
];

const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('셸 프레임 계약', () => {
  it('고객 라우트는 전부 폰 프레임이다 — admin 만 예외', () => {
    for (const [pattern, policy] of Object.entries(ROUTE_SHELL_POLICIES)) {
      if (pattern === '/admin') {
        expect(policy.width, pattern).toBe('full');
        continue;
      }

      expect(['phone', 'wide'], `${pattern} 이 폰 프레임을 벗어난다`).toContain(policy.width);
    }
  });

  it('wide 토큰도 폰 폭이라 PC 에서 프레임을 벗어나지 않는다', () => {
    const shell = stripComments(read('app/shell/appShell.css'));
    const wide = shell.slice(
      shell.indexOf("[data-shell-width='wide']"),
      shell.indexOf('}', shell.indexOf("[data-shell-width='wide']"))
    );

    expect(wide).toContain('400px');
    // 넓은 창에서 프레임을 다시 늘리는 미디어 블록이 있으면 안 된다.
    expect(shell).not.toMatch(/@media[^{]*min-width[^{]*\{\s*:root\[data-shell-width='wide'\]/);
  });

  it('제품 시트는 폭을 뷰포트가 아니라 프레임에 묻는다', () => {
    const offenders: string[] = [];

    for (const relative of PRODUCT_SHEETS) {
      stripComments(read(relative))
        .split('\n')
        .forEach((line, index) => {
          const trimmed = line.trim();
          if (!trimmed.startsWith('@media')) return;
          // 높이·기능 조건은 뷰포트를 물어야 맞다. 폭만 프레임 기준이어야 한다.
          if (!/\((min|max)-width\s*:/.test(trimmed)) return;
          offenders.push(`${relative}:${index + 1}  ${trimmed}`);
        });
    }

    expect(offenders, `@media 대신 @container app 을 써야 한다:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('프레임이 컨테이너로 선언되어 있어야 @container 가 동작한다', () => {
    const shell = stripComments(read('app/shell/appShell.css'));
    const rule = shell.slice(
      shell.indexOf('.app-container {'),
      shell.indexOf('}', shell.indexOf('.app-container {'))
    );

    expect(rule).toContain('container-type: inline-size');
    expect(rule).toContain('container-name: app');
  });
});
