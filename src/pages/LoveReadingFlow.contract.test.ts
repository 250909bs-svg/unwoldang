import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const intakeSource = readFileSync(new URL('./LoveReadingIntake.tsx', import.meta.url), 'utf8');
const introSource = readFileSync(new URL('../components/LoveReadingIntro.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

describe('MZ무당 팩폭 연애운 화면 순서 계약', () => {
  it('썸네일 상세에서 인트로 영상과 전용 입력 화면을 거친다', () => {
    expect(appSource).toContain('<Route path="/detail/love-reading" element={<LoveReadingEntry />} />');
    expect(appSource).toContain('<Route path="/form/love-reading" element={<LoveReadingIntake />} />');
    expect(appSource).toContain('<Route path="/preview/love-reading" element={<LoveReadingPreview />} />');
    expect(introSource).toContain("const VIDEO_SRC = '/media/mz-love-reading-intro.mp4'");
    expect(introSource).toContain('팩폭 연애운 보기');
    expect(introSource).toContain('to="/form/love-reading"');
  });

  it('첨부된 1번부터 7번 질문 순서를 그대로 유지한다', () => {
    const titles = [
      '생년월일을 말해줘',
      '태어난 시간은?',
      '성별은?',
      '이름이 뭐야?',
      '지금 마음에 걸리는 사람 있어?',
      '가장 알고 싶은 게 뭐야?',
      '딱 두 가지만 더 물을게'
    ];

    const positions = titles.map((title) => intakeSource.indexOf(title));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    expect(intakeSource).not.toContain('어떤 인연을 보여줄까?');
    expect(intakeSource).not.toContain('만난 기간도 알려줘');
  });

  it('성별·관계·관심주제는 선택 즉시 이동하고 이름에는 확인 버튼이 있다', () => {
    expect(intakeSource).toContain("interestedIn: value === 'male' ? 'women' : 'men'");
    expect(intakeSource).toContain('relationshipStatus: option.value');
    expect(intakeSource).toContain("relationshipDuration: ''");
    expect(intakeSource).toContain('<span>확인</span>');
    expect(intakeSource).toContain("navigate('/preview/love-reading'");
  });

  it('입력과 무료 원국 미리보기 앞에서는 로그인을 강제하지 않는다', () => {
    expect(intakeSource).not.toContain("navigate('/login'");
    const checkoutIndex = new URL('../pages/LoveReadingPreview.tsx', import.meta.url);
    const previewSource = readFileSync(checkoutIndex, 'utf8');
    expect(previewSource.indexOf("navigate('/login'")).toBeGreaterThan(previewSource.indexOf('const continueToCheckout'));
  });
});
