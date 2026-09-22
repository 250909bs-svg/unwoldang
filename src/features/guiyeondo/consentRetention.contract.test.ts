import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 동의 문구와 실제 보관 기간이 어긋나지 않게 묶어 두는 계약.
 *
 * 인연을 오래 남기기로 한 것은 기능 결정이자 **동의 범위의 변경**이다. 예전 문구는
 * "초대 만료일(최대 14일)까지 보관" 이었고, 그 동의를 받고 응답한 사람의 데이터를
 * 나중에 정책이 바뀌었다는 이유로 계속 들고 있으면 안 된다.
 *
 * 그래서 규칙이 셋이다.
 *
 *   1) 새로 받는 동의는 `guiyeondo-share-v2` 다.
 *   2) 서버는 v2 로 들어온 응답만 인연 문서로 넘긴다.
 *   3) 화면 문구와 개인정보처리방침이 그 보관 기간을 그대로 적는다.
 *
 * 하나만 바뀌면 나머지가 거짓이 된다. 셋을 한자리에서 확인한다.
 */
const read = (url: URL) => readFileSync(url, 'utf8');

const clientApi = read(new URL('./api.ts', import.meta.url));
const guestPage = read(new URL('./GuiyeondoGuestPage.tsx', import.meta.url));
const service = read(new URL('../../../cloudrun-api/src/domains/guiyeondo/guiyeondoService.ts', import.meta.url));
const legal = read(new URL('../../content/legal.ts', import.meta.url));

describe('귀연도 동의 버전과 보관 기간 계약', () => {
  it('손님은 새 동의 버전으로 응답한다', () => {
    expect(clientApi).toContain("export const GUIYEONDO_KEEP_CONSENT_VERSION = 'guiyeondo-share-v2'");
    expect(clientApi).toContain('consentVersion: GUIYEONDO_KEEP_CONSENT_VERSION');
    /* 예전 버전을 그대로 보내면 인연이 남지 않는다 — 조용히 옛 동작으로 돌아간다. */
    expect(clientApi).not.toContain("consentVersion: 'guiyeondo-share-v1'");
  });

  it('서버는 두 버전을 모두 받되, 인연으로 넘기는 것은 새 버전뿐이다', () => {
    expect(service).toContain("const GUEST_CONSENT_VERSION = 'guiyeondo-share-v1'");
    expect(service).toContain("const GUEST_KEEP_CONSENT_VERSION = 'guiyeondo-share-v2'");

    /* 예전 동의로 들어온 응답이 인연 문서로 넘어가면 동의 범위를 넘는다. */
    const openConnection = service.slice(service.indexOf('private async openConnection'));
    expect(openConnection).toContain('if (response.consentVersion !== GUEST_KEEP_CONSENT_VERSION) return;');
  });

  it('동의 문구가 "14일까지 보관" 이라고 말하지 않는다', () => {
    /*
     * 이제 계산 결과는 초대 만료와 무관하게 남는다. 문구가 예전 그대로면 받는 동의와
     * 실제 동작이 어긋난다 — 기능이 아니라 약속의 문제다.
     */
    const consentBlock = guestPage.slice(guestPage.indexOf('finalConsents'), guestPage.indexOf('finalConsents') + 2400);

    expect(consentBlock).toContain('삭제할 때까지');
    expect(consentBlock).not.toMatch(/결과는 서버에 초대 만료일\(최대 14일\)까지 보관/);
  });

  it('개인정보처리방침이 인연 보관 기간을 따로 적는다', () => {
    expect(legal).toContain('귀연도 인연 보관 정보');
    /* 무엇을 담는지와 언제까지 두는지를 모두 적어야 한다. */
    expect(legal).toContain('원시 생년월일시와 원국 간지 스냅샷을 저장하지 않습니다');
    expect(legal).toContain('양쪽이 모두 삭제하면 서버 문서를 삭제합니다');
  });

  it('로그인은 결과를 본 뒤에만 묻는다', () => {
    /*
     * 결과를 보기 전에 계정을 요구하면 아직 아무것도 얻지 못한 사람에게 가입을 시키는
     * 것이 되어 그 자리에서 흐름이 끊긴다. 증표를 세션에 넣는 코드가 결과 화면의
     * `createOwn` 안에만 있어야 한다.
     */
    const stash = guestPage.split('GUIYEONDO_PENDING_CLAIM_KEY, JSON.stringify');
    expect(stash).toHaveLength(2);

    const createOwn = guestPage.slice(guestPage.indexOf('const createOwn ='), guestPage.indexOf('const shareResult ='));
    expect(createOwn).toContain('GUIYEONDO_PENDING_CLAIM_KEY');
  });

  it('증표는 한 번 쓰고 버린다', () => {
    /* 남겨 두면 방문할 때마다 이미 가져간 인연을 다시 가져가려 시도한다. */
    const owner = read(new URL('./GuiyeondoPage.tsx', import.meta.url));
    /* import 줄이 아니라 실제로 읽는 자리를 잡는다. */
    const readAt = owner.indexOf('getItem(GUIYEONDO_PENDING_CLAIM_KEY)');

    expect(readAt, '증표를 읽는 코드를 찾지 못했다').toBeGreaterThan(-1);
    /* 읽자마자 지워야 한다. 요청이 성공했는지 기다렸다 지우면, 실패한 증표가 남아
       방문할 때마다 같은 요청을 되풀이한다. */
    expect(owner.slice(readAt, readAt + 200)).toContain('removeItem(GUIYEONDO_PENDING_CLAIM_KEY)');
  });
});
