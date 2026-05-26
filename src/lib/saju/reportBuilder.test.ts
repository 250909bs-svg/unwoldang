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
    expect(answer.analysis).toContain('직업 이름');
    expect(answer.advice.join('\n')).toContain('추천 업종');
    expect(answer.advice.join('\n')).toContain('수익 구조');
  });
});
