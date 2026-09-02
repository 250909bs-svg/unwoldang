import type { EarthlyBranch, HeavenlyStem, TenGodLabel } from '../constants';

export const INDEPENDENT_TABLE_SOURCE_IDS = {
  twelveStages: 'chen-twelve-stages-2021',
  hiddenStems: 'chen-twelve-stages-2021',
  tenGods: 'bazichic-reference-2017',
  relations: 'bazichic-reference-2017'
} as const;

export const stems: HeavenlyStem[] = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
export const branches: EarthlyBranch[] = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
export const twelveStageNames = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'] as const;

const twelveStageStarts: Record<HeavenlyStem, { branch: EarthlyBranch; forward: boolean }> = {
  갑: { branch: '해', forward: true },
  을: { branch: '오', forward: false },
  병: { branch: '인', forward: true },
  정: { branch: '유', forward: false },
  무: { branch: '인', forward: true },
  기: { branch: '유', forward: false },
  경: { branch: '사', forward: true },
  신: { branch: '자', forward: false },
  임: { branch: '신', forward: true },
  계: { branch: '묘', forward: false }
};

export function independentTwelveStage(stem: HeavenlyStem, branch: EarthlyBranch) {
  const config = twelveStageStarts[stem];
  const start = branches.indexOf(config.branch);
  const target = branches.indexOf(branch);
  const distance = config.forward
    ? (target - start + 12) % 12
    : (start - target + 12) % 12;
  return twelveStageNames[distance];
}

const stemElements = ['목', '목', '화', '화', '토', '토', '금', '금', '수', '수'] as const;
const produces: Record<(typeof stemElements)[number], (typeof stemElements)[number]> = {
  목: '화', 화: '토', 토: '금', 금: '수', 수: '목'
};
const controls: Record<(typeof stemElements)[number], (typeof stemElements)[number]> = {
  목: '토', 화: '금', 토: '수', 금: '목', 수: '화'
};

export function independentTenGod(dayStem: HeavenlyStem, targetStem: HeavenlyStem): TenGodLabel {
  const dayIndex = stems.indexOf(dayStem);
  const targetIndex = stems.indexOf(targetStem);
  const dayElement = stemElements[dayIndex];
  const targetElement = stemElements[targetIndex];
  const samePolarity = dayIndex % 2 === targetIndex % 2;
  if (dayElement === targetElement) return samePolarity ? '비견' : '겁재';
  if (produces[dayElement] === targetElement) return samePolarity ? '식신' : '상관';
  if (controls[dayElement] === targetElement) return samePolarity ? '편재' : '정재';
  if (controls[targetElement] === dayElement) return samePolarity ? '편관' : '정관';
  return samePolarity ? '편인' : '정인';
}

/** Order is residual/middle/main (여기·중기·본기); the last stem is canonical main qi. */
export const independentHiddenStems: Record<EarthlyBranch, HeavenlyStem[]> = {
  자: ['계'],
  축: ['계', '신', '기'],
  인: ['무', '병', '갑'],
  묘: ['을'],
  진: ['을', '계', '무'],
  사: ['무', '경', '병'],
  오: ['기', '정'],
  미: ['정', '을', '기'],
  신: ['무', '임', '경'],
  유: ['신'],
  술: ['신', '정', '무'],
  해: ['갑', '임']
};

export const independentStandardRelations = {
  stemCombination: ['갑기', '을경', '병신', '정임', '무계'],
  stemClash: ['갑경', '을신', '병임', '정계'],
  branchCombination: ['자축', '인해', '묘술', '진유', '사신', '오미'],
  branchClash: ['자오', '축미', '인신', '묘유', '진술', '사해'],
  branchBreak: ['자유', '축진', '인해', '묘오', '사신', '미술'],
  branchHarm: ['자미', '축오', '인사', '묘진', '신해', '유술']
} as const;
