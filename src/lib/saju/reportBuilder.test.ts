import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildSajuReport } from './reportBuilder';

function makeFormData(overrides: Partial<IntakeFormData> = {}): Partial<IntakeFormData> {
  return {
    name: '차민호',
    gender: 'male',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-09-09',
    birthTime: '10:24',
    isUnknownTime: false,
    relationshipStatus: 'single',
    relationshipDuration: 'under1',
    q1: '살기싫다',
    q2: '뭐먹고살지 ?',
    ...overrides
  };
}

describe('saju report question answers', () => {
  it('routes self-harm wording to a safety-first answer', () => {
    const report = buildSajuReport('general-signature', makeFormData());
    const answer = report.questionAnswers[0];

    expect(answer.title).toContain('민호야');
    expect(answer.title).toContain('혼자 버티는 날이 아니야');
    expect(answer.analysis).toContain('안전이 먼저야');
    expect(answer.analysis).toContain('월령');
    expect(answer.advice.join('\n')).toContain('109');
    expect(answer.advice.join('\n')).not.toContain('하세요');
    expect(answer.advice).toHaveLength(10);
  });

  it('treats existential crisis wording as a safety-first answer', () => {
    const report = buildSajuReport('general-signature', makeFormData({ q1: '나왜살지', q2: '' }));
    const answer = report.questionAnswers[0];

    expect(answer.title).toContain('민호야');
    expect(answer.title).toContain('인생 답을 혼자 결론내리면 안 돼');
    expect(answer.analysis).toContain('사람 옆에 붙어 있어야 하는 날');
    expect(answer.advice.join('\n')).toContain('109');
  });

  it('keeps crisis answers in one casual tone for a two-syllable name', () => {
    const report = buildSajuReport(
      'general-signature',
      makeFormData({ name: '진짜', q1: '죽고싶다', q2: '나왜살지' })
    );
    const combined = report.questionAnswers
      .map((answer) => `${answer.title}\n${answer.analysis}\n${answer.advice.join('\n')}`)
      .join('\n');

    expect(combined).toContain('진짜야');
    expect(combined).toContain('진짜가 지금 혼자 있으면');
    expect(combined).not.toContain('진짜님');
    expect(combined).not.toContain('혼자 버티면 안 됩니다');
    expect(report.questionAnswers[0].title).not.toEqual(report.questionAnswers[1].title);
  });

  it('answers 먹고살지 as a career and income-structure question', () => {
    const report = buildSajuReport('general-signature', makeFormData());
    const answer = report.questionAnswers[1];

    expect(answer.title).toContain('직업·커리어');
    expect(answer.analysis).toContain('결론부터');
    expect(answer.analysis).toContain('겉글자 기준');
    expect(answer.advice.join('\n')).toContain('추천 업종');
    expect(answer.advice.join('\n')).toContain('수익 구조');
    expect(answer.analysis.replace(/\s/g, '').length).toBeGreaterThanOrEqual(300);
    expect(answer.advice).toHaveLength(10);
    expect(answer.advice[0]).toMatch(/^1\./);
    expect(answer.advice[9]).toMatch(/^10\./);
  });

  it('keeps exact customer questions and expands choice/place answers in detail', () => {
    const q1 = '나 이사 강남 독산역 중에 어디로 가는게 좋을까 ?';
    const q2 = '나 연애 어디가면 할 수있어 ?';
    const report = buildSajuReport('concern-reading', makeFormData({ q1, q2 }));
    const [moveAnswer, loveAnswer] = report.questionAnswers;

    expect(moveAnswer.question).toBe(q1);
    expect(loveAnswer.question).toBe(q2);

    for (const answer of report.questionAnswers) {
      expect(answer.analysis.replace(/\s/g, '').length).toBeGreaterThanOrEqual(300);
      expect(answer.advice).toHaveLength(10);
      expect(answer.advice[0]).toMatch(/^1\./);
      expect(answer.advice[9]).toMatch(/^10\./);
    }

    expect(`${moveAnswer.analysis}\n${moveAnswer.advice.join('\n')}`).toContain('강남');
    expect(`${moveAnswer.analysis}\n${moveAnswer.advice.join('\n')}`).toContain('독산역');
    expect(loveAnswer.advice.join('\n')).toContain('지인 소개');
  });

  it('separates visible ten-god readings and hidden-stem scores', () => {
    const report = buildSajuReport('general-signature', makeFormData({ q1: '회사 계속 다녀도 될까?', q2: '' }));

    expect(report.visibleTenGods.map((item) => item.reading)).toEqual([
      '壬 편재 / 申 식신',
      '己 겁재 / 酉 상관',
      '戊 비견 / 子 정재',
      '丁 정인 / 巳 편인'
    ]);
    expect(report.tenGodBasisNote).toContain('지장간 포함 기준');
    expect(report.currentDayun.name).toBe('壬子');
    expect(report.nextDayun.name).toBe('癸丑');
    expect(report.yearLuck.slice(0, 5).map((item) => item.headline)).toEqual([
      '丙午년, 공개와 검증이 동시에 열리는 해',
      '丁未년, 관계 확장과 현실화가 맞물리는 해',
      '戊申년, 구조 조정과 성과 검증의 해',
      '己酉년, 반복 수익과 평판 고정의 해',
      '庚戌년, 재정비와 기준 재설정의 해'
    ]);
  });

  it('answers company and business questions with direct premium action plans', () => {
    const report = buildSajuReport(
      'concern-reading',
      makeFormData({
        q1: '회사 계속 다녀도 될까?',
        q2: '사업을 어떻게 시작할까?'
      })
    );

    const [companyAnswer, businessAnswer] = report.questionAnswers;
    expect(companyAnswer.analysis).toContain('바로 퇴사가 답은 아닙니다');
    expect(companyAnswer.advice.join('\n')).toContain('3개월 판단 기준');
    expect(companyAnswer.advice).toHaveLength(10);
    expect(businessAnswer.analysis).toContain('대표 상품 1개');
    expect(businessAnswer.advice.join('\n')).toContain('가격 구조');
    expect(businessAnswer.advice).toHaveLength(10);
  });

  it('attaches a report quality audit without banned UI residue', () => {
    const report = buildSajuReport('general-signature', makeFormData({ q1: '회사 계속 다녀도 될까?', q2: '사업을 어떻게 시작할까?' }));

    expect(report.qualityAudit.score).toBeGreaterThanOrEqual(80);
    expect(report.qualityAudit.bannedTerms).toEqual([]);
    expect(report.qualityAudit.typoSignals).toEqual([]);
  });
});
