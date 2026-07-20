import { describe, expect, it } from 'vitest';
import type { EarthlyBranch } from '../saju/constants';
import type { SajuReportData } from '../saju/report';
import {
  buildPartnerSpecificityProfile,
  PARTNER_SPECIFICITY_DISCLOSURE
} from './partnerSpecificity';

function makeReport(overrides: Partial<SajuReportData> = {}): SajuReportData {
  return {
    serialNumber: 'UW-SPECIFICITY-001',
    createdAt: '2026-07-21T00:00:00.000Z',
    customerName: '서윤',
    questionPreview: '다음 인연이 궁금해요.',
    questionAnswers: [],
    dayMaster: '갑목',
    dayMasterElement: '목',
    pillars: {
      year: '경오',
      month: '을유',
      day: '갑자',
      hour: '정묘'
    },
    helpfulElements: ['금', '토'],
    tenGods: [
      { label: '정관', value: 34 },
      { label: '정재', value: 26 },
      { label: '편인', value: 18 },
      { label: '식신', value: 8 }
    ],
    currentDayun: {
      name: '병인',
      range: '2024~2033',
      summary: '현재 대운',
      focus: '관계의 기준',
      caution: '서두른 확정'
    },
    ...overrides
  } as unknown as SajuReportData;
}

describe('partner specificity deterministic profile', () => {
  it('동일한 원국과 관심 성별은 키·얼굴·직업·만남을 항상 동일하게 만든다', () => {
    const report = makeReport();
    const first = buildPartnerSpecificityProfile(report, 'men');
    const second = buildPartnerSpecificityProfile(report, 'men');

    expect(second).toEqual(first);
    expect(first.version).toBe('partner-specificity-v2');
    expect(first.signatureKey).toMatch(/^ps2-[a-z0-9]{7,}$/u);
    expect(first.professions.map((item) => item.rank)).toEqual([1, 2, 3]);
    expect(new Set(first.professions.map((item) => item.id)).size).toBe(3);
  });

  it('이름·질문·번호·생성시각은 선천 프로필 순위를 바꾸지 않는다', () => {
    const original = buildPartnerSpecificityProfile(makeReport(), 'women');
    const changed = buildPartnerSpecificityProfile(makeReport({
      serialNumber: 'UW-OTHER-999',
      createdAt: '2049-01-01T00:00:00.000Z',
      customerName: '다른이름',
      questionPreview: '재회만 궁금해요.'
    }), 'women');

    expect(changed).toEqual(original);
  });

  it('지지별 키 밴드를 대표 범위로만 제공하고 숫자를 사실로 확정하지 않는다', () => {
    const branches: EarthlyBranch[] = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

    for (const branch of branches) {
      const profile = buildPartnerSpecificityProfile(makeReport({
        pillars: {
          year: '경오',
          month: '을유',
          day: `갑${branch}`,
          hour: '정묘'
        }
      }), 'men');

      expect(profile.height.rangeCm[0]).toBe(profile.height.representativeCm - 2);
      expect(profile.height.rangeCm[1]).toBe(profile.height.representativeCm + 2);
      expect(profile.height.label).toContain('cm 전후');
      expect(profile.height.label).toContain('인연상');
      expect(profile.height.kind).toBe('symbolic-visual-reference');
      expect(profile.height.numericReference).toBe(true);
    }

    expect(PARTNER_SPECIFICITY_DISCLOSURE).toContain('대표 범위');
    expect(PARTNER_SPECIFICITY_DISCLOSURE).toContain('확정하는 예언이 아닙니다');

    const genderNeutral = buildPartnerSpecificityProfile(makeReport(), 'any');
    expect(genderNeutral.height.numericReference).toBe(false);
    expect(genderNeutral.height.label).toContain('성별 비한정');
    expect(genderNeutral.height.label).not.toMatch(/\d/u);
  });

  it('대표 원국의 배우자궁·십성·도움 오행 결과를 골든 값으로 고정한다', () => {
    const profile = buildPartnerSpecificityProfile(makeReport(), 'men');

    expect(profile.height.representativeCm).toBe(174);
    expect(profile.face.primary).toBe('고양이상');
    expect(profile.professions.map((item) => item.label)).toEqual(['공무원', '세무사', '의사']);
    expect(profile.meeting.primaryLocation).toBe('프로젝트 계약 미팅');
  });

  it('직업 Top 3와 만남 1순위마다 명리 근거가 있다', () => {
    const profile = buildPartnerSpecificityProfile(makeReport(), 'men');

    for (const profession of profile.professions) {
      expect(profession.label.trim()).not.toBe('');
      expect(profession.fieldLabel.trim()).not.toBe('');
      expect(profession.evidence.length).toBeGreaterThan(0);
      expect(profession.score).toBeGreaterThan(0);
    }

    expect(profile.meeting.primaryLocation.trim()).not.toBe('');
    expect(profile.meeting.scene.trim()).not.toBe('');
    expect(profile.meeting.recognitionSignal).toContain('현실 확인 기준');
    expect(profile.meeting.recognitionSignal).toContain('명리 판정과 별도');
    expect(profile.meeting.recognitionSignalKind).toBe('practical-check');
    expect(profile.meeting.primaryLocation).not.toContain('·');
    expect(profile.meeting.evidence.length).toBeGreaterThan(0);
    expect(profile.evidenceSummary).toContain('배우자궁');
    expect(profile.evidenceSummary).toContain('상위 십성');
    expect(profile.evidenceSummary).toContain('도움 오행');
    expect(profile.professions.every((item) => !item.label.includes('·'))).toBe(true);
  });

  it('민족 외모 고정관념과 100% 보장 문구를 만들지 않는다', () => {
    const profile = buildPartnerSpecificityProfile(makeReport(), 'men');
    const copy = JSON.stringify(profile);

    expect(copy).not.toMatch(/아랍상|중동인|혼혈상/iu);
    expect(copy).not.toMatch(/100\s*%|반드시\s*(?:만난다|의사|변호사|세무사)/iu);
    expect(copy).toContain('1순위');
    expect(copy).toContain('실제 미래 인물');
  });
});
