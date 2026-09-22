import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ownerSource = readFileSync(new URL('./GuiyeondoPage.tsx', import.meta.url), 'utf8');
const guestSource = readFileSync(new URL('./GuiyeondoGuestPage.tsx', import.meta.url), 'utf8');

/**
 * 귀연도의 로그인 경계.
 *
 * 지도는 이 브라우저의 저장소만으로 돌아가고, 카카오 토큰이 필요한 것은 초대 링크를
 * 만들고 회수하고 응답을 읽는 **공유** 기능뿐이다. 예전에는 입구에서 토큰을 요구해,
 * 자기 인연도를 그려 보려는 사람까지 로그인으로 돌려보냈다.
 *
 * 경계는 이제 "들어올 때"가 아니라 "남에게 보낼 때"다.
 */
describe('귀연도 로그인 경계 계약', () => {
  it('소유자 화면은 토큰 없이 열리고, 사용자 ID 저장소만 쓴다', () => {
    expect(ownerSource).toContain('const { user, isAuthenticated } = useAuth()');
    expect(ownerSource).toContain('const ownerId = user?.id');
    expect(ownerSource).toContain("const authToken = user?.authToken || ''");

    // 입구 가드와 렌더 가드 어디에도 토큰 조건이 없어야 한다.
    expect(ownerSource).toContain('if (!isAuthenticated) {');
    expect(ownerSource).toContain('if (!isAuthenticated || !user) return null');
    expect(ownerSource).not.toContain('if (!isAuthenticated || !authToken)');
    expect(ownerSource).not.toContain('if (!isAuthenticated || !user || !authToken) return null');

    // 로그인으로 보낼 때는 하던 자리로 돌아온다.
    expect(ownerSource).toContain('returnTo: `${location.pathname}${location.search}`');
    expect(ownerSource).not.toContain('previewOwnerId || user?.id');
  });

  it('공유 동작만 토큰을 요구하고, 없으면 조용히 실패하지 않는다', () => {
    expect(ownerSource).toContain('const requireSignInForSharing = ()');
    expect(ownerSource).toContain('if (authToken) return false');

    // 링크 생성과 회수는 토큰을 확인한 뒤에만 서버를 부른다.
    const openInvite = ownerSource.slice(
      ownerSource.indexOf('const openInvite'),
      ownerSource.indexOf('const revokeInvite')
    );
    expect(openInvite).toContain('if (requireSignInForSharing()) return;');
    expect(openInvite).toContain('createGuiyeondoInviteRemote(current.owner, authToken)');

    const revokeInvite = ownerSource.slice(
      ownerSource.indexOf('const revokeInvite'),
      ownerSource.indexOf('const clearMap')
    );
    expect(revokeInvite).toContain('if (requireSignInForSharing()) return;');
  });

  it('내 정보 삭제는 토큰이 없어도 막히지 않는다', () => {
    const clearMap = ownerSource.slice(ownerSource.indexOf('const clearMap'));
    // 서버 회수는 토큰이 있을 때만. 로컬 삭제는 언제나 진행된다.
    expect(clearMap).toContain('if (authToken) {');
    expect(clearMap).toContain('clearGuiyeondoMap(ownerId)');
  });

  it('초대받은 사람은 응답도 내 귀연도 생성도 로그인 없이 한다', () => {
    const completionStart = guestSource.indexOf('const completeGuest');
    const createOwnStart = guestSource.indexOf('const createOwn');
    const shareStart = guestSource.indexOf('const shareResult');
    const guestCompletion = guestSource.slice(completionStart, createOwnStart);
    const createOwn = guestSource.slice(createOwnStart, shareStart);

    expect(guestCompletion).not.toContain("navigate('/login'");
    // 링크를 받고 들어온 사람을 로그인으로 돌려보내면 그 자리에서 이탈한다.
    expect(createOwn).not.toContain("navigate('/login'");
    expect(createOwn).toContain("navigate('/guiyeondo?start=1')");
    expect(createOwn).toContain('JSON.stringify({ profile: guestProfile })');
  });
});
