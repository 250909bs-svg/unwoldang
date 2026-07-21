import { describe, expect, it } from 'vitest';
import { getLoveReactionProfile } from './reactionProfiles';
import {
  buildLoveReadingReportPersonalization,
  LOVE_READING_PERSONALIZATION_CHAPTER_IDS,
  type LoveReadingReportPersonalizationContext
} from './reportPersonalization';

const baseContext: LoveReadingReportPersonalizationContext = {
  relationshipStatus: 'single',
  relationshipDuration: '',
  loveReaction: 'A',
  loveFocus: 'partner-type',
  chart: {
    dayMaster: '갑목',
    dayMasterElement: '목',
    strengthLabel: '중화',
    pillars: { day: '갑자' },
    helpfulElements: ['수', '목'],
    cautiousElements: ['금'],
    dominantTenGods: [
      { label: '편인', value: 22 },
      { label: '정관', value: 28 }
    ],
    monthLuck: [
      { year: 2026, month: 8, score: 71 },
      { year: 2026, month: 9, score: 55 }
    ],
    birthTimeKnown: true,
    calculationPrecision: 'exact-minute'
  }
};

describe('love-reading report personalization', () => {
  it('uses relationship, reaction, focus, and chart inputs in visible output', () => {
    const single = buildLoveReadingReportPersonalization(baseContext);
    const dating = buildLoveReadingReportPersonalization({
      ...baseContext,
      relationshipStatus: 'dating',
      relationshipDuration: 'under3',
      loveReaction: 'D',
      loveFocus: 'repeated-pattern',
      chart: {
        ...baseContext.chart,
        helpfulElements: ['토'],
        cautiousElements: ['수']
      }
    });

    expect(single.redFlags).not.toEqual(dating.redFlags);
    expect(single.greenFlags.join(' ')).toContain('도움 기운 수');
    expect(dating.redFlags.join(' ')).toContain('주의 기운 수');
    expect(dating.chapterCopyOverrides['relationship-status']?.interpretation)
      .toContain('연애 중 · 1년 이상 3년 이하');
    expect(dating.chapterCopyOverrides['repeated-attraction']?.interpretation)
      .toContain('반복 패턴');
  });

  it('uses the canonical reaction profile as the communication override', () => {
    const result = buildLoveReadingReportPersonalization({
      ...baseContext,
      loveReaction: 'C'
    });

    expect(result.chapterCopyOverrides['communication-pattern'])
      .toEqual(getLoveReactionProfile('C')?.chapterCopy);
  });

  it('builds one mission for each of four weeks in the 30-day plan', () => {
    const plan = buildLoveReadingReportPersonalization(baseContext).actionPlan;

    expect(plan.thirtyDays.map((mission) => mission.week)).toEqual([1, 2, 3, 4]);
    expect(plan.thirtyDays.every((mission) => mission.title && mission.task)).toBe(true);
    expect(plan.stop).toHaveLength(3);
    expect(plan.start).toHaveLength(3);
    expect(plan.check).toHaveLength(3);
  });

  it('keeps a presentation-only calculation basis for every chapter', () => {
    const map = buildLoveReadingReportPersonalization(baseContext)
      .calculationBasisByChapter;

    expect(Object.keys(map)).toEqual(LOVE_READING_PERSONALIZATION_CHAPTER_IDS);
    expect(map['attracted-partner'].map((item) => item.field))
      .toEqual(expect.arrayContaining([
        'chart.dayMaster',
        'chart.dayMasterElement',
        'chart.dominantTenGods',
        'loveReaction'
      ]));
    expect(map['lasting-partner'].map((item) => item.field))
      .toContain('chart.helpfulElements');
    expect(map['repeated-attraction'].map((item) => item.field))
      .toEqual(expect.arrayContaining(['loveReaction', 'loveFocus']));
    expect(map['relationship-flags'].map((item) => item.field))
      .toEqual(expect.arrayContaining([
        'relationshipStatus',
        'chart.helpfulElements',
        'chart.cautiousElements'
      ]));
    expect(map['twelve-month-timing'].find((item) => item.field === 'chart.monthLuck')?.value)
      .toBe('2026-8:71|2026-9:55');
    expect(map['action-plan'].map((item) => item.field))
      .toEqual(expect.arrayContaining([
        'relationshipStatus',
        'loveReaction',
        'loveFocus'
      ]));

    Object.values(map).flat().forEach((item) => {
      expect(item).not.toHaveProperty('id');
      expect(item).not.toHaveProperty('sourcePath');
      expect(item).not.toHaveProperty('immutable');
      expect(item).not.toHaveProperty('confidence');
      expect(item).not.toHaveProperty('description');
    });
    expect(map['attracted-partner'][0]).not.toBe(map['attraction-comparison'][0]);
  });

  it('shows customer labels instead of raw intake codes in calculation values', () => {
    const map = buildLoveReadingReportPersonalization({
      ...baseContext,
      relationshipStatus: 'dating',
      relationshipDuration: 'under3'
    }).calculationBasisByChapter;
    const intakeValues = Object.values(map)
      .flat()
      .filter((item) => item.kind === 'intake-answer')
      .map((item) => item.value);

    expect(intakeValues).toEqual(expect.arrayContaining([
      '연애 중',
      '1년 이상 3년 이하',
      '분위기를 먼저 지키는 완충형',
      '끌리는 타입과 오래 갈 타입'
    ]));
    expect(intakeValues.join(' ')).not.toMatch(/\b(?:dating|under3|partner-type|A)\b/);
  });

  it('does not mutate chart arrays while ranking calculated inputs', () => {
    const chart = {
      ...baseContext.chart,
      dominantTenGods: [
        { label: '편인', value: 22 },
        { label: '정관', value: 28 }
      ]
    };
    const before = JSON.stringify(chart);

    buildLoveReadingReportPersonalization({ ...baseContext, chart });

    expect(JSON.stringify(chart)).toBe(before);
  });

  it('keeps generated copy conditional about people and future events', () => {
    const result = buildLoveReadingReportPersonalization(baseContext);
    const narrative = [
      ...result.redFlags,
      ...result.greenFlags,
      ...Object.values(result.chapterCopyOverrides)
        .flatMap((copy) => copy ? Object.values(copy) : []),
      ...result.actionPlan.thirtyDays.map((mission) => mission.task)
    ].join(' ');

    expect(narrative).not.toMatch(/반드시|100%|미래가 확정|속마음은|마음이 분명해/);
    expect(narrative).toContain('확정하는 답이 아니라');
  });
});
