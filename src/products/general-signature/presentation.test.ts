import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildSajuReport } from '../../lib/saju/reportBuilder';
import { buildGeneralSignatureReportViewModel } from './presentation';

const INPUT: Partial<IntakeFormData> = {
  name: '테스트',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight',
  relationshipStatus: 'single',
  relationshipDuration: '',
  q1: '직업과 재물 흐름을 함께 볼 때 지금 우선할 선택은 무엇인가요?',
  q2: '앞으로 30일과 90일에 각각 실행할 행동을 알려주세요.'
};

describe('general-signature report presentation', () => {
  it('keeps calculation facts in a separate immutable-facing layer', () => {
    const report = buildSajuReport('general-signature', INPUT);
    const original = buildGeneralSignatureReportViewModel(report, {
      accessMode: 'new-generation',
      provider: 'gemini'
    });
    const narrativeChanged = {
      ...report,
      heroNote: '서사만 변경',
      summary: { title: '변경', analysis: ['변경'], advice: ['변경'] },
      questionAnswers: [],
      sections: report.sections.map((section) => ({ ...section, paragraphs: ['변경된 해설'] })),
      actionPlan: { ...report.actionPlan, priorities: ['변경된 행동'] }
    };
    const changed = buildGeneralSignatureReportViewModel(narrativeChanged, {
      accessMode: 'new-generation',
      provider: 'gemini'
    });

    expect(original.calculation).toEqual(changed.calculation);
    expect(original.calculation.facts.map((fact) => fact.id)).toEqual([
      'pillars',
      'elements',
      'ten-gods',
      'timing',
      'policy'
    ]);
    expect(original.narrative.label).toBe('해설과 행동');
  });

  it('marks archive replay without changing the report payload', () => {
    const report = buildSajuReport('general-signature', INPUT);
    const replay = buildGeneralSignatureReportViewModel(report, {
      accessMode: 'archive-replay',
      provider: 'deterministic-fallback'
    });

    expect(replay.accessLabel).toBe('결제 보관본 재열람');
    expect(replay.narrative.source).toContain('내부 명리 엔진');
    expect(replay.narrative.tracks).toHaveLength(10);
  });

  it('shows unknown-time and late-zi calculation policies from engine metadata', () => {
    const report = buildSajuReport('general-signature', {
      ...INPUT,
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown',
      dayBoundaryPolicy: 'late-zi'
    });
    const model = buildGeneralSignatureReportViewModel(report, { accessMode: 'local-preview' });
    const policy = model.calculation.facts.find((fact) => fact.id === 'policy');

    expect(policy?.value).toContain('시간 미상 13개 시나리오');
    expect(policy?.value).toContain('23:00~23:59 익일');
    expect(model.calculation.facts.find((fact) => fact.id === 'pillars')?.value).toContain('시주 미상');
  });
});
