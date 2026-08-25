import { describe, expect, it } from 'vitest';
import { buildSajuReport } from './reportBuilder';
import { findReportConsistencyViolations } from './reportConsistency';

function reportFixture() {
  return buildSajuReport('general-signature', {
    name: '일관성검증',
    gender: 'male',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-09-09',
    birthTime: '10:24',
    isUnknownTime: false,
    birthTimePrecision: 'exact',
    dayBoundaryPolicy: 'midnight',
    relationshipStatus: 'single',
    relationshipDuration: '',
    q1: '일에서 지금 먼저 바꿀 것은 무엇인가요?',
    q2: '돈을 남기려면 무엇을 주의해야 하나요?'
  });
}

describe('customer report consistency guard', () => {
  it('accepts a deterministic exact-time report', () => {
    expect(findReportConsistencyViolations(reportFixture())).toEqual([]);
  });

  it('detects missing hour facts for exact time', () => {
    const report = reportFixture();
    const invalid = {
      ...report,
      pillars: { ...report.pillars, hour: null }
    };
    expect(findReportConsistencyViolations(invalid).join(' ')).toContain('네 기둥');
  });

  it('detects promotion of a non-confirmed yongsin candidate', () => {
    const report = reportFixture();
    const invalid = {
      ...report,
      engineMeta: report.engineMeta && {
        ...report.engineMeta,
        yongsinConsensusStatus: 'mixed' as const,
        helpfulElementSource: 'expert-consensus' as const
      }
    };
    expect(findReportConsistencyViolations(invalid).join(' ')).toContain('비확정 용신');
  });

  it('detects a climate conclusion opposite to the deterministic fact', () => {
    const report = reportFixture();
    const invalid = {
      ...report,
      sections: report.sections.map((section) => section.id === 'expert-evidence-v2'
        ? { ...section, paragraphs: ['한난은 더운 편으로 판정했습니다.'] }
        : section),
      engineMeta: report.engineMeta && {
        ...report.engineMeta,
        climateTemperature: 'cold' as const
      }
    };
    expect(findReportConsistencyViolations(invalid).join(' ')).toContain('한난 결론');
  });
});
