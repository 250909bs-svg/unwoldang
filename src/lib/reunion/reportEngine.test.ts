import { describe, expect, it } from 'vitest';
import { createReunionSampleInput } from './fixtures';
import { buildReunionReport } from './reportEngine';
import { buildReunionMetrics } from './scoring';

describe('buildReunionReport', () => {
  it('builds separate decision indices with evidence, counter-evidence, and QA', () => {
    const report = buildReunionReport(
      createReunionSampleInput(),
      new Date('2026-07-21T03:00:00.000Z')
    );

    expect(report.metrics).toHaveLength(14);
    expect(report.answerFirst).toHaveLength(3);
    expect(report.contactWindows.length).toBeLessThanOrEqual(3);
    expect(report.metrics.every((item) =>
      item.evidenceIds.length > 0 && item.counterEvidenceIds.length > 0
    )).toBe(true);
    expect(report.audit.passed).toBe(true);
    expect(report.audit.bannedClaimHits).toEqual([]);
  });

  it('does not use the unimplemented Ziwei layer for scoring', () => {
    const report = buildReunionReport(createReunionSampleInput());
    const ziwei = report.components.find((item) => item.id === 'ZIWEI');

    expect(ziwei).toMatchObject({
      status: 'UNVERIFIED',
      usedForScoring: false,
      version: 'not-implemented'
    });
    expect(report.limitations.join(' ')).toContain('자미두수');
  });

  it('lets safety override favorable chart signals and suppresses contact scripts', () => {
    const input = createReunionSampleInput();
    input.reunion.safety.explicitNoContact = true;

    const report = buildReunionReport(input);

    expect(report.safety.status).toBe('CONTACT_PROHIBITED');
    expect(report.contactWindows).toEqual([]);
    expect(report.messageReview.revisedMessage).toBe('');
    expect(report.replyTree).toEqual([]);
    expect(report.metrics.find((item) => item.id === 'reunion')?.score).toBeNull();
    expect(report.choices.find((item) => item.id === 'NO_CONTACT')?.recommendation)
      .toBe('REQUIRED');
  });

  it('reduces confidence and excludes compatibility when partner birth is unknown', () => {
    const input = createReunionSampleInput();
    input.reunion.partnerBirthKnown = false;
    input.reunion.partnerBirthAccuracy = 'unknown';
    input.partner = undefined;

    const report = buildReunionReport(input);

    expect(report.birthChart.partner.available).toBe(false);
    expect(report.confidence.score).toBeLessThan(0.6);
    expect(report.confidence.reasons.join(' ')).toContain('상대 출생정보');
  });

  it('keeps the decision scores reproducible for the same normalized input', () => {
    const input = createReunionSampleInput();
    const instant = new Date('2026-07-21T03:00:00.000Z');
    const first = buildReunionReport(input, instant);
    const second = buildReunionReport(input, instant);

    expect(first.metrics.map((item) => [item.id, item.score]))
      .toEqual(second.metrics.map((item) => [item.id, item.score]));
  });

  it('uses generatedAt as the reference date and discards client elapsed-day fields', () => {
    const poisoned = createReunionSampleInput();
    poisoned.reunion.analysisDate = '2099-12-31';
    poisoned.reunion.facts.daysSinceBreakup = 9_999;
    poisoned.reunion.facts.daysSinceLastContact = 9_999;

    const canonical = createReunionSampleInput();
    canonical.reunion.analysisDate = '1999-01-01';
    canonical.reunion.facts.daysSinceBreakup = 104;
    canonical.reunion.facts.daysSinceLastContact = 23;

    const instant = new Date('2026-07-21T03:00:00.000Z');
    const poisonedReport = buildReunionReport(poisoned, instant);
    const canonicalReport = buildReunionReport(canonical, instant);

    expect(poisonedReport.analysisDate).toBe('2026-07-21');
    expect(poisonedReport.metrics.map((item) => [item.id, item.score]))
      .toEqual(canonicalReport.metrics.map((item) => [item.id, item.score]));
  });

  it('returns a safety-only report before any birth or compatibility calculation', () => {
    const input = createReunionSampleInput();
    input.reunion.safety.violence = true;
    input.birthDate = 'not-a-date';
    if (input.partner) input.partner.birthDate = 'not-a-date';

    const report = buildReunionReport(
      input,
      new Date('2026-07-21T03:00:00.000Z')
    );

    expect(report.safety.status).toBe('ANALYSIS_BLOCKED');
    expect(report.metrics).toHaveLength(14);
    expect(report.metrics.every((item) =>
      item.state === 'WITHHELD_SAFETY' && item.score === null
    )).toBe(true);
    expect(report.contactWindows).toEqual([]);
    expect(report.replyTree).toEqual([]);
    expect(report.plan90).toEqual([]);
    expect(report.choices).toHaveLength(1);
    expect(report.birthChart.self).toMatchObject({
      dayMaster: '미계산',
      element: '미계산',
      precision: 'not-calculated-safety-gate'
    });
    expect(report.components.find((item) => item.id === 'MANSE')).toMatchObject({
      status: 'UNVERIFIED',
      version: 'not-run-safety-gate',
      usedForScoring: false
    });
    expect(report.audit.passed).toBe(true);
  });

  it('keeps prohibited contact at maximum harm and withholds every relationship outcome', () => {
    const input = createReunionSampleInput();
    input.reunion.safety.explicitNoContact = true;

    const report = buildReunionReport(input);
    const metric = (id: string) => report.metrics.find((item) => item.id === id);

    expect(metric('contact-harm-risk')?.score).toBe(100);
    expect(metric('sustainability-30')?.score).toBeNull();
    expect(metric('sustainability-90')?.score).toBeNull();
    expect(metric('long-term')?.score).toBeNull();
    expect(report.plan90).toEqual([]);
    expect(report.plan30.flatMap((phase) => phase.actions).join(' ')).not.toContain('합의');
  });

  it('does not generate contact choices, timing, or scripts while preparation is required', () => {
    const input = createReunionSampleInput();
    input.reunion.readiness.canAcceptNoReply = false;
    input.reunion.messageDraft = '오랜만이야. 잘 지내?';

    const report = buildReunionReport(input);

    expect(report.safety.status).toBe('PREPARATION_REQUIRED');
    expect(report.choices.some((choice) => choice.id === 'CONTACT_NOW')).toBe(false);
    expect(report.contactWindows).toEqual([]);
    expect(report.messageReview.revisedMessage).toBe('');
    expect(report.metrics.find((item) => item.id === 'outgoing-suitability')?.score)
      .toBeNull();
    expect(report.plan90).toEqual([]);
  });

  it('suppresses contact outputs when a dangerous draft attempts to bypass a block', () => {
    const input = createReunionSampleInput();
    input.reunion.messageDraft = '다른 번호로 연락하고 친구를 통해 집에 찾아갈게.';

    const report = buildReunionReport(input);

    expect(report.safety.status).toBe('CONTACT_PROHIBITED');
    expect(report.contactWindows).toEqual([]);
    expect(report.messageReview.firstLine).toBe('');
    expect(report.messageReview.revisedMessage).toBe('');
  });

  it('removes compatibility weight entirely when partner birth evidence is unavailable', () => {
    const input = createReunionSampleInput();
    input.reunion.partnerBirthKnown = false;
    input.reunion.partnerBirthAccuracy = 'unknown';
    input.partner = undefined;
    const report = buildReunionReport(input);

    const withZero = buildReunionMetrics(input, report.evidence, 'CONTACT_ELIGIBLE', 0);
    const withHundred = buildReunionMetrics(input, report.evidence, 'CONTACT_ELIGIBLE', 100);

    expect(withZero.map((item) => [item.id, item.score]))
      .toEqual(withHundred.map((item) => [item.id, item.score]));
    expect(withZero.find((item) => item.id === 'readiness')?.evidenceIds)
      .toEqual(['behavior:readiness']);
    expect(withZero.find((item) => item.id === 'incoming-contact')?.evidenceIds)
      .not.toContain('saju:compatibility-overview');
  });

});
