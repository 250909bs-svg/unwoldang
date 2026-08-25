import { BRANCH_ELEM, DZ, ELEMENT, TG, type FiveElement } from '../../constants';
import type { Bazi, GZ } from '../../types';
import type {
  PillarPosition,
  RelationDetectionOptions,
  RelationEvidence,
  RelationKind,
  RelationLayer,
  RelationParticipant,
  RelationPolarity
} from './types';

interface PairRule {
  pair: readonly [number, number];
  relation: RelationKind;
  name: string;
  subtype?: string;
  polarity: RelationPolarity;
  transformedElement?: FiveElement;
  confidence: number;
  uncertainty?: readonly string[];
}

interface GroupRule {
  members: readonly number[];
  relation: RelationKind;
  name: string;
  subtype?: string;
  polarity: RelationPolarity;
  transformedElement?: FiveElement;
  confidence: number;
  uncertainty?: readonly string[];
}

const COMBINATION_UNCERTAINTY =
  '합의 존재와 합화의 성립은 다릅니다. 합화는 월령·투간·통근·방해 관계를 별도 판정해야 합니다.';
const GROUP_UNCERTAINTY =
  '국의 구성은 탐지했지만 실제 화국 성립과 세력 전환은 계절·투간·충파 조건을 별도 판정해야 합니다.';

const STEM_PAIR_RULES: readonly PairRule[] = [
  { pair: [0, 5], relation: 'stem-combination', name: '천간합', subtype: '갑기합', polarity: 'transformative', transformedElement: '토', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },
  { pair: [1, 6], relation: 'stem-combination', name: '천간합', subtype: '을경합', polarity: 'transformative', transformedElement: '금', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },
  { pair: [2, 7], relation: 'stem-combination', name: '천간합', subtype: '병신합', polarity: 'transformative', transformedElement: '수', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },
  { pair: [3, 8], relation: 'stem-combination', name: '천간합', subtype: '정임합', polarity: 'transformative', transformedElement: '목', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },
  { pair: [4, 9], relation: 'stem-combination', name: '천간합', subtype: '무계합', polarity: 'transformative', transformedElement: '화', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },
  { pair: [0, 6], relation: 'stem-clash', name: '천간충', subtype: '갑경충', polarity: 'friction', confidence: 0.97 },
  { pair: [1, 7], relation: 'stem-clash', name: '천간충', subtype: '을신충', polarity: 'friction', confidence: 0.97 },
  { pair: [2, 8], relation: 'stem-clash', name: '천간충', subtype: '병임충', polarity: 'friction', confidence: 0.97 },
  { pair: [3, 9], relation: 'stem-clash', name: '천간충', subtype: '정계충', polarity: 'friction', confidence: 0.97 }
] as const;

const BRANCH_PAIR_RULES: readonly PairRule[] = [
  { pair: [0, 1], relation: 'six-combination', name: '지지육합', subtype: '자축합', polarity: 'integrative', transformedElement: '토', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },
  { pair: [2, 11], relation: 'six-combination', name: '지지육합', subtype: '인해합', polarity: 'integrative', transformedElement: '목', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },
  { pair: [3, 10], relation: 'six-combination', name: '지지육합', subtype: '묘술합', polarity: 'integrative', transformedElement: '화', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },
  { pair: [4, 9], relation: 'six-combination', name: '지지육합', subtype: '진유합', polarity: 'integrative', transformedElement: '금', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },
  { pair: [5, 8], relation: 'six-combination', name: '지지육합', subtype: '사신합', polarity: 'integrative', transformedElement: '수', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },
  { pair: [6, 7], relation: 'six-combination', name: '지지육합', subtype: '오미합', polarity: 'integrative', transformedElement: '토', confidence: 0.98, uncertainty: [COMBINATION_UNCERTAINTY] },

  { pair: [0, 6], relation: 'clash', name: '지지충', subtype: '자오충', polarity: 'friction', confidence: 0.99 },
  { pair: [1, 7], relation: 'clash', name: '지지충', subtype: '축미충', polarity: 'friction', confidence: 0.99 },
  { pair: [2, 8], relation: 'clash', name: '지지충', subtype: '인신충', polarity: 'friction', confidence: 0.99 },
  { pair: [3, 9], relation: 'clash', name: '지지충', subtype: '묘유충', polarity: 'friction', confidence: 0.99 },
  { pair: [4, 10], relation: 'clash', name: '지지충', subtype: '진술충', polarity: 'friction', confidence: 0.99 },
  { pair: [5, 11], relation: 'clash', name: '지지충', subtype: '사해충', polarity: 'friction', confidence: 0.99 },

  { pair: [0, 3], relation: 'punishment', name: '지지형', subtype: '자묘 무례지형', polarity: 'friction', confidence: 0.98 },
  { pair: [2, 5], relation: 'punishment', name: '지지형', subtype: '인·사 형 작용 후보', polarity: 'friction', confidence: 0.96, uncertainty: ['두 글자의 형 작용 후보와 인·사·신 세 글자가 모두 모인 구조를 구분해 해석해야 합니다.'] },
  { pair: [5, 8], relation: 'punishment', name: '지지형', subtype: '사·신 형 작용 후보', polarity: 'friction', confidence: 0.96, uncertainty: ['두 글자의 형 작용 후보와 인·사·신 세 글자가 모두 모인 구조를 구분해 해석해야 합니다.'] },
  { pair: [2, 8], relation: 'punishment', name: '지지형', subtype: '인·신 형 작용 후보', polarity: 'friction', confidence: 0.96, uncertainty: ['두 글자의 형 작용 후보와 인·사·신 세 글자가 모두 모인 구조를 구분해 해석해야 합니다.'] },
  { pair: [1, 10], relation: 'punishment', name: '지지형', subtype: '축술 지세지형', polarity: 'friction', confidence: 0.96, uncertainty: ['삼형의 완성 여부와 두 글자 사이의 형 작용 강도를 구분해 해석해야 합니다.'] },
  { pair: [10, 7], relation: 'punishment', name: '지지형', subtype: '술미 지세지형', polarity: 'friction', confidence: 0.96, uncertainty: ['삼형의 완성 여부와 두 글자 사이의 형 작용 강도를 구분해 해석해야 합니다.'] },
  { pair: [1, 7], relation: 'punishment', name: '지지형', subtype: '축미 지세지형', polarity: 'friction', confidence: 0.96, uncertainty: ['삼형의 완성 여부와 두 글자 사이의 형 작용 강도를 구분해 해석해야 합니다.'] },

  { pair: [0, 9], relation: 'break', name: '지지파', subtype: '자유파', polarity: 'friction', confidence: 0.96 },
  { pair: [1, 4], relation: 'break', name: '지지파', subtype: '축진파', polarity: 'friction', confidence: 0.96 },
  { pair: [2, 11], relation: 'break', name: '지지파', subtype: '인해파', polarity: 'friction', confidence: 0.96 },
  { pair: [3, 6], relation: 'break', name: '지지파', subtype: '묘오파', polarity: 'friction', confidence: 0.96 },
  { pair: [5, 8], relation: 'break', name: '지지파', subtype: '사신파', polarity: 'friction', confidence: 0.96 },
  { pair: [7, 10], relation: 'break', name: '지지파', subtype: '미술파', polarity: 'friction', confidence: 0.96 },

  { pair: [0, 7], relation: 'harm', name: '지지해', subtype: '자미해', polarity: 'latent-friction', confidence: 0.97 },
  { pair: [1, 6], relation: 'harm', name: '지지해', subtype: '축오해', polarity: 'latent-friction', confidence: 0.97 },
  { pair: [2, 5], relation: 'harm', name: '지지해', subtype: '인사해', polarity: 'latent-friction', confidence: 0.97 },
  { pair: [3, 4], relation: 'harm', name: '지지해', subtype: '묘진해', polarity: 'latent-friction', confidence: 0.97 },
  { pair: [8, 11], relation: 'harm', name: '지지해', subtype: '신해해', polarity: 'latent-friction', confidence: 0.97 },
  { pair: [9, 10], relation: 'harm', name: '지지해', subtype: '유술해', polarity: 'latent-friction', confidence: 0.97 },

  { pair: [0, 7], relation: 'resentment', name: '원진', subtype: '자미원진', polarity: 'latent-friction', confidence: 0.94, uncertainty: ['원진은 학파별 채택 여부와 해석 강도 차이가 있으므로 보조 근거로만 사용합니다.'] },
  { pair: [1, 6], relation: 'resentment', name: '원진', subtype: '축오원진', polarity: 'latent-friction', confidence: 0.94, uncertainty: ['원진은 학파별 채택 여부와 해석 강도 차이가 있으므로 보조 근거로만 사용합니다.'] },
  { pair: [2, 9], relation: 'resentment', name: '원진', subtype: '인유원진', polarity: 'latent-friction', confidence: 0.94, uncertainty: ['원진은 학파별 채택 여부와 해석 강도 차이가 있으므로 보조 근거로만 사용합니다.'] },
  { pair: [3, 8], relation: 'resentment', name: '원진', subtype: '묘신원진', polarity: 'latent-friction', confidence: 0.94, uncertainty: ['원진은 학파별 채택 여부와 해석 강도 차이가 있으므로 보조 근거로만 사용합니다.'] },
  { pair: [4, 11], relation: 'resentment', name: '원진', subtype: '진해원진', polarity: 'latent-friction', confidence: 0.94, uncertainty: ['원진은 학파별 채택 여부와 해석 강도 차이가 있으므로 보조 근거로만 사용합니다.'] },
  { pair: [5, 10], relation: 'resentment', name: '원진', subtype: '사술원진', polarity: 'latent-friction', confidence: 0.94, uncertainty: ['원진은 학파별 채택 여부와 해석 강도 차이가 있으므로 보조 근거로만 사용합니다.'] }
] as const;

const BRANCH_GROUP_RULES: readonly GroupRule[] = [
  { members: [8, 0, 4], relation: 'three-harmony', name: '지지삼합', subtype: '신자진 수국', polarity: 'transformative', transformedElement: '수', confidence: 0.97, uncertainty: [GROUP_UNCERTAINTY] },
  { members: [11, 3, 7], relation: 'three-harmony', name: '지지삼합', subtype: '해묘미 목국', polarity: 'transformative', transformedElement: '목', confidence: 0.97, uncertainty: [GROUP_UNCERTAINTY] },
  { members: [2, 6, 10], relation: 'three-harmony', name: '지지삼합', subtype: '인오술 화국', polarity: 'transformative', transformedElement: '화', confidence: 0.97, uncertainty: [GROUP_UNCERTAINTY] },
  { members: [5, 9, 1], relation: 'three-harmony', name: '지지삼합', subtype: '사유축 금국', polarity: 'transformative', transformedElement: '금', confidence: 0.97, uncertainty: [GROUP_UNCERTAINTY] },
  { members: [2, 3, 4], relation: 'seasonal-harmony', name: '지지방합', subtype: '인묘진 목방', polarity: 'integrative', transformedElement: '목', confidence: 0.97, uncertainty: [GROUP_UNCERTAINTY] },
  { members: [5, 6, 7], relation: 'seasonal-harmony', name: '지지방합', subtype: '사오미 화방', polarity: 'integrative', transformedElement: '화', confidence: 0.97, uncertainty: [GROUP_UNCERTAINTY] },
  { members: [8, 9, 10], relation: 'seasonal-harmony', name: '지지방합', subtype: '신유술 금방', polarity: 'integrative', transformedElement: '금', confidence: 0.97, uncertainty: [GROUP_UNCERTAINTY] },
  { members: [11, 0, 1], relation: 'seasonal-harmony', name: '지지방합', subtype: '해자축 수방', polarity: 'integrative', transformedElement: '수', confidence: 0.97, uncertainty: [GROUP_UNCERTAINTY] },
  { members: [2, 5, 8], relation: 'punishment', name: '지지삼형', subtype: '인·사·신 삼형 구조 완성', polarity: 'friction', confidence: 0.98 },
  { members: [1, 7, 10], relation: 'punishment', name: '지지삼형', subtype: '축미술 지세지형 완성', polarity: 'friction', confidence: 0.98 }
] as const;

const SELF_PUNISHMENT_BRANCHES = new Map<number, string>([
  [4, '진진 자형'],
  [6, '오오 자형'],
  [9, '유유 자형'],
  [11, '해해 자형']
]);

function assertGz(gz: GZ) {
  if (!Number.isInteger(gz.tg) || gz.tg < 0 || gz.tg >= TG.length) {
    throw new RangeError('천간 인덱스는 0 이상 9 이하여야 합니다.');
  }
  if (!Number.isInteger(gz.dz) || gz.dz < 0 || gz.dz >= DZ.length) {
    throw new RangeError('지지 인덱스는 0 이상 11 이하여야 합니다.');
  }
}

export function createGzParticipants(
  gz: GZ,
  layer: RelationLayer,
  position: PillarPosition,
  idPrefix = layer + ':' + position
): RelationParticipant[] {
  assertGz(gz);
  const stem = TG[gz.tg];
  const branch = DZ[gz.dz];
  return [
    {
      id: idPrefix + ':stem',
      layer,
      position,
      component: 'stem',
      index: gz.tg,
      label: stem,
      element: ELEMENT[stem]
    },
    {
      id: idPrefix + ':branch',
      layer,
      position,
      component: 'branch',
      index: gz.dz,
      label: branch,
      element: BRANCH_ELEM[branch]
    }
  ];
}

export function createBaziParticipants(bazi: Bazi, layer: RelationLayer): RelationParticipant[] {
  const pillars: Array<[PillarPosition, GZ | null]> = [
    ['year', bazi.y_gz],
    ['month', bazi.m_gz],
    ['day', bazi.d_gz],
    ['hour', bazi.h_gz]
  ];
  return pillars.flatMap(([position, gz]) =>
    gz ? createGzParticipants(gz, layer, position, layer + ':' + position) : []
  );
}

function pairMatches(left: number, right: number, pair: readonly [number, number]) {
  return (left === pair[0] && right === pair[1]) || (left === pair[1] && right === pair[0]);
}

function scopeMatches(participants: RelationParticipant[], options?: RelationDetectionOptions) {
  const scope = options?.scope || 'all';
  const layerCount = new Set(participants.map((participant) => participant.layer)).size;
  if (scope === 'cross-layer-only') return layerCount > 1;
  if (scope === 'within-layer-only') return layerCount === 1;
  return true;
}

function evidenceId(rule: Pick<PairRule, 'relation' | 'subtype'>, participants: RelationParticipant[]) {
  const participantKey = participants.map((participant) => participant.id).sort().join('+');
  return 'relation:' + rule.relation + ':' + (rule.subtype || 'base') + ':' + participantKey;
}

function describeRelation(rule: Pick<PairRule, 'name' | 'subtype'>, participants: RelationParticipant[]) {
  const labels = participants
    .map((participant) => participant.layer + ' ' + participant.position + participant.component + ' ' + participant.label)
    .join(' · ');
  return labels + ' 사이에서 ' + rule.name + (rule.subtype ? ' (' + rule.subtype + ')' : '') + ' 관계가 성립합니다.';
}

function makeEvidence(rule: PairRule | GroupRule, participants: RelationParticipant[]): RelationEvidence {
  const sorted = [...participants].sort((left, right) => left.id.localeCompare(right.id));
  return {
    id: evidenceId(rule, sorted),
    relation: rule.relation,
    name: rule.name,
    subtype: rule.subtype,
    polarity: rule.polarity,
    participants: sorted,
    transformedElement: rule.transformedElement,
    description: describeRelation(rule, sorted),
    confidence: rule.confidence,
    uncertainty: [...(rule.uncertainty || [])]
  };
}

function uniqueEvidence(evidence: RelationEvidence[]) {
  return [...new Map(evidence.map((item) => [item.id, item])).values()].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

function groupCombinations(members: readonly number[], participants: RelationParticipant[]) {
  let combinations: RelationParticipant[][] = [[]];
  for (const member of members) {
    const matches = participants.filter((participant) => participant.index === member);
    if (matches.length === 0) return [];
    combinations = combinations.flatMap((combination) =>
      matches.map((match) => [...combination, match])
    );
  }
  return combinations.filter(
    (combination) => new Set(combination.map((participant) => participant.id)).size === combination.length
  );
}

export function detectRelations(
  participants: RelationParticipant[],
  options?: RelationDetectionOptions
): RelationEvidence[] {
  const evidence: RelationEvidence[] = [];
  const stems = participants.filter((participant) => participant.component === 'stem');
  const branches = participants.filter((participant) => participant.component === 'branch');

  for (let leftIndex = 0; leftIndex < stems.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < stems.length; rightIndex += 1) {
      const pair = [stems[leftIndex], stems[rightIndex]];
      if (!scopeMatches(pair, options)) continue;
      for (const rule of STEM_PAIR_RULES) {
        if (pairMatches(pair[0].index, pair[1].index, rule.pair)) evidence.push(makeEvidence(rule, pair));
      }
    }
  }

  for (let leftIndex = 0; leftIndex < branches.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < branches.length; rightIndex += 1) {
      const pair = [branches[leftIndex], branches[rightIndex]];
      if (!scopeMatches(pair, options)) continue;
      for (const rule of BRANCH_PAIR_RULES) {
        if (pairMatches(pair[0].index, pair[1].index, rule.pair)) evidence.push(makeEvidence(rule, pair));
      }
    }
  }

  for (const [branchIndex, subtype] of SELF_PUNISHMENT_BRANCHES) {
    const matches = branches.filter((participant) => participant.index === branchIndex);
    for (let leftIndex = 0; leftIndex < matches.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < matches.length; rightIndex += 1) {
        const pair = [matches[leftIndex], matches[rightIndex]];
        if (!scopeMatches(pair, options)) continue;
        evidence.push(
          makeEvidence(
            {
              members: [branchIndex, branchIndex],
              relation: 'punishment',
              name: '지지자형',
              subtype,
              polarity: 'friction',
              confidence: 0.98
            },
            pair
          )
        );
      }
    }
  }

  for (const rule of BRANCH_GROUP_RULES) {
    for (const combination of groupCombinations(rule.members, branches)) {
      if (scopeMatches(combination, options)) evidence.push(makeEvidence(rule, combination));
    }
  }

  return uniqueEvidence(evidence);
}
