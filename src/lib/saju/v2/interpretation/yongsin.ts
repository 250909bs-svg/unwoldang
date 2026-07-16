import {
  CTRL_BY,
  ELEMENT,
  ELEM_CTRL,
  ELEM_NEXT,
  ELEM_ORDER,
  ELEM_PREV,
  TG,
  type FiveElement
} from '../../constants';
import { daymasterStrength } from '../../baziCalcs';
import type { Bazi } from '../../types';
import { analyzeInterpretationFoundations } from './foundations';
import { RULES, clamp, makeConfidence, makeEvidence, round } from './rules';
import type {
  ElementRecommendation,
  Evidence,
  InterpretationFoundations,
  RuleMetadata,
  StemRootProfile,
  YongsinAssessment,
  YongsinMethod,
  YongsinOpinion
} from './types';

function recommendation(
  element: FiveElement,
  score: number,
  rationale: string,
  supportingEvidence: Evidence[],
  opposingEvidence: Evidence[] = [],
  conditions: string[] = []
): ElementRecommendation {
  return {
    element,
    score: round(clamp(score)),
    rationale,
    supportingEvidence,
    opposingEvidence,
    conditions
  };
}

function mergeRecommendations(items: ElementRecommendation[]): ElementRecommendation[] {
  const grouped = new Map<FiveElement, ElementRecommendation>();
  items.forEach((item) => {
    const existing = grouped.get(item.element);
    if (!existing) {
      grouped.set(item.element, {
        ...item,
        supportingEvidence: [...item.supportingEvidence],
        opposingEvidence: [...item.opposingEvidence],
        conditions: [...item.conditions]
      });
      return;
    }
    existing.score = round(clamp(Math.max(existing.score, item.score) + Math.min(existing.score, item.score) * 0.25));
    existing.rationale = `${existing.rationale}; ${item.rationale}`;
    existing.supportingEvidence.push(...item.supportingEvidence);
    existing.opposingEvidence.push(...item.opposingEvidence);
    existing.conditions.push(...item.conditions);
  });
  return [...grouped.values()].sort((left, right) => right.score - left.score);
}

function createOpinion(
  method: YongsinMethod,
  rule: RuleMetadata,
  status: YongsinOpinion['status'],
  value: YongsinAssessment,
  confidenceScore: number,
  confidenceReasons: string[],
  confidenceLimitations: string[],
  evidence: Evidence[],
  caveats: string[]
): YongsinOpinion {
  return {
    method,
    ...rule,
    status,
    value,
    confidence: makeConfidence(confidenceScore, confidenceReasons, confidenceLimitations),
    evidence,
    caveats
  };
}

function findDayRoot(foundations: InterpretationFoundations): StemRootProfile {
  const profile = foundations.roots.value.find((item) => item.pillar === 'day');
  if (!profile) {
    throw new Error('일간 통근 분석값이 없습니다.');
  }
  return profile;
}

function analyzeEokbu(bazi: Bazi, foundations: InterpretationFoundations): YongsinOpinion {
  const rule = RULES.eokbu;
  const [ratio, label] = daymasterStrength(bazi);
  const dayElement = ELEMENT[TG[bazi.d_gz.tg]];
  const resource = ELEM_PREV[dayElement];
  const output = ELEM_NEXT[dayElement];
  const wealth = ELEM_CTRL[dayElement];
  const authority = CTRL_BY[dayElement];
  const dayRoot = findDayRoot(foundations);
  const evidence: Evidence[] = [
    makeEvidence(
      rule,
      'strength-ratio',
      'context',
      `기존 강약 계산에서 일간 지지 비율은 ${round(ratio)}(${label})다.`,
      0.85,
      ['daymasterStrength(bazi)', 'bazi.d_gz.tg']
    ),
    makeEvidence(
      rule,
      'day-root',
      dayRoot.rooted ? 'support' : 'opposition',
      `일간 통근은 ${dayRoot.level}이며 비교 점수는 ${dayRoot.score}다.`,
      Math.max(0.45, dayRoot.score),
      [foundations.roots.ruleId]
    )
  ];
  const candidates: ElementRecommendation[] = [];
  const cautions: ElementRecommendation[] = [];

  if (ratio > 0.56) {
    const strongEvidence = makeEvidence(
      rule,
      'strong-drain-control',
      'support',
      '일간 지지 비율이 강한 구간이므로 설기·재성·관성 방향을 차례로 검토한다.',
      clamp(0.55 + (ratio - 0.56)),
      ['daymasterStrength(bazi)']
    );
    evidence.push(strongEvidence);
    candidates.push(
      recommendation(output, 0.82, '강한 일간의 기운을 설기하는 1차 후보', [strongEvidence]),
      recommendation(wealth, 0.7, '일간이 극하며 현실 성과로 쓰는 2차 후보', [strongEvidence], [], ['재성이 원국에서 감당 가능한지 별도 확인']),
      recommendation(authority, 0.58, '강한 일간을 제어하는 조건부 후보', [strongEvidence], [], ['관살 혼잡과 뿌리 여부를 별도 확인'])
    );
    cautions.push(
      recommendation(dayElement, 0.76, '이미 강한 동류가 더해질 때 편중 가능', [], [strongEvidence]),
      recommendation(resource, 0.66, '인성이 일간을 더 생조할 때 편중 가능', [], [strongEvidence])
    );
  } else if (ratio < 0.44) {
    const weakEvidence = makeEvidence(
      rule,
      'weak-support',
      'support',
      '일간 지지 비율이 약한 구간이므로 인성의 생조와 비겁의 보강을 우선 검토한다.',
      clamp(0.55 + (0.44 - ratio)),
      ['daymasterStrength(bazi)']
    );
    evidence.push(weakEvidence);
    candidates.push(
      recommendation(resource, 0.84, '약한 일간을 생조하는 1차 후보', [weakEvidence]),
      recommendation(dayElement, 0.76, '동류로 일간을 보강하는 2차 후보', [weakEvidence])
    );
    cautions.push(
      recommendation(authority, 0.72, '약한 일간을 추가로 극할 가능성', [], [weakEvidence]),
      recommendation(output, 0.62, '일간의 힘을 더 설기할 가능성', [], [weakEvidence]),
      recommendation(wealth, 0.58, '일간이 재성을 감당하기 어려울 가능성', [], [weakEvidence])
    );
  } else {
    const balancedEvidence = makeEvidence(
      rule,
      'balanced-conditional',
      'context',
      '강약 비율이 중화 경계에 있어 한 오행을 강하게 고정하기보다 계절·통관 결과와 교차 검토한다.',
      0.62,
      ['daymasterStrength(bazi)']
    );
    evidence.push(balancedEvidence);
    candidates.push(
      recommendation(resource, 0.52, '균형 유지를 위한 생조 후보', [balancedEvidence], [], ['조후·통관과 일치할 때 우선']),
      recommendation(output, 0.52, '균형 유지를 위한 설기 후보', [balancedEvidence], [], ['조후·통관과 일치할 때 우선'])
    );
    cautions.push(recommendation(authority, 0.34, '중화 경계에서는 강한 극제가 균형을 깨뜨릴 수 있음', [], [balancedEvidence]));
  }

  const distance = Math.abs(ratio - 0.5);
  return createOpinion(
    'eokbu',
    rule,
    distance >= 0.06 ? 'supported' : 'conditional',
    {
      summary: `억부 관점은 ${label} 비율과 일간의 ${dayRoot.level} 통근을 함께 보고 후보를 정했다.`,
      candidates,
      cautions: mergeRecommendations(cautions)
    },
    Math.min(0.78, clamp(0.62 + distance * 0.55 - (bazi.h_gz ? 0 : 0.1))),
    ['강약 비율과 일간 통근을 함께 사용했다.'],
    bazi.h_gz ? [] : ['시주 미상으로 강약과 통근이 달라질 수 있다.'],
    evidence,
    ['억부 후보는 조후·통관·격국 후보와 충돌할 수 있으며 충돌 자체를 삭제하지 않는다.']
  );
}

function climateOpposition(rule: RuleMetadata, element: FiveElement, foundations: InterpretationFoundations): Evidence[] {
  const climate = foundations.climate.value;
  const opposing: Evidence[] = [];
  if (element === '화' && climate.moisture === 'dry') {
    opposing.push(makeEvidence(rule, 'fire-dry-opposition', 'opposition', '화는 한기를 덜 수 있지만 건조 편향을 키울 수 있다.', 0.62, [foundations.climate.ruleId]));
  }
  if (element === '수' && climate.temperature === 'cold') {
    opposing.push(makeEvidence(rule, 'water-cold-opposition', 'opposition', '수는 건조를 덜 수 있지만 한기를 키울 수 있다.', 0.68, [foundations.climate.ruleId]));
  }
  if (element === '토' && climate.moisture === 'dry') {
    opposing.push(makeEvidence(rule, 'earth-dry-opposition', 'opposition', '토는 수습에 쓰일 수 있으나 건조 명식에서는 조기를 더할 가능성이 있다.', 0.5, [foundations.climate.ruleId]));
  }
  if (element === '목' && climate.moisture === 'dry') {
    opposing.push(makeEvidence(rule, 'wood-dry-condition', 'opposition', '목은 건조가 심하면 수의 선행 보조 없이 기능하기 어렵다.', 0.45, [foundations.climate.ruleId]));
  }
  return opposing;
}

function analyzeJohu(bazi: Bazi, foundations: InterpretationFoundations): YongsinOpinion {
  const rule = RULES.johu;
  const climate = foundations.climate.value;
  const evidence = climate.needs.map((need, index) => makeEvidence(
    rule,
    `${need.axis}-${need.element}-${index}`,
    'support',
    `${need.axis === 'temperature' ? '한난' : '조습'} 축에서 ${need.element}을(를) ${need.rationale}로 검토한다.`,
    need.score,
    [foundations.climate.ruleId]
  ));
  const candidates = mergeRecommendations(climate.needs.map((need, index) => recommendation(
    need.element,
    need.score,
    need.rationale,
    [evidence[index]],
    climateOpposition(rule, need.element, foundations),
    ['반대 조후 축을 악화시키지 않는 배치인지 확인']
  )));
  const cautions: ElementRecommendation[] = [];
  const cautionEvidence: Evidence[] = [];

  const addCaution = (element: FiveElement, score: number, rationale: string, suffix: string) => {
    const itemEvidence = makeEvidence(rule, suffix, 'opposition', rationale, score, [foundations.climate.ruleId]);
    cautionEvidence.push(itemEvidence);
    cautions.push(recommendation(element, score, rationale, [], [itemEvidence]));
  };
  if (climate.temperature === 'cold') addCaution('수', 0.7, '한기가 강한 상태에서 수가 더해지면 온도 편향이 커질 수 있다.', 'cold-water-caution');
  if (climate.temperature === 'hot') addCaution('화', 0.7, '열기가 강한 상태에서 화가 더해지면 온도 편향이 커질 수 있다.', 'hot-fire-caution');
  if (climate.moisture === 'dry') addCaution('화', 0.62, '건조한 상태에서 화가 더해지면 조기가 커질 수 있다.', 'dry-fire-caution');
  if (climate.moisture === 'wet') addCaution('수', 0.62, '과습한 상태에서 수가 더해지면 습윤 편향이 커질 수 있다.', 'wet-water-caution');

  const intensity = Math.max(Math.abs(climate.heatScore), Math.abs(climate.moistureScore));
  return createOpinion(
    'johu',
    rule,
    candidates.length > 0 ? 'supported' : 'insufficient',
    {
      summary: candidates.length > 0
        ? `조후 프로필은 ${climate.temperature}·${climate.moisture}이며 상반되는 축은 조건부로 함께 보존했다.`
        : '한난조습이 균형 구간이라 조후만으로 우선 오행을 고정하지 않는다.',
      candidates,
      cautions: mergeRecommendations(cautions)
    },
    Math.min(0.74, clamp(0.55 + intensity * 0.25 - (bazi.h_gz ? 0 : 0.08))),
    ['온도와 조습을 별도 축으로 계산했다.'],
    ['일간별 12개월 세부 조후표와 사령일수는 후속 전문가 규칙 검토 대상이다.'],
    [...evidence, ...cautionEvidence],
    ['조후 후보가 억부상 기신과 충돌할 수 있으므로 두 근거를 함께 표시한다.']
  );
}

function analyzeTonggwan(bazi: Bazi, foundations: InterpretationFoundations): YongsinOpinion {
  const rule = RULES.tonggwan;
  const shares = foundations.elementPower.value.shares;
  const tensions = ELEM_ORDER.map((controller) => {
    const controlled = ELEM_CTRL[controller];
    const bridge = ELEM_NEXT[controller];
    const minSide = Math.min(shares[controller], shares[controlled]);
    const bridgeScarcity = Math.max(0, 0.18 - shares[bridge]);
    return {
      controller,
      controlled,
      bridge,
      score: round(minSide * 2.5 + bridgeScarcity * 1.4),
      qualifies: shares[controller] >= 0.16 && shares[controlled] >= 0.16
    };
  }).filter((item) => item.qualifies).sort((left, right) => right.score - left.score);
  const selected = tensions[0];

  if (!selected) {
    const noTension = makeEvidence(
      rule,
      'no-balanced-control-pair',
      'limitation',
      '서로 극하는 두 오행이 동시에 유력하다는 최소 조건이 확인되지 않았다.',
      0.72,
      [foundations.elementPower.ruleId]
    );
    return createOpinion(
      'tonggwan',
      rule,
      'insufficient',
      { summary: '통관이 반드시 필요한 대립 구조를 확인하지 못했다.', candidates: [], cautions: [] },
      bazi.h_gz ? 0.58 : 0.48,
      ['모든 상극 쌍의 상대 비중을 비교했다.'],
      ['합충과 천간 배치가 추가되면 통관 필요성이 달라질 수 있다.'],
      [noTension],
      ['오행이 없거나 적다는 이유만으로 통관용신을 만들지 않는다.']
    );
  }

  const tensionEvidence = makeEvidence(
    rule,
    `${selected.controller}-${selected.controlled}`,
    'support',
    `${selected.controller}(${Math.round(shares[selected.controller] * 100)}%)이 ${selected.controlled}(${Math.round(shares[selected.controlled] * 100)}%)을 극하는 대립에서 ${selected.bridge}이 생의 흐름을 잇는 후보가 된다.`,
    clamp(selected.score),
    [foundations.elementPower.ruleId]
  );
  const bridgeOpposition = shares[selected.bridge] >= 0.22
    ? [makeEvidence(
        rule,
        `${selected.bridge}-already-present`,
        'opposition',
        `${selected.bridge}이 이미 ${Math.round(shares[selected.bridge] * 100)}%로 적지 않아 추가 보강 필요성은 낮아질 수 있다.`,
        0.55,
        [foundations.elementPower.ruleId]
      )]
    : [];
  const candidate = recommendation(
    selected.bridge,
    clamp(0.52 + selected.score * 0.35 - shares[selected.bridge] * 0.4),
    `${selected.controller}→${selected.bridge}→${selected.controlled}의 생 흐름을 잇는 후보`,
    [tensionEvidence],
    bridgeOpposition,
    ['두 오행이 실제 천간·지지에서 맞부딪히는 배치인지 확인', '합화로 대립 자체가 변하지 않는지 확인']
  );

  return createOpinion(
    'tonggwan',
    rule,
    'conditional',
    { summary: `${selected.controller}–${selected.controlled} 대립의 통관 후보로 ${selected.bridge}을(를) 제시한다.`, candidates: [candidate], cautions: [] },
    clamp(0.5 + Math.min(0.24, selected.score * 0.2) - (bazi.h_gz ? 0 : 0.08)),
    ['상극 쌍의 양쪽 세력과 중간 오행의 현재 비중을 함께 계산했다.'],
    ['원국의 위치 관계와 합충 성립은 별도 상호작용 엔진이 필요하다.'],
    [tensionEvidence, ...bridgeOpposition],
    ['통관 후보는 실제 대립이 활성화된 경우에만 의미가 있으므로 조건부로 유지한다.']
  );
}

function analyzeByeongyak(bazi: Bazi, foundations: InterpretationFoundations): YongsinOpinion {
  const rule = RULES.byeongyak;
  const shares = foundations.elementPower.value.shares;
  const sorted = ELEM_ORDER.map((element) => ({ element, share: shares[element] })).sort((left, right) => right.share - left.share);
  const dominant = sorted[0];
  const second = sorted[1];
  const excessive = dominant.share >= 0.34 && dominant.share - second.share >= 0.08;

  if (!excessive) {
    const balancedEvidence = makeEvidence(
      rule,
      'no-single-excess',
      'context',
      `최대 오행 ${dominant.element}의 비중이 ${Math.round(dominant.share * 100)}%로 단일 과다 규칙의 문턱을 넘지 않았다.`,
      0.62,
      [foundations.elementPower.ruleId]
    );
    return createOpinion(
      'byeongyak',
      rule,
      'insufficient',
      { summary: '단일 오행 과다를 병으로 지정할 근거가 충분하지 않다.', candidates: [], cautions: [] },
      bazi.h_gz ? 0.6 : 0.5,
      ['오행 상대 비중과 1·2위 격차를 함께 확인했다.'],
      ['합충으로 생기는 구조적 막힘은 상호작용 엔진에서 추가해야 한다.'],
      [balancedEvidence],
      ['오행 결핍만으로 약 후보를 정하지 않는다.', '병약은 의학적 질환을 뜻하지 않는다.']
    );
  }

  const drain = ELEM_NEXT[dominant.element];
  const control = CTRL_BY[dominant.element];
  const excessEvidence = makeEvidence(
    rule,
    `${dominant.element}-excess`,
    'support',
    `${dominant.element}이 ${Math.round(dominant.share * 100)}%로 2위보다 ${Math.round((dominant.share - second.share) * 100)}%p 높아 편중 후보로 기록한다.`,
    clamp(0.55 + dominant.share),
    [foundations.elementPower.ruleId]
  );
  const missingEvidence = foundations.elementPower.value.scarce.map((element) => makeEvidence(
    rule,
    `${element}-scarce-not-remedy`,
    'limitation',
    `${element}의 비중이 낮지만 결핍 사실만으로 약으로 채택하지 않는다.`,
    0.78,
    [foundations.elementPower.ruleId]
  ));
  const candidates = [
    recommendation(drain, 0.76, `과다한 ${dominant.element}의 힘을 생으로 흘려보내는 후보`, [excessEvidence], [], ['설기된 오행이 다시 편중을 만들지 않는지 확인']),
    recommendation(control, 0.62, `과다한 ${dominant.element}을 제어하는 조건부 후보`, [excessEvidence], [], ['제어 오행이 일간까지 과도하게 손상하지 않는지 확인'])
  ];
  const cautions = [recommendation(dominant.element, 0.82, `이미 편중된 ${dominant.element}의 추가 강화 가능성`, [], [excessEvidence])];

  return createOpinion(
    'byeongyak',
    rule,
    'conditional',
    { summary: `${dominant.element} 편중을 구조적 병 후보로 보고 설기 ${drain}, 제어 ${control}을 약 후보로 분리했다.`, candidates, cautions },
    clamp(0.55 + (dominant.share - second.share) * 0.8 - (bazi.h_gz ? 0 : 0.08)),
    ['단일 과다와 차순위 격차를 동시에 사용했다.'],
    ['원국의 합충과 궁위별 실제 문제 발현은 아직 포함하지 않는다.'],
    [excessEvidence, ...missingEvidence],
    ['병약이라는 용어는 명식의 구조적 편중을 가리키며 건강·질병 진단이 아니다.']
  );
}

function relationName(dayElement: FiveElement, target: FiveElement): string {
  if (target === ELEM_NEXT[dayElement]) return '종아';
  if (target === ELEM_CTRL[dayElement]) return '종재';
  if (target === CTRL_BY[dayElement]) return '종살';
  return '종세';
}

function analyzeSpecial(bazi: Bazi, foundations: InterpretationFoundations): YongsinOpinion {
  const rule = RULES.special;
  const [ratio] = daymasterStrength(bazi);
  const dayElement = ELEMENT[TG[bazi.d_gz.tg]];
  const resource = ELEM_PREV[dayElement];
  const dayRoot = findDayRoot(foundations);
  const shares = foundations.elementPower.value.shares;
  const nonAllies = ELEM_ORDER
    .filter((element) => element !== dayElement && element !== resource)
    .map((element) => ({ element, share: shares[element] }))
    .sort((left, right) => right.share - left.share);
  const dominantOther = nonAllies[0];
  const allyShare = shares[dayElement] + shares[resource];
  const weakCandidate = ratio <= 0.2 && dayRoot.score <= 0.25 && dominantOther.share >= 0.32;
  const strongCandidate = ratio >= 0.8 && dayRoot.score >= 0.7 && allyShare >= 0.62;

  if (!weakCandidate && !strongCandidate) {
    const rejection = makeEvidence(
      rule,
      'special-threshold-not-met',
      'opposition',
      `강약 ${round(ratio)}, 일간 통근 ${dayRoot.score}, 동류·인성 합계 ${Math.round(allyShare * 100)}%로 특수격 후보의 보수적 문턱을 충족하지 않는다.`,
      0.8,
      ['daymasterStrength(bazi)', foundations.roots.ruleId, foundations.elementPower.ruleId]
    );
    return createOpinion(
      'special',
      rule,
      'insufficient',
      { summary: '종격·전왕 후보를 제시할 만큼 극단적인 조건이 확인되지 않았다.', candidates: [], cautions: [] },
      bazi.h_gz ? 0.67 : 0.54,
      ['극단적 강약, 통근, 오행 집중을 모두 요구했다.'],
      ['합화·파격 조건과 운의 순역은 후속 판정 대상이다.'],
      [rejection],
      ['일부 조건만 맞는 경우 특수격으로 단정하지 않는다.']
    );
  }

  if (weakCandidate) {
    const pattern = relationName(dayElement, dominantOther.element);
    const support = makeEvidence(
      rule,
      `${pattern}-candidate`,
      'support',
      `일간 비율 ${round(ratio)}, 통근 ${dayRoot.score}, ${dominantOther.element} 비중 ${Math.round(dominantOther.share * 100)}%로 ${pattern} 후보 조건 일부가 겹친다.`,
      0.62,
      ['daymasterStrength(bazi)', foundations.roots.ruleId, foundations.elementPower.ruleId]
    );
    const opposition = allyShare >= 0.16
      ? [makeEvidence(rule, 'remaining-ally-power', 'opposition', `동류·인성 합계가 ${Math.round(allyShare * 100)}% 남아 완전한 종격 성립에는 반대 근거가 있다.`, 0.7, [foundations.elementPower.ruleId])]
      : [];
    return createOpinion(
      'special',
      rule,
      'conditional',
      {
        summary: `${pattern} 가능성을 후보로만 남기며 보통격과 병렬 비교해야 한다.`,
        candidates: [recommendation(
          dominantOther.element,
          0.64,
          `${pattern} 가정이 성립할 때 강한 세력을 거스르지 않는 후보`,
          [support],
          opposition,
          ['합화·파격·일간의 잔존 근을 전문가가 재검토', '종격이 부정되면 이 후보를 폐기']
        )],
        cautions: []
      },
      bazi.h_gz ? 0.55 : 0.44,
      ['극신약·무근·비동류 집중 조건을 함께 요구했다.'],
      ['특수격은 학파별 성립 조건 차이가 커 자동 확정하지 않는다.'],
      [support, ...opposition],
      ['특수격 후보는 보통격 판정과 함께 제시하며 단독 결론으로 사용하지 않는다.']
    );
  }

  const strongEvidence = makeEvidence(
    rule,
    'exclusive-strength-candidate',
    'support',
    `일간 비율 ${round(ratio)}, 통근 ${dayRoot.score}, 동류·인성 ${Math.round(allyShare * 100)}%로 전왕·종강 후보 조건 일부가 겹친다.`,
    0.64,
    ['daymasterStrength(bazi)', foundations.roots.ruleId, foundations.elementPower.ruleId]
  );
  return createOpinion(
    'special',
    rule,
    'conditional',
    {
      summary: '전왕·종강 가능성을 후보로만 남기며 일반 신강 억부 판정과 병렬 비교해야 한다.',
      candidates: [
        recommendation(dayElement, 0.64, '전왕 가정이 성립할 때 동류 세력을 따르는 후보', [strongEvidence], [], ['전왕 성립이 부정되면 폐기']),
        recommendation(resource, 0.58, '종강 가정이 성립할 때 생조 세력을 따르는 후보', [strongEvidence], [], ['종강 성립이 부정되면 폐기'])
      ],
      cautions: []
    },
    bazi.h_gz ? 0.56 : 0.45,
    ['극신강·강근·동류 집중 조건을 함께 요구했다.'],
    ['식상·재관의 유효한 뿌리와 합화·파격은 전문가 재검토가 필요하다.'],
    [strongEvidence],
    ['특수격 후보는 일반 신강 판정과 충돌할 수 있으며 양쪽 근거를 보존한다.']
  );
}

export function analyzeYongsinOpinions(
  bazi: Bazi,
  foundations: InterpretationFoundations = analyzeInterpretationFoundations(bazi)
): YongsinOpinion[] {
  return [
    analyzeEokbu(bazi, foundations),
    analyzeJohu(bazi, foundations),
    analyzeTonggwan(bazi, foundations),
    analyzeByeongyak(bazi, foundations),
    analyzeSpecial(bazi, foundations)
  ];
}
