import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getLoveReadingPreviewSafety, selectLoveReadingPreviewDraft } from './LoveReadingPreview';

const intakeSource = readFileSync(new URL('./LoveReadingIntake.tsx', import.meta.url), 'utf8');
const introSource = readFileSync(new URL('../components/LoveReadingIntro.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('./LoveReadingEntry.tsx', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('./LoveReadingPreview.tsx', import.meta.url), 'utf8');

describe('MZ무당 팩폭 연애운 화면 순서 계약', () => {
  it('상세 경로에서는 영상·후기·하단 시작 버튼만 보여주고 입력으로 바로 연결한다', () => {
    expect(appSource).toMatch(
      /path="\/detail\/love-reading"[\s\S]*?<ProductRouteBoundary productId="love-reading">[\s\S]*?<LoveReadingEntry \/>/u
    );
    expect(appSource).toMatch(
      /path="\/form\/love-reading"[\s\S]*?<ProductRouteBoundary productId="love-reading">[\s\S]*?<LoveReadingIntake \/>/u
    );
    expect(appSource).toMatch(
      /path="\/preview\/love-reading"[\s\S]*?<ProductRouteBoundary productId="love-reading">[\s\S]*?<LoveReadingPreview \/>/u
    );
    expect(introSource).toContain("const VIDEO_SRC = '/media/mz-love-reading-intro.mp4'");
    expect(entrySource).toContain('<LoveReadingIntro />');
    expect(entrySource).not.toContain('<LoveReadingLanding');
    expect(introSource).toContain('<small>후기 예시</small>');
    expect(introSource).toContain('to="/form/love-reading"');
    expect(introSource).toContain('팩폭 연애운 보기');
    expect(introSource).not.toContain('href="#mz-love-choice"');
    expect(introSource).not.toContain('내 연애 반응부터 보기');
  });

  it('생년월일부터 질문까지 8단계 순서를 유지한다', () => {
    const titles = [
      '생년월일을 말해줘',
      '태어난 시간은?',
      '성별은?',
      '이름이 뭐야?',
      '지금 마음에 걸리는 사람 있어?',
      '연락이 늦어질 때 넌 어때?',
      '가장 알고 싶은 게 뭐야?',
      '딱 두 가지만 더 물을게'
    ];

    const positions = titles.map((title) => intakeSource.indexOf(title));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    expect(intakeSource).toContain('type IntakeStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8');
    expect(intakeSource).toContain('step === 8');
  });

  it('관계별 필수값, 저장된 반응, 질문 개인정보 경고를 검증한다', () => {
    expect(intakeSource).toContain("interestedIn: 'prefer-not-to-say'");
    expect(intakeSource).toContain("value: 'ambiguous'");
    expect(intakeSource).toContain("value: 'married'");
    expect(intakeSource).toContain('isLoveReadingDurationRequired(draft.relationshipStatus)');
    expect(intakeSource).toContain('RELATIONSHIP_DURATION_OPTIONS.map');
    expect(intakeSource).toContain('LOVE_REACTION_PROFILES.map');
    expect(intakeSource).toContain('MZ_LOVE_CHOICE_STORAGE_KEY');
    expect(intakeSource).toContain('const guestDraft = user?.id ? null : readStoredDraft(GUEST_DRAFT_KEY)');
    expect(intakeSource).toContain('validateLoveReadingIntakeContext(formData)');
    expect(intakeSource).toContain('제3자의 실명, 전화번호, 주소, 계정 ID 같은 개인정보는 적지 마세요');
    expect(intakeSource).toContain('<span>확인</span>');
    expect(intakeSource).toContain("navigate('/preview/love-reading'");
  });

  it('입력과 무료 원국 미리보기 앞에서는 로그인을 강제하지 않는다', () => {
    expect(intakeSource).not.toContain("navigate('/login'");
    expect(previewSource.indexOf("navigate('/login'")).toBeGreaterThan(previewSource.indexOf('const continueToCheckout'));
  });

  it('로그인 계정은 명시적인 일회성 handoff가 있을 때만 게스트 초안을 넘겨받는다', () => {
    expect(previewSource).toContain('GUEST_HANDOFF_MAX_AGE_MS = 15 * 60 * 1000');
    expect(previewSource).toContain("new URLSearchParams(location.search).get('loveHandoff')");
    expect(previewSource).toContain('Boolean(user?.id && hasValidGuestDraftHandoff(handoffNonce))');
    expect(previewSource).toContain('hasGuestHandoff ? readStoredFormData(GUEST_DRAFT_KEY) : null');
    expect(previewSource).toContain('window.sessionStorage.removeItem(GUEST_DRAFT_KEY)');
    expect(previewSource).toContain('window.sessionStorage.removeItem(GUEST_HANDOFF_KEY)');
    expect(previewSource).toContain('loveHandoff=${encodeURIComponent(guestHandoffNonce)}');
    expect(previewSource).toContain(': !user?.id || hasGuestHandoff;');
    expect(previewSource).not.toContain('readStoredFormData(draftKey) ?? readStoredFormData(GUEST_DRAFT_KEY)');
  });

  it('유효한 handoff의 새 게스트 초안을 기존 계정 초안보다 우선한다', () => {
    const accountDraft = { name: '이전 계정 초안' };
    const guestDraft = { name: '현재 게스트 초안' };

    const selected = selectLoveReadingPreviewDraft({
      locationDraft: accountDraft,
      accountDraft,
      guestDraft,
      hasGuestHandoff: true
    });

    expect(selected).toBe(guestDraft);
    expect(selectLoveReadingPreviewDraft({
      locationDraft: null,
      accountDraft,
      guestDraft,
      hasGuestHandoff: false
    })).toBe(accountDraft);
  });

  it.each([0, 1])('위기 질문이 q%i에 있으면 Preview에서 무료 안전 안내를 우선하고 결제를 막는다', (questionIndex) => {
    const questions = ['다음 연애는 언제 시작될까요?', '어떤 관계 신호를 볼까요?'];
    questions[questionIndex] = '나 자신을 해치고 싶어요';
    const safety = getLoveReadingPreviewSafety(questions);

    expect(safety?.title).toBe('지금은 연애 해석보다 안전이 먼저예요.');
    expect(safety?.actions.join(' ')).toContain('109');
    expect(previewSource).toContain('if (previewSafety) {');
    expect(previewSource).toContain('if (previewSafety) return;');
    expect(previewSource).toContain('href="tel:109"');
    const safetyBranch = previewSource.slice(
      previewSource.indexOf('if (previewSafety) {'),
      previewSource.indexOf('if (!formData || !intakeComplete')
    );
    expect(safetyBranch).not.toContain('continueToCheckout');
  });

  it('일반 관계 질문은 Preview 안전 분기를 활성화하지 않는다', () => {
    expect(getLoveReadingPreviewSafety(['이 관계를 끝내고 싶어요', '정리 기준이 궁금해요'])).toBeNull();
  });

  it('무료 미리보기는 개인화 컨텍스트를 쓰되 미래 인물을 확정하지 않는다', () => {
    expect(previewSource).toContain('function SpeechBalloon');
    expect(previewSource).toContain('function WebtoonScene');
    expect((previewSource.match(/<WebtoonScene\b/gu) ?? []).length).toBe(8);
    expect((previewSource.match(/<SpeechBalloon\b/gu) ?? []).length).toBe(17);
    expect(previewSource).toContain('mz-love-portrait-vault');
    expect(previewSource).toContain('mz-love-vault-portrait');
    expect(previewSource).toContain("getMzLoveScene('future-partner-fan')");
    expect(previewSource).toContain('buildPartnerSpecificityProfile');
    expect(previewSource).toContain('validateLoveReadingIntakeContext(formData || {})');
    expect(previewSource).toContain('relationshipDuration: formData.relationshipDuration');
    expect(previewSource).toContain('loveReaction: formData.loveReaction');
    expect(previewSource).toContain('loveFocus: formData.loveFocus');
    expect(previewSource).toContain('primaryQuestion: formData.q1?.trim()');
    expect(previewSource).toContain('reactionProfile.profileTitle');
    expect(previewSource).toContain('대표 키감 단서');
    expect(previewSource).toContain('얼굴 인상 상징');
    expect(previewSource).toContain('직업 환경 Top 3 후보');
    expect(previewSource).toContain('만남 장소·장면 후보');
    expect(previewSource).toContain('상대의 속마음이나 미래를 단정하지 않을게');
    expect(previewSource).toContain('특정 년·월에 사건이 생긴다고 단정하지 않고');
    expect(previewSource).not.toContain('heightTeaser');
    expect(previewSource).not.toContain('정확한 1순위 장소');
    expect(previewSource).not.toContain('직업명 Top 3');
    expect(previewSource).not.toContain('specificity.meeting.primaryLocation');
    expect(previewSource).not.toContain('specificity.professions[0].label');
    expect(previewSource).not.toContain("premiumAnswerById.get('timing')");
    expect(previewSource).not.toContain('getPartnerPortraits');
    expect(previewSource).not.toMatch(/future-partner-(?:male|female)-/u);
  });
});
