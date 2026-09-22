import { describe, expect, it } from 'vitest';
import {
  buildReunionCompatibilityAxes,
  getReunionCompatibilityConclusions,
  getReunionCompatibilityFacts,
  parseCompatibilityBadge
} from './compatibilityAxes';
import { buildReunionCheckpoints, formatCheckpointTally, tallyReunionCheckpoints } from './checkpoints';
import { allowReunionPurchaseCta, buildReunionGate, isReunionRecordOnlyMode } from './gate';
import { buildReunionContactReadiness, daysBetween, formatReadinessTally, monthLuckMedian } from './readiness';
import { makeReunionContext, makeReunionSajuReport } from './testFixtures';
import {
  buildReunionCheckpointSuggestion,
  buildReunionTimeline,
  buildReunionYearTimeline
} from './timeline';

const REFERENCE = '2026-09-18T01:00:00.000Z';

describe('compatibility axes', () => {
  it('splits the engine badge into a direction and an evidence-confidence label', () => {
    expect(parseCompatibilityBadge('supportive · 근거 강함')).toEqual({
      direction: 'supportive',
      confidenceLabel: '근거 강함'
    });
    expect(parseCompatibilityBadge('insufficient · 판정 유보').direction).toBe('insufficient');
    expect(parseCompatibilityBadge(undefined)).toEqual({ direction: 'insufficient', confidenceLabel: '판정 유보' });
    expect(parseCompatibilityBadge('nonsense').direction).toBe('insufficient');
  });

  it('reads the four dimension cards that viewModel used to throw away', () => {
    const axes = buildReunionCompatibilityAxes(makeReunionSajuReport());
    expect(axes).toHaveLength(4);
    expect(axes.map((axis) => axis.label)).toEqual([
      '초기 끌림과 반응성',
      '감정 교류의 흐름',
      '표현과 의사소통',
      '관계 지속과 회복'
    ]);
    expect(axes[0].directionLabel).toBe('순함');
    expect(axes[0].directionIcon).toBe('↗');
    expect(axes[1].directionLabel).toBe('조건부');
  });

  it('never leaks the english identifiers onto the screen fields', () => {
    const axes = buildReunionCompatibilityAxes(makeReunionSajuReport());
    axes.forEach((axis) => {
      expect(['순함', '조건부', '부딪힘', '근거부족']).toContain(axis.directionLabel);
    });
  });

  it('withholds an axis instead of guessing when the engine says insufficient', () => {
    const axes = buildReunionCompatibilityAxes(
      makeReunionSajuReport({ expressionTendency: 'insufficient' })
    );
    const expression = axes[2];
    expect(expression.direction).toBe('insufficient');
    expect(expression.directionIcon).toBe('?');
    expect(expression.withheldReason).toContain('판단을 보류');
  });

  it('returns an empty set — not an invented one — when the section is missing', () => {
    const report = makeReunionSajuReport({ withCompatibility: false });
    expect(buildReunionCompatibilityAxes(report)).toEqual([]);
    expect(getReunionCompatibilityConclusions(report)).toEqual([]);
    expect(getReunionCompatibilityFacts(report)).toEqual([]);
  });

  it('keeps the four conclusion paragraphs and the fact details', () => {
    const report = makeReunionSajuReport();
    expect(getReunionCompatibilityConclusions(report)).toHaveLength(4);
    expect(getReunionCompatibilityFacts(report)).toHaveLength(2);
  });
});

describe('CH00 judgement gate', () => {
  it('defers on a hard condition no matter what the self check says', () => {
    const steady = { sleep: 'ok', meals: 'ok', routine: 'ok' } as const;
    expect(
      buildReunionGate({ context: makeReunionContext({ contactStatus: 'blocked' }), selfCheck: steady }).state
    ).toBe('deferred');
    expect(
      buildReunionGate({ context: makeReunionContext({ contactStatus: 'unknown' }), selfCheck: steady }).state
    ).toBe('deferred');
    expect(
      buildReunionGate({ context: makeReunionContext({ breakupDuration: 'under1m' }), selfCheck: steady }).state
    ).toBe('deferred');
  });

  it('defers on two or more unstable self-check answers', () => {
    const gate = buildReunionGate({
      context: makeReunionContext(),
      selfCheck: { sleep: 'unstable', meals: 'unstable', routine: 'ok' }
    });
    expect(gate.softSignals).toBe(2);
    expect(gate.state).toBe('deferred');
    expect(gate.hardReasons.join(' ')).toContain('수면·식사·일상');
  });

  it('stays open on one unstable answer', () => {
    const gate = buildReunionGate({
      context: makeReunionContext(),
      selfCheck: { sleep: 'unstable', meals: 'ok', routine: 'ok' }
    });
    expect(gate.state).toBe('ok');
    expect(gate.softSignals).toBe(1);
  });

  it('works with no self-check at all — the intake questions are not wired yet', () => {
    const gate = buildReunionGate({ context: makeReunionContext() });
    expect(gate.selfCheckAnswered).toBe(false);
    expect(gate.softSignals).toBe(0);
    expect(gate.state).toBe('ok');
  });

  it('flags harm signals from free text without labelling the reader', () => {
    const gate = buildReunionGate({
      context: makeReunionContext({ notes: '소리를 질러서 무서웠어요.' })
    });
    expect(gate.harmSignalDetected).toBe(true);
  });

  it('refuses the purchase CTA and drops to record-only when deferred', () => {
    const deferred = buildReunionGate({ context: makeReunionContext({ contactStatus: 'blocked' }) });
    expect(allowReunionPurchaseCta(deferred)).toBe(false);
    expect(isReunionRecordOnlyMode(deferred)).toBe(true);

    const open = buildReunionGate({ context: makeReunionContext() });
    expect(allowReunionPurchaseCta(open)).toBe(true);
    expect(isReunionRecordOnlyMode(open)).toBe(false);
  });
});

describe('CH03 contact readiness', () => {
  const report = makeReunionSajuReport();
  const axes = buildReunionCompatibilityAxes(report);

  it('counts exactly five conditions — not seven', () => {
    const readiness = buildReunionContactReadiness({
      context: makeReunionContext(),
      report,
      axes,
      gate: buildReunionGate({ context: makeReunionContext() }),
      referenceInstant: REFERENCE
    });
    expect(readiness.items).toHaveLength(5);
    expect(readiness.met + readiness.unmet + readiness.unknown).toBe(5);
    expect(readiness.items.map((item) => item.id)).toEqual([
      'no-refusal',
      'interval',
      'elapsed',
      'month-window',
      'expression-axis'
    ]);
  });

  it('formats the tally as a count, never as a probability', () => {
    const readiness = buildReunionContactReadiness({
      context: makeReunionContext(),
      report,
      axes,
      gate: buildReunionGate({ context: makeReunionContext() }),
      referenceInstant: REFERENCE
    });
    const tally = formatReadinessTally(readiness);
    expect(tally).toMatch(/^확인된 조건 \d · 아직 확인 안 됨 \d · 판단 보류 \d$/u);
    expect(tally).not.toContain('%');
  });

  it('marks the interval unknown when no last-contact date was given', () => {
    const context = makeReunionContext({ lastContactAt: undefined });
    const readiness = buildReunionContactReadiness({
      context,
      report,
      axes,
      gate: buildReunionGate({ context }),
      referenceInstant: REFERENCE
    });
    expect(readiness.items.find((item) => item.id === 'interval')?.state).toBe('unknown');
  });

  it('marks the expression condition unmet when that axis is tension', () => {
    const tense = makeReunionSajuReport({ expressionTendency: 'tension' });
    const readiness = buildReunionContactReadiness({
      context: makeReunionContext(),
      report: tense,
      axes: buildReunionCompatibilityAxes(tense),
      gate: buildReunionGate({ context: makeReunionContext() }),
      referenceInstant: REFERENCE
    });
    expect(readiness.items.find((item) => item.id === 'expression-axis')?.state).toBe('unmet');
  });

  it('withholds the whole gauge when blocked or deferred', () => {
    const context = makeReunionContext({ contactStatus: 'blocked' });
    const readiness = buildReunionContactReadiness({
      context,
      report,
      axes,
      gate: buildReunionGate({ context }),
      referenceInstant: REFERENCE
    });
    expect(readiness.withheld).toBe(true);
    expect(readiness.withheldReason).toContain('보류');
  });

  it('computes day gaps and the month-luck median from real values only', () => {
    expect(daysBetween('2026-08-20', REFERENCE)).toBe(29);
    expect(daysBetween(undefined, REFERENCE)).toBeNull();
    expect(monthLuckMedian(report.monthLuck)).toBe(5.5);
    expect(monthLuckMedian([])).toBeNull();
  });
});

describe('CH04 twelve-month map', () => {
  const report = makeReunionSajuReport();

  it('keeps all twelve cells and renames the score instead of inventing one', () => {
    const cells = buildReunionTimeline(report);
    expect(cells).toHaveLength(12);
    expect(cells.map((cell) => cell.score)).toEqual(report.monthLuck.map((item) => item.score));
  });

  it('splits labels at the 33rd and 67th percentile', () => {
    const cells = buildReunionTimeline(report);
    expect(cells.some((cell) => cell.label === 'open')).toBe(true);
    expect(cells.some((cell) => cell.label === 'hold')).toBe(true);
    expect(cells.some((cell) => cell.label === 'normal')).toBe(true);
  });

  it('calls every month normal when the scores have no spread', () => {
    const flat = makeReunionSajuReport();
    flat.monthLuck = flat.monthLuck.map((item) => ({ ...item, score: 5 }));
    expect(buildReunionTimeline(flat).every((cell) => cell.label === 'normal')).toBe(true);
  });

  it('attaches observable conditions to every open cell and none elsewhere', () => {
    buildReunionTimeline(report).forEach((cell) => {
      if (cell.label === 'open') expect(cell.conditions.length).toBeGreaterThanOrEqual(2);
      else expect(cell.conditions).toHaveLength(0);
    });
  });

  it('never puts the words 재회 or 연락 in a cell it generates', () => {
    const serialized = JSON.stringify(
      buildReunionTimeline(report).map((cell) => cell.conditions)
    );
    expect(serialized).not.toContain('재회');
    expect(serialized).not.toContain('연락');
  });

  it('returns an empty map rather than a fake one when there is no month luck', () => {
    const empty = makeReunionSajuReport();
    empty.monthLuck = [];
    expect(buildReunionTimeline(empty)).toEqual([]);
  });

  it('builds a separate five-year track for CH06', () => {
    const cells = buildReunionYearTimeline(report);
    expect(cells).toHaveLength(5);
    expect(cells[0].year).toBe(2026);
  });
});

describe('CH04 judgement deadline suggestion', () => {
  const report = makeReunionSajuReport();
  const timeline = buildReunionTimeline(report);

  it('proposes a range, never a single date', () => {
    const suggestion = buildReunionCheckpointSuggestion({
      context: makeReunionContext(),
      timeline,
      referenceInstant: REFERENCE
    });
    expect(suggestion).not.toBeNull();
    expect(new Date(suggestion!.toISO).getTime()).toBeGreaterThan(new Date(suggestion!.fromISO).getTime());
    expect(suggestion!.label).toMatch(/^\d{4}년 \d{1,2}월 ~ \d{4}년 \d{1,2}월$/u);
    expect(suggestion!.rationale).toContain('직접 정하시고');
  });

  it('starts later when the stretch the reader is in right now is a hold', () => {
    const holdFirst = timeline.map((cell, index) => ({ ...cell, label: index === 0 ? ('hold' as const) : cell.label }));
    const suggestion = buildReunionCheckpointSuggestion({
      /* 'active' 는 기본 창이 가장 짧아 보류 구간의 끝이 창 시작보다 뒤에 온다. */
      context: makeReunionContext({ contactStatus: 'active' }),
      timeline: holdFirst,
      referenceInstant: REFERENCE
    });
    expect(suggestion!.rationale).toContain('보류 쪽이라');
    expect(new Date(suggestion!.fromISO).getTime()).toBe(new Date(holdFirst[0].validTo!).getTime());
  });

  it('returns null — and the screen draws an empty input — with no reference instant', () => {
    expect(
      buildReunionCheckpointSuggestion({ context: makeReunionContext(), timeline, referenceInstant: null })
    ).toBeNull();
  });

  it('is deterministic for the same inputs', () => {
    const args = { context: makeReunionContext(), timeline, referenceInstant: REFERENCE };
    expect(buildReunionCheckpointSuggestion(args)).toEqual(buildReunionCheckpointSuggestion(args));
  });
});

describe('CH07 closing tally', () => {
  const report = makeReunionSajuReport();
  const axes = buildReunionCompatibilityAxes(report);
  const context = makeReunionContext();
  const gate = buildReunionGate({ context });
  const readiness = buildReunionContactReadiness({ context, report, axes, gate, referenceInstant: REFERENCE });
  const timeline = buildReunionTimeline(report);

  const baseInput = {
    context,
    gate,
    axes,
    readiness,
    timeline,
    yearCellCount: 5,
    hasNatalEvidence: true
  };

  it('produces exactly six checkpoints, one per chapter CH01..CH06', () => {
    const checkpoints = buildReunionCheckpoints(baseInput);
    expect(checkpoints).toHaveLength(6);
    expect(checkpoints.map((item) => item.chapter)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('never claims the partner chapter is confirmed — the mind is not calculable', () => {
    const partner = buildReunionCheckpoints(baseInput).find((item) => item.chapter === 2);
    expect(partner?.state).not.toBe('confirmed');
    expect(partner?.why).toBeTruthy();
  });

  it('adds up to six and reports the count as a sentence', () => {
    const checkpoints = buildReunionCheckpoints(baseInput);
    const tally = tallyReunionCheckpoints(checkpoints);
    expect(tally.confirmed + tally.unconfirmed + tally.deferred).toBe(6);
    expect(formatCheckpointTally(checkpoints)).toMatch(
      /^여섯 질문 중 지금 확인된 것 \d개, 아직 확인할 수 없는 것 \d개$/u
    );
  });

  it('defers CH03 onward for a deferred reader', () => {
    const deferredContext = makeReunionContext({ contactStatus: 'blocked' });
    const deferredGate = buildReunionGate({ context: deferredContext });
    const checkpoints = buildReunionCheckpoints({
      ...baseInput,
      context: deferredContext,
      gate: deferredGate
    });
    expect(checkpoints.filter((item) => item.chapter >= 3).every((item) => item.state === 'deferred')).toBe(true);
  });
});
