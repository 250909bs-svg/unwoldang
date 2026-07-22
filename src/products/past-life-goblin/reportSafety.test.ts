import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildPastLifeProfile } from '../../lib/saju/pastLifeProfile';
import type { SajuReportData } from '../../lib/saju/report';
import { buildSajuReport } from '../../lib/saju/reportBuilder';
import { PAST_LIFE_PRODUCT_ID } from './contract';
import { buildPastLifeGoblinReport } from './reportBuilder';
import { sanitizePastLifeReportForRendering } from './reportSafety';

const input: Partial<IntakeFormData> = {
  name: '해린',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  q1: 'AI 회사로 이직하고 싶어요.',
  q2: 'ChatGPT 업무를 맡아도 될까요?'
};

function fixture() {
  const report = buildPastLifeGoblinReport(
    buildSajuReport(PAST_LIFE_PRODUCT_ID, input)
  );
  return {
    ...report,
    pastLifeProfile: buildPastLifeProfile(report, input)
  };
}

describe('past-life report render safety', () => {
  it('keeps a safe paid report and normal customer questions unchanged by reference', () => {
    const report = fixture();

    expect(sanitizePastLifeReportForRendering(report)).toBe(report);
    expect(report.questionAnswers.map((answer) => answer.question)).toEqual([
      input.q1,
      input.q2
    ]);
  });

  it('sanitizes every shared report surface while preserving facts and raw questions', () => {
    const report = fixture();
    const unsafe = '당신의 전생은 조선 시대의 궁중 무당이었습니다.';
    const injected: SajuReportData = {
      ...report,
      summary: {
        ...report.summary,
        analysis: [unsafe],
        advice: [unsafe]
      },
      keyTakeaways: [{ title: '주요 결론', body: unsafe }],
      questionAnswers: report.questionAnswers.map((answer) => ({
        ...answer,
        analysis: unsafe,
        advice: [unsafe]
      })),
      sections: report.sections.map((section, index) =>
        index === 0
          ? {
              ...section,
              paragraphs: [unsafe],
              callout: { title: '주의', body: unsafe }
            }
          : section
      ),
      actionPlan: {
        ...report.actionPlan,
        priorities: [unsafe],
        dos: [unsafe],
        avoids: [unsafe]
      },
      pastLifeProfile: report.pastLifeProfile
        ? {
            ...report.pastLifeProfile,
            openingLine: unsafe,
            selfPortrait: {
              ...report.pastLifeProfile.selfPortrait,
              caption: unsafe
            },
            storyBeats: report.pastLifeProfile.storyBeats.map((beat, index) =>
              index === 0 ? { ...beat, scene: unsafe, goblinLine: unsafe } : beat
            )
          }
        : undefined
    };

    const sanitized = sanitizePastLifeReportForRendering(injected);
    const serialized = JSON.stringify(sanitized);

    expect(sanitized).not.toBe(injected);
    expect(serialized).not.toContain(unsafe);
    expect(serialized).toContain('상징 서사');
    expect(sanitized.customerName).toBe(injected.customerName);
    expect(sanitized.birthLabel).toBe(injected.birthLabel);
    expect(sanitized.pillars).toBe(injected.pillars);
    expect(sanitized.questionAnswers.map((answer) => answer.question)).toEqual(
      injected.questionAnswers.map((answer) => answer.question)
    );
    expect(injected.summary.analysis).toEqual([unsafe]);
  });

  it('is a no-op for other product reports', () => {
    const other = buildSajuReport('general-signature', input);
    expect(sanitizePastLifeReportForRendering(other)).toBe(other);
  });
});
