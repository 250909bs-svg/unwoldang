import { describe, expect, it } from 'vitest';
import {
  createLocalPreviewUser,
  isLocalPreviewAuthEnabled,
  isLoopbackHostname,
  LOCAL_PREVIEW_USER_ID
} from './localPreviewAuth';

describe('로컬 미리보기 자동 로그인', () => {
  it('루프백 호스트만 루프백으로 인정한다', () => {
    ['localhost', 'LOCALHOST', ' 127.0.0.1 ', '::1', '[::1]'].forEach((hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(true);
    });

    ['unwoldang.com', 'www.unwoldang.com', 'unwoldang.vercel.app', 'localhost.evil.com', '127.0.0.1.evil.com', '', undefined].forEach(
      (hostname) => {
        expect(isLoopbackHostname(hostname)).toBe(false);
      }
    );
  });

  it('개발 빌드이면서 루프백일 때만 켜진다', () => {
    expect(isLocalPreviewAuthEnabled({ isDevelopment: true, hostname: 'localhost' })).toBe(true);
    expect(isLocalPreviewAuthEnabled({ isDevelopment: true, hostname: '127.0.0.1' })).toBe(true);

    // 배포 빌드는 호스트와 무관하게 꺼진다.
    expect(isLocalPreviewAuthEnabled({ isDevelopment: false, hostname: 'localhost' })).toBe(false);
    // 개발 빌드를 사내망에 띄워도 남의 접속에는 열리지 않는다.
    expect(isLocalPreviewAuthEnabled({ isDevelopment: true, hostname: 'unwoldang.com' })).toBe(false);
    expect(isLocalPreviewAuthEnabled({ isDevelopment: false, hostname: 'unwoldang.com' })).toBe(false);
  });

  it('미리보기 사용자 id 가 고정이라 새로고침해도 같은 사람이다', () => {
    const first = createLocalPreviewUser('2026-01-01T00:00:00.000Z');
    const second = createLocalPreviewUser('2026-02-02T00:00:00.000Z');

    expect(first.id).toBe(LOCAL_PREVIEW_USER_ID);
    expect(second.id).toBe(first.id);
    expect(first.provider).toBe('demo');
    // 카카오 사용자로 오인되지 않도록 인증 토큰은 없다.
    expect(first.authToken).toBeUndefined();
  });
});
