import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 서버 코드도 타입 검사를 받는다.
 *
 * 루트 `tsconfig.json` 의 `include` 는 `["src"]` 뿐이라 `cloudrun-api/` 가 빠져 있었다.
 * 그래서 `npm run build` 가 통과해도 서버에는 **존재하지 않는 함수를 부르는 코드**가
 * 남을 수 있었다. 실제로 그렇게 한 번 통과했다 — 라우터가 정의되지 않은
 * `sendPaymentError` 를 부르는데 빌드가 초록색이었다.
 *
 * 빌드 스크립트에 서버 타입검사를 끼워 넣었고, 그것이 다시 빠지지 않게 여기서 고정한다.
 */
const packageJson = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
) as { scripts?: Record<string, string> };

const rootTsconfig = readFileSync(new URL('../../../tsconfig.json', import.meta.url), 'utf8');

describe('서버 타입검사 계약', () => {
  it('빌드가 서버 타입검사를 함께 돌린다', () => {
    const build = packageJson.scripts?.build || '';

    expect(build).toContain('typecheck:server');
  });

  it('서버 타입검사는 cloudrun-api 의 tsconfig 를 쓴다', () => {
    const typecheck = packageJson.scripts?.['typecheck:server'] || '';

    expect(typecheck).toContain('cloudrun-api/tsconfig.json');
    expect(typecheck).toContain('--noEmit');
  });

  it('루트 tsconfig 가 서버를 덮지 않는다는 사실을 기록해 둔다', () => {
    /* 이 단언이 깨진다면 루트가 cloudrun-api 를 포함하게 된 것이고, 그때는 별도
       타입검사가 필요 없어진다 — 그 판단을 하라는 신호다. */
    expect(rootTsconfig).toContain('"include": ["src"]');
  });
});
