import { describe, expect, it } from 'vitest';
import { auditFactBombResult, auditMzLoveReport, auditMzLoveText } from './contentSafety';
import { MZ_LOVE_RELATIONSHIP_FIXTURES } from './fixtures';

describe('MZ love content safety', () => {
  it('detects deterministic future claims', () => {
    const issues = auditMzLoveText('너는 반드시 8월 3일에 새로운 사람을 만나게 될 거야.');
    expect(issues.map((issue) => issue.code)).toContain('future-certainty');
  });

  it('detects claims that pretend to know a partner mind', () => {
    const issues = auditMzLoveText('그 사람은 지금도 너를 사랑하고 후회한다.');
    expect(issues.map((issue) => issue.code)).toContain('partner-mind-certainty');
  });

  it('requires deterministic evidence plus a check and action', () => {
    const valid = MZ_LOVE_RELATIONSHIP_FIXTURES[0].report.openingFact;
    const issues = auditFactBombResult({ ...valid, evidence: [], checkSignal: '', action: '' });
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['missing-evidence', 'missing-action']));
  });

  it('keeps all six release fixtures free of certainty and evidence failures', () => {
    MZ_LOVE_RELATIONSHIP_FIXTURES.forEach((fixture) => {
      expect(auditMzLoveReport(fixture.report), fixture.key).toEqual([]);
    });
  });
});
