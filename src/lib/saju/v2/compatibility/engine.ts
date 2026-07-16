import {
  BRANCH_ELEM,
  DZ,
  ELEMENT,
  ELEM_CTRL,
  ELEM_NEXT,
  ELEM_ORDER,
  TG,
  type FiveElement
} from '../../constants';
import { daymasterStrength, getDayMasterElement, usefulElements } from '../../baziCalcs';
import type { Bazi, GZ } from '../../types';
import {
  createBaziParticipants,
  detectRelations,
  type RelationEvidence,
  type RelationPolarity
} from '../interactions';
import type {
  CompatibilityAnalysisInput,
  CompatibilityAnalysisResult,
  CompatibilityDimension,
  CompatibilityFact,
  CompatibilityFactTendency,
  CompatibilityOverview,
  CompatibilityTendency,
  DayMasterDynamic,
  ElementExchange,
  ElementReceipt,
  RelationshipPurpose,
  SpousePalaceDynamic
} from './types';

type SignalChannel =
  | 'dayMaster'
  | 'spousePalace'
  | 'elementExchange'
  | 'stemRelations'
  | 'branchRelations'
  | 'crossRelations';

interface Signal {
  value: number;
  evidenceIds: string[];
  confidence: number;
}

interface DimensionConfig {
  id: string;
  label: string;
  channels: Array<{ channel: SignalChannel; weight: number }>;
}

const PURPOSE_DIMENSIONS: Record<RelationshipPurpose, DimensionConfig[]> = {
  dating: [
    {
      id: 'dating-attraction',
      label: '초기 끌림과 반응성',
      channels: [
        { channel: 'spousePalace', weight: 3 },
        { channel: 'stemRelations', weight: 2 },
        { channel: 'dayMaster', weight: 1 }
      ]
    },
    {
      id: 'dating-emotional-flow',
      label: '감정 교류의 흐름',
      channels: [
        { channel: 'dayMaster', weight: 2 },
        { channel: 'spousePalace', weight: 2 },
        { channel: 'elementExchange', weight: 1 }
      ]
    },
    {
      id: 'dating-communication',
      label: '표현과 의사소통',
      channels: [
        { channel: 'stemRelations', weight: 2 },
        { channel: 'dayMaster', weight: 1 },
        { channel: 'crossRelations', weight: 1 }
      ]
    },
    {
      id: 'dating-continuity',
      label: '관계 지속과 회복',
      channels: [
        { channel: 'spousePalace', weight: 3 },
        { channel: 'branchRelations', weight: 2 },
        { channel: 'elementExchange', weight: 1 }
      ]
    }
  ],
  marriage: [
    {
      id: 'marriage-spouse-palace',
      label: '배우자궁 안정성',
      channels: [
        { channel: 'spousePalace', weight: 4 },
        { channel: 'branchRelations', weight: 1 }
      ]
    },
    {
      id: 'marriage-daily-balance',
      label: '생활 자원과 역할 균형',
      channels: [
        { channel: 'elementExchange', weight: 3 },
        { channel: 'dayMaster', weight: 1 },
        { channel: 'branchRelations', weight: 1 }
      ]
    },
    {
      id: 'marriage-conflict-repair',
      label: '갈등 조정과 회복력',
      channels: [
        { channel: 'crossRelations', weight: 2 },
        { channel: 'spousePalace', weight: 3 },
        { channel: 'elementExchange', weight: 1 }
      ]
    },
    {
      id: 'marriage-long-term-coordination',
      label: '장기적 방향 조율',
      channels: [
        { channel: 'dayMaster', weight: 1 },
        { channel: 'elementExchange', weight: 2 },
        { channel: 'crossRelations', weight: 2 }
      ]
    }
  ],
  business: [
    {
      id: 'business-execution',
      label: '실행 방식의 상호 보완',
      channels: [
        { channel: 'dayMaster', weight: 2 },
        { channel: 'stemRelations', weight: 2 },
        { channel: 'elementExchange', weight: 1 }
      ]
    },
    {
      id: 'business-resource-flow',
      label: '자원과 기회의 순환',
      channels: [
        { channel: 'elementExchange', weight: 4 },
        { channel: 'crossRelations', weight: 1 }
      ]
    },
    {
      id: 'business-governance',
      label: '의사결정과 권한 조율',
      channels: [
        { channel: 'stemRelations', weight: 2 },
        { channel: 'branchRelations', weight: 1 },
        { channel: 'crossRelations', weight: 2 }
      ]
    },
    {
      id: 'business-durability',
      label: '협업 지속 가능성',
      channels: [
        { channel: 'elementExchange', weight: 2 },
        { channel: 'branchRelations', weight: 2 },
        { channel: 'crossRelations', weight: 1 }
      ]
    }
  ],
  family: [
    {
      id: 'family-emotional-safety',
      label: '정서적 안전감',
      channels: [
        { channel: 'dayMaster', weight: 2 },
        { channel: 'spousePalace', weight: 1 },
        { channel: 'elementExchange', weight: 2 }
      ]
    },
    {
      id: 'family-role-balance',
      label: '가족 역할의 균형',
      channels: [
        { channel: 'elementExchange', weight: 3 },
        { channel: 'branchRelations', weight: 1 }
      ]
    },
    {
      id: 'family-boundaries',
      label: '경계와 간섭 조절',
      channels: [
        { channel: 'crossRelations', weight: 2 },
        { channel: 'branchRelations', weight: 2 },
        { channel: 'stemRelations', weight: 1 }
      ]
    },
    {
      id: 'family-repair',
      label: '갈등 이후 회복',
      channels: [
        { channel: 'spousePalace', weight: 1 },
        { channel: 'elementExchange', weight: 2 },
        { channel: 'crossRelations', weight: 2 }
      ]
    }
  ]
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function sortedElements(values: FiveElement[]) {
  const set = new Set(values);
  return ELEM_ORDER.filter((element) => set.has(element));
}

function relationSignal(polarity: RelationPolarity) {
  if (polarity === 'integrative') return 1;
  if (polarity === 'transformative') return 0.55;
  if (polarity === 'friction') return -1;
  if (polarity === 'latent-friction') return -0.55;
  return 0;
}

function factSignal(tendency: CompatibilityFactTendency) {
  if (tendency === 'supportive') return 0.8;
  if (tendency === 'tension') return -0.8;
  if (tendency === 'mixed') return 0;
  return 0;
}

function signalTendency(value: number, hasEvidence = true): CompatibilityTendency {
  if (!hasEvidence) return 'insufficient';
  if (value >= 0.3) return 'supportive';
  if (value <= -0.3) return 'tension';
  return 'conditional';
}

function factTendency(value: number): CompatibilityFactTendency {
  if (value >= 0.3) return 'supportive';
  if (value <= -0.3) return 'tension';
  if (value === 0) return 'neutral';
  return 'mixed';
}

function makeDayMasterDynamic(personA: Bazi, personB: Bazi): {
  dynamic: DayMasterDynamic;
  fact: CompatibilityFact;
  signal: Signal;
} {
  const personAElement = getDayMasterElement(personA.d_gz.tg);
  const personBElement = getDayMasterElement(personB.d_gz.tg);
  const evidenceId = 'compatibility:day-master';
  let kind: DayMasterDynamic['kind'];
  let direction: DayMasterDynamic['direction'];
  let statement: string;
  let tendency: CompatibilityFactTendency;
  let value: number;
  const uncertainty: string[] = [
    '일간 오행 관계는 상호작용의 한 축이며 일간 한 글자만으로 관계 전체를 확정하지 않습니다.'
  ];

  if (personAElement === personBElement) {
    kind = 'same-element';
    direction = 'mutual';
    statement =
      '두 일간은 모두 ' +
      personAElement +
      ' 기운으로 반응 방식의 공통점이 크지만, 같은 기능과 주도권이 겹칠 때 경쟁도 함께 나타날 수 있습니다.';
    tendency = 'mixed';
    value = 0.1;
  } else if (ELEM_NEXT[personAElement] === personBElement) {
    kind = 'generation';
    direction = 'A-to-B';
    statement =
      '일간 오행은 personA의 ' +
      personAElement +
      '이 personB의 ' +
      personBElement +
      '을 생하는 방향입니다. 지원이 한쪽으로 고정되지 않도록 상호 환류를 확인해야 합니다.';
    tendency = 'supportive';
    value = 0.65;
  } else if (ELEM_NEXT[personBElement] === personAElement) {
    kind = 'generation';
    direction = 'B-to-A';
    statement =
      '일간 오행은 personB의 ' +
      personBElement +
      '이 personA의 ' +
      personAElement +
      '을 생하는 방향입니다. 지원이 한쪽으로 고정되지 않도록 상호 환류를 확인해야 합니다.';
    tendency = 'supportive';
    value = 0.65;
  } else if (ELEM_CTRL[personAElement] === personBElement) {
    kind = 'control';
    direction = 'A-to-B';
    statement =
      '일간 오행은 personA의 ' +
      personAElement +
      '이 personB의 ' +
      personBElement +
      '을 제어하는 방향입니다. 역할이 명확하면 질서가 되지만 일방적이면 압박으로 체감될 수 있습니다.';
    tendency = 'mixed';
    value = -0.2;
  } else {
    kind = 'control';
    direction = 'B-to-A';
    statement =
      '일간 오행은 personB의 ' +
      personBElement +
      '이 personA의 ' +
      personAElement +
      '을 제어하는 방향입니다. 역할이 명확하면 질서가 되지만 일방적이면 압박으로 체감될 수 있습니다.';
    tendency = 'mixed';
    value = -0.2;
  }

  const fact: CompatibilityFact = {
    id: evidenceId,
    category: 'day-master',
    tendency,
    statement,
    confidence: 0.96,
    uncertainty,
    relationIds: []
  };
  return {
    dynamic: {
      kind,
      direction,
      personAElement,
      personBElement,
      conclusion: {
        statement,
        evidenceIds: [evidenceId],
        confidence: fact.confidence,
        uncertainty
      }
    },
    fact,
    signal: { value, evidenceIds: [evidenceId], confidence: fact.confidence }
  };
}

function relationAggregate(relations: RelationEvidence[]): Signal {
  if (relations.length === 0) return { value: 0, evidenceIds: [], confidence: 0.7 };
  const value =
    relations.reduce((sum, relation) => sum + relationSignal(relation.polarity), 0) /
    Math.sqrt(relations.length);
  return {
    value: clamp(value, -1, 1),
    evidenceIds: relations.map((relation) => relation.id),
    confidence:
      relations.reduce((sum, relation) => sum + relation.confidence, 0) / relations.length
  };
}

function makeSpousePalace(
  relations: RelationEvidence[]
): { dynamic: SpousePalaceDynamic; fact: CompatibilityFact; signal: Signal } {
  const spouseRelations = relations.filter((relation) => {
    const hasPersonADay = relation.participants.some(
      (participant) =>
        participant.layer === 'personA' &&
        participant.position === 'day' &&
        participant.component === 'branch'
    );
    const hasPersonBDay = relation.participants.some(
      (participant) =>
        participant.layer === 'personB' &&
        participant.position === 'day' &&
        participant.component === 'branch'
    );
    return hasPersonADay && hasPersonBDay;
  });
  const evidenceId = 'compatibility:spouse-palace';
  const signal = relationAggregate(spouseRelations);
  const uncertainty = [
    '일지는 배우자궁의 핵심 근거지만 실제 관계는 두 원국 전체와 현재 대운·세운을 함께 봐야 합니다.'
  ];
  let statement: string;

  if (spouseRelations.length === 0) {
    statement =
      '두 일지 사이에 직접적인 합·충·형·파·해·원진 관계는 탐지되지 않았습니다. 직접 관계가 없다는 사실은 좋고 나쁨이 아니라 다른 기둥 근거의 비중이 커진다는 뜻입니다.';
  } else {
    const names = unique(
      spouseRelations.map((relation) => relation.subtype || relation.name)
    );
    statement =
      '두 배우자궁 사이에 ' +
      names.join('·') +
      ' 관계가 함께 존재합니다. 결합 근거와 마찰 근거를 삭제하지 않고 동시에 평가해야 합니다.';
  }
  const tendency = factTendency(signal.value);
  const fact: CompatibilityFact = {
    id: evidenceId,
    category: 'spouse-palace',
    tendency,
    statement,
    confidence: spouseRelations.length > 0 ? signal.confidence : 0.92,
    uncertainty,
    relationIds: signal.evidenceIds
  };
  const evidenceIds = spouseRelations.length > 0 ? signal.evidenceIds : [evidenceId];
  return {
    dynamic: {
      relationIds: signal.evidenceIds,
      conclusion: {
        statement,
        evidenceIds,
        confidence: fact.confidence,
        uncertainty
      }
    },
    fact,
    signal: {
      ...signal,
      evidenceIds: evidenceIds
    }
  };
}

function baziPillars(bazi: Bazi): GZ[] {
  return [bazi.y_gz, bazi.m_gz, bazi.d_gz, ...(bazi.h_gz ? [bazi.h_gz] : [])];
}

function elementPresence(bazi: Bazi) {
  const presence = new Map<FiveElement, number>(ELEM_ORDER.map((element) => [element, 0]));
  for (const pillar of baziPillars(bazi)) {
    const stemElement = ELEMENT[TG[pillar.tg]];
    const branchElement = BRANCH_ELEM[DZ[pillar.dz]];
    presence.set(stemElement, (presence.get(stemElement) || 0) + 1);
    presence.set(branchElement, (presence.get(branchElement) || 0) + 1);
  }
  return presence;
}

function makeElementReceipt(
  recipient: 'personA' | 'personB',
  recipientBazi: Bazi,
  supplierBazi: Bazi
): ElementReceipt {
  const dayMasterElement = getDayMasterElement(recipientBazi.d_gz.tg);
  const [, strengthLabel] = daymasterStrength(recipientBazi);
  const [helpfulElements, cautiousElements] = usefulElements(dayMasterElement, strengthLabel);
  const supplierPresence = elementPresence(supplierBazi);
  const suppliedHelpfulElements = sortedElements(
    helpfulElements.filter((element) => (supplierPresence.get(element) || 0) > 0)
  );
  const suppliedCautiousElements = sortedElements(
    cautiousElements.filter((element) => (supplierPresence.get(element) || 0) > 0)
  );
  const missingHelpfulElements = sortedElements(
    helpfulElements.filter((element) => (supplierPresence.get(element) || 0) === 0)
  );
  const helpfulCoverage =
    helpfulElements.length === 0 ? 0 : suppliedHelpfulElements.length / helpfulElements.length;
  const cautiousCoverage =
    cautiousElements.length === 0 ? 0 : suppliedCautiousElements.length / cautiousElements.length;
  const value = helpfulCoverage - cautiousCoverage * 0.65;

  return {
    recipient,
    helpfulElements: sortedElements(helpfulElements),
    cautiousElements: sortedElements(cautiousElements),
    suppliedHelpfulElements,
    suppliedCautiousElements,
    missingHelpfulElements,
    tendency: factTendency(value),
    evidenceId: 'compatibility:element-exchange:' + recipient
  };
}

function receiptStatement(receipt: ElementReceipt) {
  const supplier = receipt.recipient === 'personA' ? 'personB' : 'personA';
  const helpful =
    receipt.suppliedHelpfulElements.length > 0
      ? receipt.suppliedHelpfulElements.join('·')
      : '없음';
  const cautious =
    receipt.suppliedCautiousElements.length > 0
      ? receipt.suppliedCautiousElements.join('·')
      : '없음';
  return (
    supplier +
    ' 원국이 ' +
    receipt.recipient +
    '에게 공급하는 도움 오행은 ' +
    helpful +
    ', 과다 시 주의할 오행은 ' +
    cautious +
    '입니다.'
  );
}

function makeElementExchange(
  personA: Bazi,
  personB: Bazi
): { exchange: ElementExchange; facts: CompatibilityFact[]; signal: Signal } {
  const personAReceives = makeElementReceipt('personA', personA, personB);
  const personBReceives = makeElementReceipt('personB', personB, personA);
  const facts: CompatibilityFact[] = [personAReceives, personBReceives].map((receipt) => ({
    id: receipt.evidenceId,
    category: 'element-exchange',
    tendency: receipt.tendency,
    statement: receiptStatement(receipt),
    confidence: 0.78,
    uncertainty: [
      '도움·주의 오행은 현재 신강약 휴리스틱을 사용하며 조후·통관·병약 용신의 독립 판정으로 교체될 수 있습니다.',
      '상대 원국에 오행이 존재한다는 사실만으로 실제 관계에서 언제나 도움이 된다고 단정하지 않습니다.'
    ],
    relationIds: []
  }));
  const signalValue =
    (factSignal(personAReceives.tendency) + factSignal(personBReceives.tendency)) / 2;
  const mutuallyHelpfulElements = sortedElements(
    personAReceives.suppliedHelpfulElements.filter((element) =>
      personBReceives.suppliedHelpfulElements.includes(element)
    )
  );
  const mutuallyCautiousElements = sortedElements(
    personAReceives.suppliedCautiousElements.filter((element) =>
      personBReceives.suppliedCautiousElements.includes(element)
    )
  );
  const statement =
    '상호 오행 공급은 personA 기준 ' +
    personAReceives.tendency +
    ', personB 기준 ' +
    personBReceives.tendency +
    '입니다. 두 방향을 평균내어 한쪽의 지원만으로 궁합 전체를 판단하지 않습니다.';
  const uncertainty = unique(facts.flatMap((fact) => fact.uncertainty));
  const exchange: ElementExchange = {
    personAReceives,
    personBReceives,
    mutuallyHelpfulElements,
    mutuallyCautiousElements,
    conclusion: {
      statement,
      evidenceIds: facts.map((fact) => fact.id),
      confidence: 0.78,
      uncertainty
    }
  };
  return {
    exchange,
    facts,
    signal: {
      value: signalValue,
      evidenceIds: facts.map((fact) => fact.id),
      confidence: 0.78
    }
  };
}

function makeRelationPatternFact(relations: RelationEvidence[]): {
  fact: CompatibilityFact;
  signal: Signal;
} {
  const signal = relationAggregate(relations);
  const supportive = relations.filter(
    (relation) => relation.polarity === 'integrative' || relation.polarity === 'transformative'
  );
  const friction = relations.filter(
    (relation) => relation.polarity === 'friction' || relation.polarity === 'latent-friction'
  );
  const statement =
    '두 원국 사이에서 결합·전환 관계 ' +
    supportive.length +
    '건, 직접·잠재 마찰 관계 ' +
    friction.length +
    '건을 탐지했습니다. 개수만으로 길흉을 정하지 않고 어느 기둥과 영역이 연결되는지 근거를 유지합니다.';
  const fact: CompatibilityFact = {
    id: 'compatibility:relation-pattern',
    category: 'relation-pattern',
    tendency: factTendency(signal.value),
    statement,
    confidence: relations.length > 0 ? signal.confidence : 0.9,
    uncertainty: [
      '관계 개수는 중요도와 같지 않으며 일지·월지·시지 등 위치와 원국 세력을 함께 판단해야 합니다.'
    ],
    relationIds: signal.evidenceIds
  };
  return {
    fact,
    signal: {
      ...signal,
      evidenceIds: relations.length > 0 ? signal.evidenceIds : [fact.id]
    }
  };
}

function buildSignals(
  dayMaster: Signal,
  spousePalace: Signal,
  elementExchange: Signal,
  relations: RelationEvidence[],
  relationPattern: Signal
): Record<SignalChannel, Signal> {
  const stemRelations = relations.filter(
    (relation) => relation.relation === 'stem-combination' || relation.relation === 'stem-clash'
  );
  const branchRelations = relations.filter(
    (relation) => relation.relation !== 'stem-combination' && relation.relation !== 'stem-clash'
  );
  return {
    dayMaster,
    spousePalace,
    elementExchange,
    stemRelations: relationAggregate(stemRelations),
    branchRelations: relationAggregate(branchRelations),
    crossRelations: relationPattern
  };
}

function dimensionStatement(label: string, tendency: CompatibilityTendency) {
  if (tendency === 'supportive') {
    return label + '에는 결합과 보완 근거가 우세합니다. 다만 실제 행동 규칙으로 연결될 때 장점이 유지됩니다.';
  }
  if (tendency === 'tension') {
    return label + '에는 조정 압력이 우세합니다. 실패를 뜻하지 않으며 역할·경계·의사결정 규칙을 먼저 합의할 필요가 있습니다.';
  }
  if (tendency === 'insufficient') {
    return label + '을 판정할 직접 근거가 충분하지 않아 결론을 유보합니다.';
  }
  return label + '에는 결합과 마찰 근거가 함께 있거나 방향성이 중립적입니다. 조건과 실제 관계 맥락에 따라 표현이 달라집니다.';
}

function evaluateDimension(
  config: DimensionConfig,
  signals: Record<SignalChannel, Signal>,
  hourUnknown: boolean
): CompatibilityDimension {
  let weightedValue = 0;
  let totalWeight = 0;
  let weightedConfidence = 0;
  const evidenceIds: string[] = [];
  let presentSources = 0;

  for (const source of config.channels) {
    const signal = signals[source.channel];
    if (signal.evidenceIds.length > 0) {
      presentSources += 1;
      evidenceIds.push(...signal.evidenceIds);
    }
    weightedValue += signal.value * source.weight;
    weightedConfidence += signal.confidence * source.weight;
    totalWeight += source.weight;
  }
  const normalizedValue = totalWeight === 0 ? 0 : weightedValue / totalWeight;
  const tendency = signalTendency(normalizedValue, presentSources > 0);
  const uncertainty = [
    '이 평가는 명리 관계 근거의 방향을 질적으로 분류하며 관계 성공 확률이나 확정 점수가 아닙니다.'
  ];
  if (hourUnknown) {
    uncertainty.push('한 명 이상의 출생시각이 없어 시주 관계가 이 차원에 반영되지 않았습니다.');
  }
  const confidenceBase = totalWeight === 0 ? 0.5 : weightedConfidence / totalWeight;
  return {
    id: config.id,
    label: config.label,
    tendency,
    statement: dimensionStatement(config.label, tendency),
    evidenceIds: unique(evidenceIds),
    confidence: clamp(confidenceBase - (hourUnknown ? 0.08 : 0), 0.45, 0.95),
    uncertainty
  };
}

function makeOverview(dimensions: CompatibilityDimension[]): CompatibilityOverview {
  const tendencyValue: Record<CompatibilityTendency, number> = {
    supportive: 1,
    conditional: 0,
    tension: -1,
    insufficient: 0
  };
  const overallValue =
    dimensions.length === 0
      ? 0
      : dimensions.reduce((sum, dimension) => sum + tendencyValue[dimension.tendency], 0) /
        dimensions.length;
  const tendency = signalTendency(overallValue, dimensions.length > 0);
  const statement =
    tendency === 'supportive'
      ? '선택한 관계 목적에서는 보완 근거가 상대적으로 우세하지만, 마찰 근거를 관리하는 실제 합의가 필요합니다.'
      : tendency === 'tension'
        ? '선택한 관계 목적에서는 조정해야 할 근거가 상대적으로 우세하며, 관계의 실패가 아니라 관리 조건이 많다는 뜻입니다.'
        : '선택한 관계 목적에서는 보완과 마찰 근거가 함께 있어 조건부 관계로 해석합니다.';
  const evidenceIds = unique(dimensions.flatMap((dimension) => dimension.evidenceIds));
  const confidence =
    dimensions.length === 0
      ? 0.5
      : dimensions.reduce((sum, dimension) => sum + dimension.confidence, 0) /
        dimensions.length;
  return {
    tendency,
    statement,
    evidenceIds,
    confidence,
    uncertainty: [
      '종합 경향은 목적별 차원을 요약한 질적 결론이며 단일 궁합 점수나 관계의 성공·실패 예측이 아닙니다.',
      '현재 두 사람의 대운·세운 동시성은 별도의 temporal 분석에 두 원국을 각각 넣어 교차 검증해야 합니다.'
    ]
  };
}

export function analyzeCompatibility(input: CompatibilityAnalysisInput): CompatibilityAnalysisResult {
  const participants = [
    ...createBaziParticipants(input.personA, 'personA'),
    ...createBaziParticipants(input.personB, 'personB')
  ];
  const crossRelations = detectRelations(participants, { scope: 'cross-layer-only' });
  const dayMasterResult = makeDayMasterDynamic(input.personA, input.personB);
  const spousePalaceResult = makeSpousePalace(crossRelations);
  const elementExchangeResult = makeElementExchange(input.personA, input.personB);
  const relationPatternResult = makeRelationPatternFact(crossRelations);
  const facts = [
    dayMasterResult.fact,
    spousePalaceResult.fact,
    ...elementExchangeResult.facts,
    relationPatternResult.fact
  ];
  const signals = buildSignals(
    dayMasterResult.signal,
    spousePalaceResult.signal,
    elementExchangeResult.signal,
    crossRelations,
    relationPatternResult.signal
  );
  const hourUnknown = !input.personA.h_gz || !input.personB.h_gz;
  const dimensions = PURPOSE_DIMENSIONS[input.purpose].map((config) =>
    evaluateDimension(config, signals, hourUnknown)
  );
  const overview = makeOverview(dimensions);
  const uncertainty = [
    '궁합 결과는 두 원국의 구조적 상호작용을 설명하며 상대의 의사, 행동 또는 관계 결과를 확정하지 않습니다.',
    '관계 목적에 따라 같은 근거의 중요도를 다르게 배치했으며 목적이 바뀌면 차원별 결론도 달라질 수 있습니다.',
    '현재 대운·세운의 동시성은 이 정적 궁합 API에 포함하지 않았습니다.'
  ];
  if (hourUnknown) {
    uncertainty.push('한 명 이상의 출생시각이 없어 시주와 후반 관계 영역을 제외했습니다.');
  }
  if (crossRelations.some((relation) => relation.transformedElement)) {
    uncertainty.push('합·삼합·방합은 관계 존재만 탐지했으며 합화 성립은 각 원국의 월령·통근·투간을 추가 검증해야 합니다.');
  }
  const confidence = clamp(
    overview.confidence - (hourUnknown ? 0.04 : 0),
    0.45,
    0.95
  );

  return {
    engineVersion: '2.0.0',
    purpose: input.purpose,
    dayMaster: dayMasterResult.dynamic,
    spousePalace: spousePalaceResult.dynamic,
    crossRelations,
    elementExchange: elementExchangeResult.exchange,
    facts,
    dimensions,
    overview: {
      ...overview,
      confidence
    },
    confidence,
    uncertainty
  };
}
