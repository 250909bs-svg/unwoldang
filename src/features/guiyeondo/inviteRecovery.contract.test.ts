import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ownerSource = readFileSync(new URL('./GuiyeondoPage.tsx', import.meta.url), 'utf8');

/**
 * 지도가 비었을 때의 복구 계약.
 *
 * 이 파일이 지키려는 것은 하나다. **복구는 지도가 없을 때 돌아야 한다.**
 * 원래 서버 초대 복구 효과는 `if (!authToken || !ownerId || !mapState) return` 으로
 * 시작해서, 정작 지도가 사라진 브라우저에서는 한 번도 돌지 않았다. 기기를 바꾼 사람도,
 * iOS Safari 가 저장소를 비운 사람도 "처음부터 다시" 화면만 봤다.
 *
 * 그래서 복구 효과는 두 개여야 한다 — 지도가 있을 때 갱신하는 것과, 없을 때 찾아 두는 것.
 * 하나로 합치려는 리팩터가 다시 `!mapState` 를 달면 이 테스트가 막는다.
 */
describe('귀연도 초대 복구 계약', () => {
  const effects = ownerSource.split('useEffect(');

  it('지도가 없을 때 도는 복구 효과가 있다', () => {
    const strandedEffect = effects.find((body) => body.includes('setStrandedInvites(live)'));

    expect(strandedEffect).toBeDefined();
    // 이 효과의 조건은 "지도가 **있으면** 빠진다" 여야 한다. 그 반대가 원래 버그였다.
    expect(strandedEffect).toContain('if (!authToken || mapState) return;');
    expect(strandedEffect).not.toContain('!mapState) return;');
  });

  it('지도가 있을 때의 갱신 효과는 그대로 남아 있다', () => {
    const refreshEffect = effects.find((body) => body.includes('mergeGuiyeondoOwnedInvites('));

    expect(refreshEffect).toBeDefined();
    expect(refreshEffect).toContain('if (!authToken || !ownerId || !mapState) return;');
  });

  it('두 효과는 서로 다른 효과다 — 하나로 합치면 한쪽 조건이 다른 쪽을 끈다', () => {
    const stranded = effects.filter((body) => body.includes('setStrandedInvites(live)'));
    const refresh = effects.filter((body) => body.includes('mergeGuiyeondoOwnedInvites('));

    expect(stranded).toHaveLength(1);
    expect(refresh).toHaveLength(1);
    expect(stranded[0]).not.toBe(refresh[0]);
  });

  it('지도를 새로 만드는 모든 경로에 되살린 초대를 얹는다', () => {
    // 직접 입력·아카이브 복구(completeOwner 경유)와 게스트 인계, 두 곳 모두.
    const createCalls = ownerSource.match(/createGuiyeondoMap\(/g) || [];
    const restoreCalls = ownerSource.match(/withRecoveredInvites\(createGuiyeondoMap\(/g) || [];

    expect(createCalls).toHaveLength(restoreCalls.length);
    expect(restoreCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('지도를 지우면 되살릴 목록도 비운다', () => {
    const clearMap = ownerSource.slice(ownerSource.indexOf('clearGuiyeondoMap(ownerId)'));

    // 방금 지운 사람에게 복구를 권하면, 삭제가 삭제로 끝나지 않는다.
    expect(clearMap.slice(0, 400)).toContain('setStrandedInvites([])');
  });

  it('원시 출생정보를 서버에서 되살리려 하지 않는다', () => {
    /*
     * 이 제품의 약속은 "원시 생년월일시는 초대·응답 문서에 저장하지 않는다" 이고,
     * 낯선 사람이 생년월일시를 넣어 주는 근거가 그 약속이다. 복구가 그 약속을 깨는
     * 방향으로 자라지 않게 못을 박아 둔다. 되살리는 것은 초대 목록뿐이다.
     */
    expect(ownerSource).not.toMatch(/fetchGuiyeondo\w*(Profile|Birth|Owner)\b/);
    expect(ownerSource).toContain('recoverGuiyeondoOwnerProfile(user.id)');
  });
});
