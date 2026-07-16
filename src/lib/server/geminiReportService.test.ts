import { describe, expect, it } from 'vitest';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildSajuReport } from '../saju/reportBuilder';
import {
  assertGeminiEvidenceReferences,
  sanitizeGeminiDraft,
  stripGeminiEvidenceMetadata
} from './geminiReportService';

const formData = {
  name: '검증자',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  q1: '올해 일의 방향은 무엇인가요?',
  q2: ''
};

describe('Gemini commercial response validation', () => {
  it('accepts exact deterministic prose echoes and strips evidence metadata', () => {
    const basis = buildDeterministicSajuBasis('general-signature', formData);
    const report = buildSajuReport('general-signature', formData, basis);
    const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
    const temporalId = basis.commercialV2.temporal?.findings[0]?.id;
    const baseAnswer = report.questionAnswers[0];
    const baseSection = report.sections.find((section) => section.id === 'saju');
    expect(ruleId).toBeTruthy();
    expect(temporalId).toBeTruthy();
    expect(baseAnswer).toBeTruthy();
    expect(baseSection?.paragraphs?.[0]).toBeTruthy();
    const cite = (text: string, id: string = ruleId!) => `${text} [근거:${id}]`;

    const draft = sanitizeGeminiDraft({
      legalNotice: ['삭제 시도'],
      heroNote: cite(report.heroNote),
      summary: {
        title: cite(report.summary.title),
        analysis: [cite(report.summary.analysis[0])],
        advice: [cite(report.summary.advice[0])]
      },
      questionAnswers: [{
        question: formData.q1,
        title: cite(baseAnswer.title),
        analysis: cite(baseAnswer.analysis),
        advice: baseAnswer.advice.slice(0, 10).map((value) => cite(value))
      }],
      sections: [
        { id: 'expert-evidence-v2', paragraphs: ['변조 시도'] },
        { id: 'saju', paragraphs: [cite(baseSection!.paragraphs![0])] }
      ],
      currentDayun: {
        summary: cite(report.currentDayun.summary, temporalId!)
      },
      actionPlan: {
        title: cite(report.actionPlan.title),
        priorities: [cite(report.actionPlan.priorities[0])],
        luckyDays: [{
          day: report.actionPlan.luckyDays[0].day,
          reason: cite(report.actionPlan.luckyDays[0].reason, temporalId!)
        }]
      }
    }, report);

    expect(draft.questionAnswers?.[0].advice).toHaveLength(Math.min(baseAnswer.advice.length, 10));
    expect(draft.sections).toHaveLength(1);
    expect(draft).not.toHaveProperty('legalNotice');
    expect(() => assertGeminiEvidenceReferences(draft, basis, report)).not.toThrow();

    const stripped = stripGeminiEvidenceMetadata(draft);
    expect(stripped.heroNote).toBe(report.heroNote);
    expect(stripped.currentDayun?.summary).toBe(report.currentDayun.summary);
    expect(JSON.stringify(stripped)).not.toContain('[근거:');
  });

  it('rejects an uncited generated field even when a neighboring field is cited', () => {
    const basis = buildDeterministicSajuBasis('general-signature', formData);
    const report = buildSajuReport('general-signature', formData, basis);
    const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
    const draft = sanitizeGeminiDraft({
      summary: {
        title: `${report.summary.title} [근거:${ruleId}]`,
        analysis: [
          `${report.summary.analysis[0]} [근거:${ruleId}]`,
          report.summary.analysis[1] || report.summary.analysis[0]
        ]
      }
    }, report);

    expect(() => assertGeminiEvidenceReferences(draft, basis, report)).toThrow(/summary\.analysis\.1/);
  });

  it('rejects a novel claim even when it cites a valid, scope-appropriate ID', () => {
    const basis = buildDeterministicSajuBasis('general-signature', formData);
    const report = buildSajuReport('general-signature', formData, basis);
    const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
    const draft = sanitizeGeminiDraft({
      heroNote: `${report.heroNote} 내년에 반드시 승진합니다. [근거:${ruleId}]`
    }, report);

    expect(() => assertGeminiEvidenceReferences(draft, basis, report)).toThrow(/결정론적 기본 문구와 일치하지/);
  });

  it('rejects unknown and field-irrelevant evidence IDs', () => {
    const basis = buildDeterministicSajuBasis('general-signature', formData);
    const report = buildSajuReport('general-signature', formData, basis);
    const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;

    const invalid = sanitizeGeminiDraft({
      questionAnswers: [{
        question: formData.q1,
        analysis: `${report.questionAnswers[0].analysis} [근거:not-a-real-rule]`
      }]
    }, report);
    expect(() => assertGeminiEvidenceReferences(invalid, basis, report)).toThrow(/존재하지 않는/);

    const irrelevant = sanitizeGeminiDraft({
      currentDayun: {
        summary: `${report.currentDayun.summary} [근거:${ruleId}]`
      }
    }, report);
    expect(() => assertGeminiEvidenceReferences(irrelevant, basis, report)).toThrow(/문장 범위와 무관한/);
  });

  it('rejects malformed citations and citation-only copy', () => {
    const basis = buildDeterministicSajuBasis('general-signature', formData);
    const report = buildSajuReport('general-signature', formData, basis);
    const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
    const malformed = sanitizeGeminiDraft({ heroNote: `${report.heroNote} [근거:${ruleId}` }, report);
    const citationOnly = sanitizeGeminiDraft({ heroNote: `[근거:${ruleId}]` }, report);

    expect(() => assertGeminiEvidenceReferences(malformed, basis, report)).toThrow(/형식이 잘못/);
    expect(() => assertGeminiEvidenceReferences(citationOnly, basis, report)).toThrow(/인용 외 설명/);
  });

  it('rejects a non-object JSON root', () => {
    const report = buildSajuReport('general-signature', formData);
    expect(() => sanitizeGeminiDraft([], report)).toThrow(/최상위/);
  });
});
