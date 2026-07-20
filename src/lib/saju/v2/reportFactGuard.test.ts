import { describe, expect, it } from 'vitest';
import { buildSajuReport } from '../reportBuilder';
import {
  findImmutableReportFactViolations,
  hasMalformedReportEvidenceReference,
  lockCommercialReportFacts,
  parseReportEvidenceReferences,
  stripReportEvidenceReferences
} from './reportFactGuard';

const INPUT = {
  name: '검증사용자',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '사/巳 (09:30-11:29)',
  isUnknownTime: false,
  q1: '올해 직업 이동을 해도 될까요?',
  q2: '돈을 모으려면 무엇을 먼저 바꿔야 하나요?'
};

function cloneReport() {
  return structuredClone(buildSajuReport('general-signature', INPUT));
}

describe('commercial report fact guard', () => {
  it('detects and restores attempted mutations of deterministic facts', () => {
    const base = cloneReport();
    const generated = cloneReport();

    generated.title = '변조된 상품명';
    generated.subtitle = '변조된 부제';
    generated.badge = '변조된 배지';
    generated.pillars.day = '변조';
    generated.currentDayun.range = '0세 ~ 99세';
    generated.yearLuck[0].score = 100;
    generated.monthLuck[0].ganzhi = '변조';
    generated.questionAnswers[0].question = '다른 질문';
    generated.legalNotice = ['변조된 고지'];
    if (generated.engineMeta) generated.engineMeta.scenarioCount = 999;
    const expertSection = generated.sections.find((section) => section.id === 'expert-evidence-v2');
    if (expertSection) expertSection.paragraphs = ['근거가 없는 용신 확정 문장'];
    generated.summary.analysis = ['개인화된 새 설명'];

    const violations = findImmutableReportFactViolations(base, generated);
    const guarded = lockCommercialReportFacts(base, generated);

    expect(violations.map((item) => item.path)).toEqual(
      expect.arrayContaining([
        'title',
        'subtitle',
        'badge',
        'pillars',
        'currentDayun.range',
        'yearLuck.0.score',
        'monthLuck.0.ganzhi',
        'questionAnswers.0.question',
        'legalNotice',
        'engineMeta'
      ])
    );
    expect(guarded.title).toBe(base.title);
    expect(guarded.subtitle).toBe(base.subtitle);
    expect(guarded.badge).toBe(base.badge);
    expect(guarded.pillars).toEqual(base.pillars);
    expect(guarded.currentDayun.range).toBe(base.currentDayun.range);
    expect(guarded.yearLuck[0].score).toBe(base.yearLuck[0].score);
    expect(guarded.monthLuck[0].ganzhi).toBe(base.monthLuck[0].ganzhi);
    expect(guarded.questionAnswers[0].question).toBe(base.questionAnswers[0].question);
    expect(guarded.legalNotice).toEqual(base.legalNotice);
    expect(guarded.engineMeta).toEqual(base.engineMeta);
    expect(guarded.sections.find((section) => section.id === 'expert-evidence-v2')).toEqual(
      base.sections.find((section) => section.id === 'expert-evidence-v2')
    );
    expect(guarded.summary.analysis).toEqual(['개인화된 새 설명']);
  });

  it('keeps generated wording while recalculating final quality', () => {
    const base = cloneReport();
    const generated = cloneReport();

    generated.heroNote = '근거 범위 안에서 다시 작성한 도입 문장입니다.';
    generated.currentDayun.summary = '현재 대운을 생활 장면으로 다시 설명했습니다.';
    generated.actionPlan.dos[0] = '근거 범위 안에서 실행 문구를 더 명확히 설명합니다.';
    generated.qualityAudit.score = 0;

    const guarded = lockCommercialReportFacts(base, generated);

    expect(guarded.heroNote).toBe(generated.heroNote);
    expect(guarded.currentDayun.summary).toBe(generated.currentDayun.summary);
    expect(guarded.actionPlan.dos[0]).toBe(generated.actionPlan.dos[0]);
    expect(guarded.qualityAudit.score).not.toBe(0);
  });

  it('parses the canonical evidence syntax and flags malformed markers', () => {
    const value = '설명입니다. [근거:MRE-V2-ROOT-001, TEMP:FINDING:1]';

    expect(parseReportEvidenceReferences(value)).toEqual([{
      raw: '[근거:MRE-V2-ROOT-001, TEMP:FINDING:1]',
      ids: ['MRE-V2-ROOT-001', 'TEMP:FINDING:1']
    }]);
    expect(stripReportEvidenceReferences(value)).toBe('설명입니다.');
    expect(hasMalformedReportEvidenceReference(value)).toBe(false);
    expect(hasMalformedReportEvidenceReference('설명 [근거:MRE-V2-ROOT-001')).toBe(true);
  });
});
