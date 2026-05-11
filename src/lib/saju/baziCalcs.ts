import {
  BRANCH_ELEM,
  CTRL_BY,
  DAY_BRANCH_DESCRIPTIONS,
  DAY_BRANCH_KEYWORDS,
  DAY_MASTER_DESCRIPTIONS,
  DAY_MASTER_KEYWORDS,
  DZ,
  ELEMENT,
  ELEM_CTRL,
  ELEM_NEXT,
  ELEM_PREV,
  HIDDEN_STEMS,
  MONTH_STRONG,
  TG,
  TIANYI,
  YANG_DZ_IDX,
  YANG_TG_IDX,
  ZODIAC_ANIMALS,
  type EarthlyBranch,
  type FiveElement,
  type HeavenlyStem,
  type TenGodLabel
} from './constants';
import { DayUtil } from './sxtwl';
import type { Bazi, DayunData, GZ, SeunData } from './types';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const YUNSEONG_STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'] as const;

const YUNSEONG_MAP: Record<HeavenlyStem, { startBranch: number; forward: boolean }> = {
  갑: { startBranch: 11, forward: true },
  을: { startBranch: 6, forward: false },
  병: { startBranch: 2, forward: true },
  정: { startBranch: 9, forward: false },
  무: { startBranch: 2, forward: true },
  기: { startBranch: 9, forward: false },
  경: { startBranch: 5, forward: true },
  신: { startBranch: 0, forward: false },
  임: { startBranch: 8, forward: true },
  계: { startBranch: 3, forward: false }
};

const TEN_GOD_ORDER = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'] as const;

function gzToString(gz: GZ): string {
  return `${TG[gz.tg]}${DZ[gz.dz]}`;
}

function isYangStem(index: number) {
  return YANG_TG_IDX.has(index);
}

function isYangBranch(index: number) {
  return YANG_DZ_IDX.has(index);
}

function getStemElement(index: number): FiveElement {
  return ELEMENT[TG[index]];
}

function getBranchElement(index: number): FiveElement {
  return BRANCH_ELEM[DZ[index]];
}

function formatElementList(elements: FiveElement[]) {
  return Array.from(new Set(elements)).join(', ');
}

export function formatKST(date: Date): string {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth() + 1;
  const day = kstDate.getUTCDate();
  const hours = kstDate.getUTCHours();
  const minutes = kstDate.getUTCMinutes();
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function calcBazi(
  year: number,
  month: number,
  day: number,
  hour: number | null,
  minute: number | null,
  calendar: 'solar' | 'lunar',
  leap: 'normal' | 'leap',
  gender: 'male' | 'female',
  timeCorrection: boolean
): Bazi {
  const dayUtil = new DayUtil(year, month, day, hour, minute, calendar, leap, timeCorrection);
  const d_gz = dayUtil.getDayGZ();
  const h_gz = hour === null ? null : dayUtil.getHourGZ(d_gz.tg);
  const { start_age, forward } = dayUtil.getDaeyunInfo(gender);
  const { ipchunDate, birthDateAfterIpchun } = dayUtil.getCalculationBasis();

  return {
    y_gz: dayUtil.getYearGZ(),
    m_gz: dayUtil.getMonthGZ(),
    d_gz,
    h_gz,
    solar: dayUtil.getSolarDateArray(),
    lunar_in: dayUtil.getLunarInputString(),
    start_age: Math.floor(start_age),
    forward,
    calculationBasis: {
      ipchun: formatKST(ipchunDate),
      isAfterIpchun: birthDateAfterIpchun
    }
  };
}

export function tenGod(dayTgIndex: number, otherTgIndex: number): TenGodLabel {
  const dayElement = getStemElement(dayTgIndex);
  const otherElement = getStemElement(otherTgIndex);
  const samePolarity = isYangStem(dayTgIndex) === isYangStem(otherTgIndex);

  if (dayElement === otherElement) return samePolarity ? '비견' : '겁재';
  if (ELEM_NEXT[dayElement] === otherElement) return samePolarity ? '식신' : '상관';
  if (ELEM_CTRL[dayElement] === otherElement) return samePolarity ? '편재' : '정재';
  if (CTRL_BY[dayElement] === otherElement) return samePolarity ? '편관' : '정관';
  return samePolarity ? '편인' : '정인';
}

export function tenGodFromBranch(dayTgIndex: number, branchIndex: number): TenGodLabel {
  const dayElement = getStemElement(dayTgIndex);
  const otherElement = getBranchElement(branchIndex);
  const samePolarity = isYangStem(dayTgIndex) === isYangBranch(branchIndex);

  if (dayElement === otherElement) return samePolarity ? '비견' : '겁재';
  if (ELEM_NEXT[dayElement] === otherElement) return samePolarity ? '식신' : '상관';
  if (ELEM_CTRL[dayElement] === otherElement) return samePolarity ? '편재' : '정재';
  if (CTRL_BY[dayElement] === otherElement) return samePolarity ? '편관' : '정관';
  return samePolarity ? '편인' : '정인';
}

export function getGyeokguk(bazi: Bazi): string {
  const monthBranch = DZ[bazi.m_gz.dz];
  const hiddenStems = HIDDEN_STEMS[monthBranch] || [];

  if (hiddenStems.length === 0) {
    return '격국 판단이 어려운 구조';
  }

  const mainHiddenStemIndex = hiddenStems[hiddenStems.length - 1];
  const god = tenGod(bazi.d_gz.tg, mainHiddenStemIndex);

  if (god === '비견') return '건록격';
  if (god === '겁재') return '양인격';
  return `${god}격`;
}

export function getTwelveYunseong(dayMasterTg: number, branchDz: number) {
  const stem = TG[dayMasterTg];
  const config = YUNSEONG_MAP[stem];
  let diff = branchDz - config.startBranch;

  if (config.forward) {
    if (diff < 0) diff += 12;
  } else {
    diff = -diff;
    if (diff < 0) diff += 12;
  }

  return YUNSEONG_STAGES[diff % 12];
}

export function tenGodDistribution(bazi: Bazi): Record<TenGodLabel, number> {
  const distribution = Object.fromEntries(TEN_GOD_ORDER.map((label) => [label, 0])) as Record<TenGodLabel, number>;
  const pillars: Array<GZ | null> = [bazi.y_gz, bazi.m_gz, bazi.d_gz, bazi.h_gz];

  for (const pillar of pillars) {
    if (!pillar) continue;

    if (pillar !== bazi.d_gz) {
      const label = tenGod(bazi.d_gz.tg, pillar.tg);
      distribution[label] += 1;
    }

    for (const hiddenStem of HIDDEN_STEMS[DZ[pillar.dz]] || []) {
      const label = tenGod(bazi.d_gz.tg, hiddenStem);
      distribution[label] += 1;
    }
  }

  return distribution;
}

export function daymasterStrength(bazi: Bazi): [number, string, string[]] {
  const dayMasterElement = getStemElement(bazi.d_gz.tg);
  const supportElement = ELEM_PREV[dayMasterElement];
  const allySet = new Set<FiveElement>([dayMasterElement, supportElement]);

  let allyPower = 1;
  let opponentPower = 0;
  const reasons: string[] = [];

  const weights = {
    monthBranch: 4,
    dayBranch: 2,
    otherBranch: 1.5,
    stem: 1.5,
    hiddenMain: 1
  };

  const pillars: Array<GZ | null> = [bazi.y_gz, bazi.m_gz, bazi.d_gz, bazi.h_gz];

  pillars.forEach((pillar, index) => {
    if (!pillar) return;

    if (index !== 2) {
      const stemElement = getStemElement(pillar.tg);
      if (allySet.has(stemElement)) allyPower += weights.stem;
      else opponentPower += weights.stem;
    }

    const branchElement = getBranchElement(pillar.dz);
    const branchWeight = index === 1 ? weights.monthBranch : index === 2 ? weights.dayBranch : weights.otherBranch;

    if (allySet.has(branchElement)) allyPower += branchWeight;
    else opponentPower += branchWeight;

    const hiddenStems = HIDDEN_STEMS[DZ[pillar.dz]];
    if (!hiddenStems?.length) return;

    const mainHiddenStem = hiddenStems[hiddenStems.length - 1];
    const hiddenElement = getStemElement(mainHiddenStem);

    if (hiddenElement === branchElement) return;

    if (allySet.has(hiddenElement)) allyPower += weights.hiddenMain;
    else opponentPower += weights.hiddenMain;
  });

  const total = allyPower + opponentPower;
  const ratio = total === 0 ? 0.5 : allyPower / total;
  let label = '중화';

  if (ratio > 0.8) label = '극신강';
  else if (ratio > 0.65) label = '신강';
  else if (ratio > 0.55) label = '약간 신강';
  else if (ratio >= 0.45) label = '중화';
  else if (ratio >= 0.35) label = '약간 신약';
  else if (ratio >= 0.2) label = '신약';
  else label = '극신약';

  reasons.push(`비겁·인성 계열 힘 ${allyPower.toFixed(1)} / 재성·관성·식상 계열 힘 ${opponentPower.toFixed(1)}`);
  reasons.push(`월지의 계절 기운은 ${MONTH_STRONG[DZ[bazi.m_gz.dz]]}에 치우쳐 있습니다.`);

  return [ratio, label, reasons];
}

export function usefulElements(dayMasterElement: FiveElement, strengthLabel: string): [FiveElement[], FiveElement[]] {
  let helpful: FiveElement[] = [];
  let cautious: FiveElement[] = [];

  if (['약간 신강', '신강', '극신강'].includes(strengthLabel)) {
    helpful = [ELEM_NEXT[dayMasterElement], ELEM_CTRL[dayMasterElement], CTRL_BY[dayMasterElement]];
    cautious = [dayMasterElement, ELEM_PREV[dayMasterElement]];
  } else if (['약간 신약', '신약', '극신약'].includes(strengthLabel)) {
    helpful = [dayMasterElement, ELEM_PREV[dayMasterElement]];
    cautious = [ELEM_NEXT[dayMasterElement], ELEM_CTRL[dayMasterElement], CTRL_BY[dayMasterElement]];
  } else {
    helpful = [ELEM_PREV[dayMasterElement], ELEM_NEXT[dayMasterElement]];
    cautious = [CTRL_BY[dayMasterElement]];
  }

  return [Array.from(new Set(helpful)), Array.from(new Set(cautious))];
}

export function detectShensha(branches: EarthlyBranch[], dayTg: HeavenlyStem, dayDz: EarthlyBranch): Record<string, string> {
  const present = new Set(branches);
  const result: Record<string, string> = {};

  const tianyis = TIANYI[dayTg];
  const foundTianyis = Array.from(tianyis).filter((branch) => present.has(branch));
  if (foundTianyis.length > 0) {
    result['천을귀인'] = `${foundTianyis.join(', ')} 기운이 살아 있어 어려울 때 도와주는 사람, 제도, 기회가 들어오기 쉬운 편입니다. 혼자 버티기보다 도움을 요청할수록 운이 열립니다.`;
  }

  const dohwaTarget =
    ['신', '자', '진'].includes(dayDz) ? '유' :
    ['인', '오', '술'].includes(dayDz) ? '묘' :
    ['사', '유', '축'].includes(dayDz) ? '오' :
    '자';

  if (present.has(dohwaTarget as EarthlyBranch)) {
    result['도화'] = `${dohwaTarget} 도화가 살아 있어 매력, 시선 집중, 인간관계의 흡인력이 강합니다. 사랑과 인기의 운이 되기도 하지만 감정 소모가 커질 때는 선을 분명히 긋는 태도가 필요합니다.`;
  }

  if (['경진', '경술', '무진', '무술', '임진', '임술'].includes(`${dayTg}${dayDz}`)) {
    result['괴강'] = '괴강 기운은 결단력과 카리스마를 크게 키워줍니다. 중요한 승부처에서는 강점이 되지만, 관계에서는 너무 단호하게 들리지 않도록 완급 조절이 필요합니다.';
  }

  return result;
}

export function fiveElementDistribution(y_gz: GZ, m_gz: GZ, d_gz: GZ, h_gz: GZ | null): Record<FiveElement, number> {
  const distribution: Record<FiveElement, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const pillars = [y_gz, m_gz, d_gz, ...(h_gz ? [h_gz] : [])];

  for (const pillar of pillars) {
    distribution[getStemElement(pillar.tg)] += 1;
    distribution[getBranchElement(pillar.dz)] += 1;
  }

  return distribution;
}

function scoreLuckByElements(
  stemElement: FiveElement,
  branchElement: FiveElement,
  helpfulElements: FiveElement[],
  cautiousElements: FiveElement[]
) {
  let score = 5;
  if (helpfulElements.includes(stemElement)) score += 2;
  if (helpfulElements.includes(branchElement)) score += 2;
  if (cautiousElements.includes(stemElement)) score -= 1.5;
  if (cautiousElements.includes(branchElement)) score -= 1.5;
  return Math.max(1, Math.min(10, Math.round(score)));
}

export function dayunRows(bazi: Bazi): DayunData[] {
  const rows: DayunData[] = [];
  let tg = bazi.m_gz.tg;
  let dz = bazi.m_gz.dz;
  const dayMasterElement = getStemElement(bazi.d_gz.tg);
  const [, strengthLabel] = daymasterStrength(bazi);
  const [helpfulElements, cautiousElements] = usefulElements(dayMasterElement, strengthLabel);
  const step = (stem: number, branch: number, forward: boolean) => (forward ? [(stem + 1) % 10, (branch + 1) % 12] : [(stem + 9) % 10, (branch + 11) % 12]);

  for (let index = 1; index <= 10; index += 1) {
    [tg, dz] = step(tg, dz, bazi.forward);
    const currentAge = bazi.start_age + (index - 1) * 10;
    rows.push({
      period: index,
      age: `${currentAge}세 ~ ${currentAge + 9}세`,
      year: bazi.solar[0] + currentAge - 1,
      ganzhi: `${TG[tg]}${DZ[dz]}`,
      tenGod: `${tenGod(bazi.d_gz.tg, tg)} / ${tenGodFromBranch(bazi.d_gz.tg, dz)}`,
      luckStrength: scoreLuckByElements(getStemElement(tg), getBranchElement(dz), helpfulElements, cautiousElements)
    });
  }

  return rows;
}

export function seunRows(startYear: number, count = 12): SeunData[] {
  const rows: SeunData[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const year = startYear + offset;
    const tg = ((year - 4) % 10 + 10) % 10;
    const dz = ((year - 4) % 12 + 12) % 12;
    rows.push({
      year,
      ganzhi: gzToString({ tg, dz }),
      note: ''
    });
  }
  return rows;
}

export function getZodiacAnimal(yearPillar: GZ) {
  return ZODIAC_ANIMALS[yearPillar.dz];
}

export function getPillarLabels(bazi: Bazi) {
  return {
    year: gzToString(bazi.y_gz),
    month: gzToString(bazi.m_gz),
    day: gzToString(bazi.d_gz),
    hour: bazi.h_gz ? gzToString(bazi.h_gz) : null
  };
}

export function describeDayMaster(stem: HeavenlyStem) {
  return {
    keywords: DAY_MASTER_KEYWORDS[stem],
    description: DAY_MASTER_DESCRIPTIONS[stem]
  };
}

export function describeDayBranch(branch: EarthlyBranch) {
  return {
    keywords: DAY_BRANCH_KEYWORDS[branch],
    description: DAY_BRANCH_DESCRIPTIONS[branch]
  };
}

export function getDayMasterElement(stemIndex: number) {
  return getStemElement(stemIndex);
}

export function getBirthSummary(bazi: Bazi) {
  return `${bazi.solar[0]}.${String(bazi.solar[1]).padStart(2, '0')}.${String(bazi.solar[2]).padStart(2, '0')} / ${bazi.lunar_in || '양력 기준'} / 입춘 ${bazi.calculationBasis.isAfterIpchun ? '이후' : '이전'} 계산`;
}

export function getDominantTenGod(distribution: Record<TenGodLabel, number>) {
  return [...Object.entries(distribution)]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label]) => label as TenGodLabel);
}

export function summarizeStrength(dayMasterElement: FiveElement, strengthLabel: string, helpful: FiveElement[], cautious: FiveElement[]) {
  return `일간은 ${dayMasterElement} 기운이며 현재 구조는 ${strengthLabel} 쪽으로 읽힙니다. 도움이 되는 오행은 ${formatElementList(helpful)}, 과해지면 균형을 무너뜨릴 수 있는 오행은 ${formatElementList(cautious)}입니다.`;
}
