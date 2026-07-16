import { describe, expect, it } from 'vitest';
import type { Bazi, GZ } from '../../types';
import {
  INTERPRETATION_ENGINE_VERSION,
  analyzeClimate,
  analyzeExpertInterpretation,
  analyzeHiddenStemSeasonality,
  analyzeMonthCommand,
  analyzeStemRoots
} from './index';

function makeBazi(
  year: GZ,
  month: GZ,
  day: GZ,
  hour: GZ | null
): Bazi {
  return {
    y_gz: year,
    m_gz: month,
    d_gz: day,
    h_gz: hour,
    solar: [1990, 1, 1],
    lunar_in: null,
    start_age: 5,
    forward: true,
    calculationBasis: {
      ipchun: '1990.02.04 11:00',
      isAfterIpchun: false
    }
  };
}

describe('expert interpretation v2 foundations', () => {
  it('distinguishes strict month command from seasonal support for different day masters', () => {
    const woodInSpring = makeBazi(
      { tg: 0, dz: 2 }, // 갑인
      { tg: 1, dz: 3 }, // 을묘
      { tg: 0, dz: 11 }, // 갑해
      { tg: 2, dz: 2 } // 병인
    );
    const fireInAutumn = makeBazi(
      { tg: 6, dz: 8 },
      { tg: 7, dz: 9 },
      { tg: 2, dz: 0 },
      { tg: 9, dz: 11 }
    );

    const spring = analyzeMonthCommand(woodInSpring);
    const autumn = analyzeMonthCommand(fireInAutumn);

    expect(spring.value.commandingElement).toBe('목');
    expect(spring.value.obtainsCommand).toBe(true);
    expect(spring.value.receivesSeasonalSupport).toBe(true);
    expect(autumn.value.commandingElement).toBe('금');
    expect(autumn.value.dayMasterElement).toBe('화');
    expect(autumn.value.obtainsCommand).toBe(false);
    expect(autumn.evidence.some((item) => item.kind === 'opposition')).toBe(true);
  });

  it('evaluates every visible stem root and preserves no-root evidence', () => {
    const deeplyRootedWood = makeBazi(
      { tg: 0, dz: 2 },
      { tg: 1, dz: 3 },
      { tg: 0, dz: 11 },
      { tg: 2, dz: 2 }
    );
    const rootlessFire = makeBazi(
      { tg: 6, dz: 8 },
      { tg: 7, dz: 9 },
      { tg: 2, dz: 0 },
      { tg: 9, dz: 11 }
    );

    const rootedProfiles = analyzeStemRoots(deeplyRootedWood).value;
    const rootlessProfiles = analyzeStemRoots(rootlessFire).value;
    const rootedDay = rootedProfiles.find((item) => item.pillar === 'day');
    const rootlessDay = rootlessProfiles.find((item) => item.pillar === 'day');

    expect(rootedProfiles).toHaveLength(4);
    expect(rootedDay?.rooted).toBe(true);
    expect(rootedDay?.level).toBe('strong');
    expect(rootedDay?.sources.some((source) => source.kind === 'same-stem')).toBe(true);
    expect(rootlessDay).toMatchObject({ rooted: false, level: 'none', score: 0 });
  });

  it('weights month hidden stems more than an identical year branch and normalizes contributions', () => {
    const repeatedTiger = makeBazi(
      { tg: 0, dz: 2 },
      { tg: 0, dz: 2 },
      { tg: 4, dz: 4 },
      { tg: 8, dz: 0 }
    );
    const result = analyzeHiddenStemSeasonality(repeatedTiger);
    const monthMain = result.value.contributions.find((item) => item.branchPosition === 'month' && item.role === 'main');
    const yearMain = result.value.contributions.find((item) => item.branchPosition === 'year' && item.role === 'main');
    const totalShare = result.value.contributions.reduce((sum, item) => sum + item.relativeShare, 0);

    expect(monthMain?.stem).toBe('갑');
    expect(yearMain?.stem).toBe('갑');
    expect(monthMain?.rawContribution ?? 0).toBeGreaterThan(yearMain?.rawContribution ?? 0);
    expect(totalShare).toBeCloseTo(1, 2);
    expect(result.caveats.join(' ')).toContain('사령일수');
  });

  it('separates cold-wet winter and hot-dry summer climate profiles', () => {
    const winterWater = makeBazi(
      { tg: 8, dz: 0 },
      { tg: 9, dz: 11 },
      { tg: 8, dz: 0 },
      { tg: 9, dz: 11 }
    );
    const summerFire = makeBazi(
      { tg: 2, dz: 6 },
      { tg: 3, dz: 5 },
      { tg: 2, dz: 6 },
      { tg: 3, dz: 5 }
    );

    const winter = analyzeClimate(winterWater).value;
    const summer = analyzeClimate(summerFire).value;

    expect(winter.temperature).toBe('cold');
    expect(winter.moisture).toBe('wet');
    expect(winter.needs.map((item) => item.element)).toEqual(expect.arrayContaining(['화', '토']));
    expect(summer.temperature).toBe('hot');
    expect(summer.moisture).toBe('dry');
    expect(summer.needs.map((item) => item.element)).toContain('수');
  });
});

describe('independent yongsin opinions and consensus', () => {
  it('always returns five independently identified methods with traceable metadata', () => {
    const chart = makeBazi(
      { tg: 6, dz: 10 },
      { tg: 6, dz: 0 },
      { tg: 0, dz: 6 },
      { tg: 6, dz: 8 }
    );
    const result = analyzeExpertInterpretation(chart);

    expect(result.yongsinOpinions.map((item) => item.method)).toEqual([
      'eokbu',
      'johu',
      'tonggwan',
      'byeongyak',
      'special'
    ]);
    result.yongsinOpinions.forEach((opinion) => {
      expect(opinion.ruleId).toMatch(/^MRE-V2-/);
      expect(opinion.version).toBe(INTERPRETATION_ENGINE_VERSION);
      expect(opinion.sourceNote.length).toBeGreaterThan(20);
      expect(opinion.confidence.score).toBeGreaterThanOrEqual(0);
      expect(opinion.confidence.score).toBeLessThanOrEqual(1);
      opinion.evidence.forEach((evidence) => {
        expect(evidence.ruleId).toBe(opinion.ruleId);
        expect(evidence.version).toBe(INTERPRETATION_ENGINE_VERSION);
      });
    });
  });

  it('preserves an eokbu-johu conflict instead of silently choosing one side', () => {
    const weakWoodInColdWetChart = makeBazi(
      { tg: 6, dz: 1 }, // 경축
      { tg: 6, dz: 0 }, // 경자
      { tg: 0, dz: 1 }, // 갑축
      { tg: 6, dz: 1 } // 경축
    );
    const result = analyzeExpertInterpretation(weakWoodInColdWetChart);
    const water = result.consensus.value.ranking.find((item) => item.element === '수');
    const waterConflict = result.consensus.value.conflicts.find(
      (item) => item.type === 'direct-opposition' && item.element === '수'
    );

    expect(result.yongsinOpinions.find((item) => item.method === 'eokbu')?.value.candidates.map((item) => item.element)).toContain('수');
    expect(result.yongsinOpinions.find((item) => item.method === 'johu')?.value.cautions.map((item) => item.element)).toContain('수');
    expect(water?.supporting.some((item) => item.method === 'eokbu')).toBe(true);
    expect(water?.opposing.some((item) => item.method === 'johu')).toBe(true);
    expect(waterConflict?.evidence.length).toBeGreaterThan(0);
    expect(result.consensus.value.unresolved).toBe(true);
    expect(result.consensus.caveats.join(' ')).toContain('확정 용신');
  });

  it('marks a rootless extreme chart only as a conditional special-pattern candidate', () => {
    const possibleFollower = makeBazi(
      { tg: 6, dz: 8 },
      { tg: 7, dz: 9 },
      { tg: 0, dz: 8 },
      { tg: 6, dz: 8 }
    );
    const result = analyzeExpertInterpretation(possibleFollower);
    const special = result.yongsinOpinions.find((item) => item.method === 'special');

    expect(special?.status).toBe('conditional');
    expect(special?.value.candidates.map((item) => item.element)).toContain('금');
    expect(special?.value.summary).toContain('후보');
    expect(special?.caveats.join(' ')).toContain('단독 결론');
    expect(result.consensus.value.summary).toContain('후보');
  });

  it('lowers foundational confidence and omits hour profiles when birth time is unknown', () => {
    const known = makeBazi(
      { tg: 0, dz: 2 },
      { tg: 1, dz: 3 },
      { tg: 0, dz: 11 },
      { tg: 2, dz: 2 }
    );
    const unknown = makeBazi(known.y_gz, known.m_gz, known.d_gz, null);
    const knownResult = analyzeExpertInterpretation(known);
    const unknownResult = analyzeExpertInterpretation(unknown);

    expect(unknownResult.foundations.roots.value).toHaveLength(3);
    expect(unknownResult.foundations.roots.confidence.score).toBeLessThan(knownResult.foundations.roots.confidence.score);
    expect(unknownResult.foundations.roots.confidence.limitations.join(' ')).toContain('출생 시각 미상');
  });
});
