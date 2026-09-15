import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ownerSource = readFileSync(new URL('./GuiyeondoPage.tsx', import.meta.url), 'utf8');
const guestSource = readFileSync(new URL('./GuiyeondoGuestPage.tsx', import.meta.url), 'utf8');

describe('귀연도 카카오 로그인 연결 계약', () => {
  it('소유자 화면은 로그인 뒤 원래 귀연도 주소로 돌아오고 사용자 ID 저장소만 사용한다', () => {
    expect(ownerSource).toContain('const { user, isAuthenticated } = useAuth()');
    expect(ownerSource).toContain("navigate('/login', {");
    expect(ownerSource).toContain('returnTo: `${location.pathname}${location.search}`');
    expect(ownerSource).toContain('const ownerId = user?.id');
    expect(ownerSource).toContain("const authToken = user?.authToken || ''");
    expect(ownerSource).toContain('if (!isAuthenticated || !user || !authToken) return null');
    expect(ownerSource).toContain('fetchGuiyeondoOwnedInvites(authToken)');
    expect(ownerSource).not.toContain('previewOwnerId || user?.id');
  });

  it('초대받은 사람의 응답은 비회원으로 유지하되 내 귀연도 생성 시 로그인으로 연결한다', () => {
    const completionStart = guestSource.indexOf('const completeGuest');
    const createOwnStart = guestSource.indexOf('const createOwn');
    const shareStart = guestSource.indexOf('const shareResult');
    const guestCompletion = guestSource.slice(completionStart, createOwnStart);
    const createOwn = guestSource.slice(createOwnStart, shareStart);

    expect(guestCompletion).not.toContain("navigate('/login'");
    expect(createOwn).toContain("const returnTo = '/guiyeondo?start=1'");
    expect(createOwn).toContain("navigate('/login', {");
    expect(createOwn).toContain("state: { returnTo, tabOrigin: invite ? `/g/${invite.publicId}` : '/guiyeondo' }");
    expect(createOwn).toContain('JSON.stringify({ profile: guestProfile })');
  });
});
