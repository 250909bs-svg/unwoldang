import type { Bazi } from '../../types';
import type { BirthCalculationResult } from './calculate';

export type StableNatalSelection =
  | { status: 'full'; bazi: Bazi }
  | { status: 'partial'; bazi: Bazi; reason: string }
  | { status: 'blocked'; bazi: null; reason: string };

const coreKey = (bazi: Bazi) => [bazi.y_gz, bazi.m_gz, bazi.d_gz]
  .map((pillar) => `${pillar.tg}:${pillar.dz}`)
  .join('|');

/** Selects a natal chart without inventing a single hour for uncertain-time input. */
export function selectStableNatalBazi(calculation: BirthCalculationResult): StableNatalSelection {
  if (calculation.primary && calculation.context.time.precision === 'exact-minute') {
    return { status: 'full', bazi: calculation.primary.bazi };
  }

  const first = calculation.scenarios[0]?.bazi;
  if (!first) {
    return { status: 'blocked', bazi: null, reason: '검증 가능한 출생시간 시나리오가 없습니다.' };
  }

  const core = coreKey(first);
  if (!calculation.scenarios.every((scenario) => coreKey(scenario.bazi) === core)) {
    return {
      status: 'blocked',
      bazi: null,
      reason: '출생시간 시나리오에 따라 연주·월주·일주가 달라 단일 관계 분석을 만들 수 없습니다.'
    };
  }

  return {
    status: 'partial',
    bazi: { ...first, h_gz: null },
    reason: '출생시간을 확정하지 않아 시주 관계를 제외한 공통 원국만 사용했습니다.'
  };
}
