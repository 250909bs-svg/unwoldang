import {
  CTRL_BY,
  DZ,
  ELEMENT,
  ELEM_CTRL,
  ELEM_NEXT,
  MONTH_STRONG,
  TG,
  type FiveElement
} from '../../constants';
import type { Bazi, GZ } from '../../types';
import {
  BRANCH_CLIMATE,
  BRANCH_SEASON,
  HIDDEN_QI,
  PILLAR_ORDER,
  PILLAR_PATH,
  POSITION_WEIGHT,
  RULES,
  STEM_CLIMATE,
  clamp,
  emptyElementRecord,
  makeConfidence,
  makeEvidence,
  round
} from './rules';
import type {
  ClimateNeed,
  ClimateProfile,
  ElementPowerProfile,
  ExposureAnalysis,
  HiddenStemContribution,
  HiddenStemSeasonality,
  InterpretationFoundations,
  MonthCommandProfile,
  PillarPosition,
  RuleResult,
  StemRootProfile
} from './types';

interface PositionedPillar {
  position: PillarPosition;
  gz: GZ;
}

function getPillars(bazi: Bazi): PositionedPillar[] {
  const values: Record<PillarPosition, GZ | null> = {
    year: bazi.y_gz,
    month: bazi.m_gz,
    day: bazi.d_gz,
    hour: bazi.h_gz
  };

  return PILLAR_ORDER.flatMap((position) => {
    const gz = values[position];
    return gz ? [{ position, gz }] : [];
  });
}

function seasonalRelation(monthElement: FiveElement, target: FiveElement): MonthCommandProfile['relation'] {
  if (monthElement === target) return 'same';
  if (ELEM_NEXT[monthElement] === target) return 'produced-by-season';
  if (ELEM_NEXT[target] === monthElement) return 'produces-season';
  if (ELEM_CTRL[monthElement] === target) return 'controlled-by-season';
  return 'controls-season';
}

function seasonalAffinity(monthElement: FiveElement, target: FiveElement): number {
  const relation = seasonalRelation(monthElement, target);
  if (relation === 'same') return 1.25;
  if (relation === 'produced-by-season') return 1.08;
  if (relation === 'produces-season') return 0.92;
  if (relation === 'controlled-by-season') return 0.68;
  return 0.82;
}

export function analyzeMonthCommand(bazi: Bazi): RuleResult<MonthCommandProfile> {
  const rule = RULES.monthCommand;
  const monthBranch = DZ[bazi.m_gz.dz];
  const commandingElement = MONTH_STRONG[monthBranch];
  const dayMaster = TG[bazi.d_gz.tg];
  const dayMasterElement = ELEMENT[dayMaster];
  const relation = seasonalRelation(commandingElement, dayMasterElement);
  const obtainsCommand = relation === 'same';
  const receivesSeasonalSupport = obtainsCommand || relation === 'produced-by-season';
  const evidence = [
    makeEvidence(
      rule,
      'month-branch-command',
      obtainsCommand ? 'support' : 'context',
      `${monthBranch}월의 주왕 오행은 ${commandingElement}이며 일간 ${dayMaster}의 오행은 ${dayMasterElement}다.`,
      1,
      ['bazi.m_gz.dz', 'bazi.d_gz.tg']
    ),
    makeEvidence(
      rule,
      'strict-command-definition',
      obtainsCommand ? 'support' : 'opposition',
      obtainsCommand
        ? '월령 오행과 일간 오행이 같아 이 규칙의 엄격한 의미에서 득령으로 기록한다.'
        : '월령 오행과 일간 오행이 다르므로 득령으로 단정하지 않는다. 생조 여부는 별도 항목이다.',
      obtainsCommand ? 0.9 : 0.75,
      ['bazi.m_gz.dz', 'bazi.d_gz.tg']
    )
  ];

  return {
    ...rule,
    status: 'supported',
    value: {
      monthBranch,
      season: BRANCH_SEASON[monthBranch],
      commandingElement,
      dayMaster,
      dayMasterElement,
      obtainsCommand,
      receivesSeasonalSupport,
      relation
    },
    confidence: makeConfidence(0.94, ['월지와 일간의 오행 관계를 직접 비교했다.']),
    evidence,
    caveats: ['득령 하나만으로 신강·신약이나 용신을 확정하지 않는다.']
  };
}

export function analyzeStemRoots(bazi: Bazi): RuleResult<StemRootProfile[]> {
  const rule = RULES.roots;
  const pillars = getPillars(bazi);
  const monthElement = MONTH_STRONG[DZ[bazi.m_gz.dz]];

  const profiles = pillars.map(({ position, gz }) => {
    const stem = TG[gz.tg];
    const element = ELEMENT[stem];
    const sources = pillars.flatMap(({ position: branchPosition, gz: branchGz }) => {
      const branch = DZ[branchGz.dz];
      return HIDDEN_QI[branch].flatMap((hidden) => {
        const hiddenElement = ELEMENT[hidden.stem];
        if (hiddenElement !== element) return [];
        const exactFactor = hidden.stem === stem ? 1 : 0.62;
        const score = hidden.weight * POSITION_WEIGHT[branchPosition] * seasonalAffinity(monthElement, hiddenElement) * exactFactor;
        return [{
          branchPosition,
          branch,
          hiddenStem: hidden.stem,
          hiddenRole: hidden.role,
          kind: hidden.stem === stem ? 'same-stem' as const : 'same-element' as const,
          score: round(score)
        }];
      });
    }).sort((left, right) => right.score - left.score);
    const score = round(clamp(sources.reduce((sum, source) => sum + source.score, 0) / 1.4));
    const level = sources.length === 0 ? 'none' : score < 0.35 ? 'weak' : score < 0.7 ? 'moderate' : 'strong';

    return {
      pillar: position,
      stem,
      element,
      rooted: sources.length > 0,
      level,
      score,
      sources
    } satisfies StemRootProfile;
  });

  const evidence = profiles.map((profile) => makeEvidence(
    rule,
    `${profile.pillar}-${profile.stem}`,
    profile.rooted ? 'support' : 'opposition',
    profile.rooted
      ? `${profile.pillar} 천간 ${profile.stem}은(는) 지지 지장간에서 ${profile.level} 수준의 뿌리 후보 ${profile.sources.length}개가 확인된다.`
      : `${profile.pillar} 천간 ${profile.stem}과(와) 같은 오행의 지장간이 없어 무근 후보로 기록한다.`,
    profile.rooted ? Math.max(0.35, profile.score) : 0.7,
    [PILLAR_PATH[profile.pillar], ...profile.sources.map((source) => `${PILLAR_PATH[source.branchPosition]}.dz`)]
  ));

  return {
    ...rule,
    status: 'supported',
    value: profiles,
    confidence: makeConfidence(
      bazi.h_gz ? 0.74 : 0.64,
      ['모든 겉 천간을 모든 지지의 지장간과 대조했다.'],
      bazi.h_gz ? [] : ['출생 시각 미상으로 시주의 뿌리를 평가할 수 없다.']
    ),
    evidence,
    caveats: [
      '통근 점수는 비교와 설명을 위한 휴리스틱이며 학파별 왕쇠 배점과 동일하지 않다.',
      '합충으로 뿌리가 손상되거나 강화되는 조건은 이 단계에 포함하지 않는다.'
    ]
  };
}

export function analyzeExposures(bazi: Bazi): RuleResult<ExposureAnalysis> {
  const rule = RULES.exposure;
  const pillars = getPillars(bazi);
  const visibleStems = pillars.map(({ position, gz }) => {
    const stem = TG[gz.tg];
    const sources = pillars.flatMap(({ position: branchPosition, gz: branchGz }) => {
      const branch = DZ[branchGz.dz];
      return HIDDEN_QI[branch]
        .filter((hidden) => hidden.stem === stem)
        .map((hidden) => ({ branchPosition, branch, hiddenRole: hidden.role }));
    });
    return { pillar: position, stem, exposedFromHidden: sources.length > 0, sources };
  });
  const hiddenStems = pillars.flatMap(({ position: branchPosition, gz }) => {
    const branch = DZ[gz.dz];
    return HIDDEN_QI[branch].map((hidden) => ({
      branchPosition,
      branch,
      hiddenStem: hidden.stem,
      hiddenRole: hidden.role,
      exposedBy: visibleStems.filter((visible) => visible.stem === hidden.stem).map((visible) => visible.pillar)
    }));
  });
  const evidence = visibleStems.map((profile) => makeEvidence(
    rule,
    `${profile.pillar}-${profile.stem}`,
    profile.exposedFromHidden ? 'support' : 'context',
    profile.exposedFromHidden
      ? `${profile.pillar} 천간 ${profile.stem}은(는) ${profile.sources.map((source) => source.branchPosition).join('·')} 지지의 지장간과 일치해 투간 연결이 있다.`
      : `${profile.pillar} 천간 ${profile.stem}과(와) 정확히 일치하는 지장간은 확인되지 않는다.`,
    profile.exposedFromHidden ? 0.75 : 0.45,
    [PILLAR_PATH[profile.pillar], ...profile.sources.map((source) => `${PILLAR_PATH[source.branchPosition]}.dz`)]
  ));

  return {
    ...rule,
    status: 'supported',
    value: { visibleStems, hiddenStems },
    confidence: makeConfidence(
      bazi.h_gz ? 0.9 : 0.76,
      ['천간과 지장간의 글자 일치를 전수 대조했다.'],
      bazi.h_gz ? [] : ['출생 시각 미상으로 시주 투간 여부가 제외됐다.']
    ),
    evidence,
    caveats: ['투간 사실과 투간한 글자의 실제 유효성·청탁·합화 성립은 같은 판단이 아니다.']
  };
}

export function analyzeHiddenStemSeasonality(bazi: Bazi): RuleResult<HiddenStemSeasonality> {
  const rule = RULES.hiddenSeasonality;
  const pillars = getPillars(bazi);
  const monthElement = MONTH_STRONG[DZ[bazi.m_gz.dz]];
  const base = pillars.flatMap(({ position, gz }) => {
    const branch = DZ[gz.dz];
    return HIDDEN_QI[branch].map((hidden) => {
      const element = ELEMENT[hidden.stem];
      const affinity = seasonalAffinity(monthElement, element);
      const rawContribution = hidden.weight * POSITION_WEIGHT[position] * affinity;
      return {
        branchPosition: position,
        branch,
        stem: hidden.stem,
        element,
        role: hidden.role,
        intrinsicWeight: hidden.weight,
        positionWeight: POSITION_WEIGHT[position],
        seasonalAffinity: affinity,
        rawContribution,
        relativeShare: 0
      };
    });
  });
  const total = base.reduce((sum, item) => sum + item.rawContribution, 0) || 1;
  const contributions: HiddenStemContribution[] = base.map((item) => ({
    ...item,
    rawContribution: round(item.rawContribution),
    relativeShare: round(item.rawContribution / total)
  }));
  const elementShares = emptyElementRecord();
  contributions.forEach((item) => {
    elementShares[item.element] += item.relativeShare;
  });
  Object.keys(elementShares).forEach((key) => {
    const element = key as FiveElement;
    elementShares[element] = round(elementShares[element]);
  });
  const monthItems = contributions.filter((item) => item.branchPosition === 'month');
  const evidence = [
    makeEvidence(
      rule,
      'month-hidden-qi',
      'support',
      `월지 지장간 ${monthItems.map((item) => `${item.stem}(${item.role})`).join('·')}에 월령 자리와 계절 친화 가중치를 적용했다.`,
      0.85,
      ['bazi.m_gz.dz']
    ),
    makeEvidence(
      rule,
      'relative-share-limitation',
      'limitation',
      '기여도는 명식 내부 비교를 위한 상대값이며 기운의 절대량을 뜻하지 않는다.',
      0.9,
      PILLAR_ORDER.filter((position) => position !== 'hour' || bazi.h_gz !== null).map((position) => `${PILLAR_PATH[position]}.dz`)
    )
  ];

  return {
    ...rule,
    status: 'supported',
    value: { monthElement, contributions, elementShares },
    confidence: makeConfidence(
      bazi.h_gz ? 0.72 : 0.62,
      ['정기·중기·여기와 월지 중심의 자리 가중치를 명시적으로 적용했다.'],
      bazi.h_gz ? [] : ['시주 지장간이 없어 전체 기여도는 조건부다.']
    ),
    evidence,
    caveats: ['사령일수에 따른 월지 지장간 교대는 출생 절입 후 경과일 데이터가 추가되기 전까지 반영하지 않는다.']
  };
}

export function analyzeElementPower(
  bazi: Bazi,
  hiddenResult = analyzeHiddenStemSeasonality(bazi)
): RuleResult<ElementPowerProfile> {
  const rule = RULES.elementPower;
  const raw = emptyElementRecord();
  const stemWeight: Record<PillarPosition, number> = { year: 0.85, month: 1.05, day: 1, hour: 0.85 };
  getPillars(bazi).forEach(({ position, gz }) => {
    raw[ELEMENT[TG[gz.tg]]] += stemWeight[position];
  });
  hiddenResult.value.contributions.forEach((item) => {
    raw[item.element] += item.rawContribution;
  });
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
  const shares = emptyElementRecord();
  (Object.keys(raw) as FiveElement[]).forEach((element) => {
    const unrounded = raw[element];
    raw[element] = round(unrounded);
    shares[element] = round(unrounded / total);
  });
  const max = Math.max(...Object.values(shares));
  const min = Math.min(...Object.values(shares));
  const dominant = (Object.keys(shares) as FiveElement[]).filter((element) => shares[element] >= max - 0.025);
  const scarce = (Object.keys(shares) as FiveElement[]).filter((element) => shares[element] <= Math.max(0.08, min + 0.015));
  const evidence = [
    makeEvidence(
      rule,
      'dominant-elements',
      'context',
      `계절 보정 비교에서 ${dominant.join('·')} 기운이 상대적으로 가장 크다(${dominant.map((element) => `${element} ${Math.round(shares[element] * 100)}%`).join(', ')}).`,
      0.7,
      ['bazi', hiddenResult.ruleId]
    ),
    makeEvidence(
      rule,
      'scarce-not-yongsin',
      'limitation',
      `${scarce.join('·')}의 상대 비중이 낮지만 결핍만으로 용신이라고 판정하지 않는다.`,
      0.85,
      ['bazi', hiddenResult.ruleId]
    )
  ];

  return {
    ...rule,
    status: 'supported',
    value: { raw, shares, dominant, scarce },
    confidence: makeConfidence(
      bazi.h_gz ? 0.72 : 0.62,
      ['겉 천간과 지장간 기여를 분리한 뒤 합산했다.'],
      bazi.h_gz ? [] : ['시주 미상으로 오행 상대 비중이 바뀔 수 있다.']
    ),
    evidence,
    caveats: ['합·충·형에 따른 오행 변화와 합화 성립은 아직 이 수치에 반영하지 않는다.']
  };
}

function pushClimateNeeds(needs: ClimateNeed[], heat: number, moisture: number) {
  if (heat <= -0.28) {
    needs.push(
      { element: '화', score: round(0.62 + Math.abs(heat) * 0.32), axis: 'temperature', rationale: '차가운 편향을 덥히는 후보' },
      { element: '목', score: round(0.32 + Math.abs(heat) * 0.2), axis: 'temperature', rationale: '화의 지속을 돕는 보조 후보' }
    );
  } else if (heat >= 0.28) {
    needs.push(
      { element: '수', score: round(0.62 + Math.abs(heat) * 0.32), axis: 'temperature', rationale: '뜨거운 편향을 식히는 후보' },
      { element: '금', score: round(0.3 + Math.abs(heat) * 0.18), axis: 'temperature', rationale: '수를 생하는 보조 후보' }
    );
  }

  if (moisture <= -0.25) {
    needs.push(
      { element: '수', score: round(0.6 + Math.abs(moisture) * 0.3), axis: 'moisture', rationale: '건조한 편향을 적시는 후보' },
      { element: '목', score: round(0.3 + Math.abs(moisture) * 0.18), axis: 'moisture', rationale: '수분의 생동을 이어가는 보조 후보' }
    );
  } else if (moisture >= 0.25) {
    needs.push(
      { element: '토', score: round(0.58 + Math.abs(moisture) * 0.28), axis: 'moisture', rationale: '과습한 흐름을 머금고 정리하는 후보' },
      { element: '화', score: round(0.38 + Math.abs(moisture) * 0.18), axis: 'moisture', rationale: '습기를 덥혀 순환시키는 보조 후보' }
    );
  }
}

export function analyzeClimate(bazi: Bazi): RuleResult<ClimateProfile> {
  const rule = RULES.climate;
  const branchWeight: Record<PillarPosition, number> = { year: 0.12, month: 0.42, day: 0.18, hour: 0.12 };
  const stemWeight: Record<PillarPosition, number> = { year: 0.04, month: 0.04, day: 0.04, hour: 0.04 };
  let heat = 0;
  let moisture = 0;
  let weight = 0;
  getPillars(bazi).forEach(({ position, gz }) => {
    const branchClimate = BRANCH_CLIMATE[DZ[gz.dz]];
    const stemClimate = STEM_CLIMATE[TG[gz.tg]];
    heat += branchClimate.heat * branchWeight[position] + stemClimate.heat * stemWeight[position];
    moisture += branchClimate.moisture * branchWeight[position] + stemClimate.moisture * stemWeight[position];
    weight += branchWeight[position] + stemWeight[position];
  });
  const heatScore = round(clamp(heat / weight, -1, 1));
  const moistureScore = round(clamp(moisture / weight, -1, 1));
  const temperature = heatScore <= -0.28 ? 'cold' : heatScore >= 0.28 ? 'hot' : 'balanced';
  const moistureLabel = moistureScore <= -0.25 ? 'dry' : moistureScore >= 0.25 ? 'wet' : 'balanced';
  const needs: ClimateNeed[] = [];
  pushClimateNeeds(needs, heatScore, moistureScore);
  const evidence = [
    makeEvidence(
      rule,
      'temperature-axis',
      temperature === 'balanced' ? 'context' : 'support',
      `온도 축은 ${heatScore}로 ${temperature} 범주다. 월지의 영향에 가장 큰 가중치를 두었다.`,
      Math.max(0.45, Math.abs(heatScore)),
      ['bazi.m_gz', 'bazi.y_gz', 'bazi.d_gz', ...(bazi.h_gz ? ['bazi.h_gz'] : [])]
    ),
    makeEvidence(
      rule,
      'moisture-axis',
      moistureLabel === 'balanced' ? 'context' : 'support',
      `조습 축은 ${moistureScore}로 ${moistureLabel} 범주다.`,
      Math.max(0.45, Math.abs(moistureScore)),
      ['bazi.m_gz', 'bazi.y_gz', 'bazi.d_gz', ...(bazi.h_gz ? ['bazi.h_gz'] : [])]
    )
  ];

  return {
    ...rule,
    status: needs.length > 0 ? 'supported' : 'conditional',
    value: {
      heatScore,
      moistureScore,
      temperature,
      moisture: moistureLabel,
      needs
    },
    confidence: makeConfidence(
      bazi.h_gz ? 0.72 : 0.62,
      ['월지를 중심으로 네 기둥의 한난조습 성향을 같은 축에 투영했다.'],
      bazi.h_gz ? [] : ['시주 미상으로 야간·시간 기운의 조후 보정이 제외됐다.']
    ),
    evidence,
    caveats: [
      '조후 점수는 명리 해석용 상대 지표이며 실제 온도·습도나 의학적 체질을 뜻하지 않는다.',
      '천간합·지지합으로 생기는 오행 변환은 성립 검토 전이므로 반영하지 않는다.'
    ]
  };
}

export function analyzeInterpretationFoundations(bazi: Bazi): InterpretationFoundations {
  const hiddenSeasonality = analyzeHiddenStemSeasonality(bazi);
  return {
    monthCommand: analyzeMonthCommand(bazi),
    roots: analyzeStemRoots(bazi),
    exposures: analyzeExposures(bazi),
    hiddenSeasonality,
    elementPower: analyzeElementPower(bazi, hiddenSeasonality),
    climate: analyzeClimate(bazi)
  };
}

export function elementRelationLabel(source: FiveElement, target: FiveElement): string {
  if (source === target) return '동류';
  if (ELEM_NEXT[source] === target) return '생함';
  if (ELEM_NEXT[target] === source) return '생을 받음';
  if (ELEM_CTRL[source] === target) return '극함';
  if (CTRL_BY[source] === target) return '극을 받음';
  return '관계 미상';
}
