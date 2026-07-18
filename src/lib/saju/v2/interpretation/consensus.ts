import { ELEM_ORDER, type FiveElement } from '../../constants';
import { RULES, clamp, makeConfidence, makeEvidence, round } from './rules';
import type {
  ConsensusAssessment,
  ConsensusConflict,
  ConsensusContribution,
  ConsensusElement,
  Evidence,
  RuleResult,
  YongsinMethod,
  YongsinOpinion
} from './types';

function uniqueEvidence(items: Evidence[]): Evidence[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function candidateOppositionScore(score: number, evidence: Evidence[]): number {
  if (evidence.length === 0) return 0;
  const evidenceWeight = evidence.reduce((sum, item) => sum + item.weight, 0) / evidence.length;
  return round(clamp(Math.max(score * 0.55, evidenceWeight * 0.7)));
}

function contributionsForElement(opinions: YongsinOpinion[], element: FiveElement) {
  const supporting: ConsensusContribution[] = [];
  const opposing: ConsensusContribution[] = [];

  opinions.forEach((opinion) => {
    opinion.value.candidates.filter((item) => item.element === element).forEach((item) => {
      supporting.push({
        method: opinion.method,
        score: item.score,
        confidence: opinion.confidence.score,
        evidence: uniqueEvidence(item.supportingEvidence)
      });
      if (item.opposingEvidence.length > 0) {
        opposing.push({
          method: opinion.method,
          score: candidateOppositionScore(item.score, item.opposingEvidence),
          confidence: opinion.confidence.score,
          evidence: uniqueEvidence(item.opposingEvidence)
        });
      }
    });
    opinion.value.cautions.filter((item) => item.element === element).forEach((item) => {
      opposing.push({
        method: opinion.method,
        score: item.score,
        confidence: opinion.confidence.score,
        evidence: uniqueEvidence(item.opposingEvidence.length > 0 ? item.opposingEvidence : item.supportingEvidence)
      });
    });
  });

  return { supporting, opposing };
}

function buildElementRanking(opinions: YongsinOpinion[]): ConsensusElement[] {
  return ELEM_ORDER.map((element) => {
    const { supporting, opposing } = contributionsForElement(opinions, element);
    const positive = supporting.reduce((sum, item) => sum + item.score * item.confidence, 0);
    const negative = opposing.reduce((sum, item) => sum + item.score * item.confidence, 0);
    const normalizer = Math.max(1, positive + negative);
    const methods = new Set(supporting.map((item) => item.method));
    return {
      element,
      netScore: round(clamp((positive - negative) / normalizer, -1, 1)),
      supporting,
      opposing,
      agreementCount: methods.size,
      hasConflict: supporting.length > 0 && opposing.length > 0
    };
  })
    .filter((item) => item.supporting.length > 0 || item.opposing.length > 0)
    .sort((left, right) => right.netScore - left.netScore || right.agreementCount - left.agreementCount);
}

function buildDirectConflicts(ranking: ConsensusElement[]): ConsensusConflict[] {
  return ranking.filter((item) => item.hasConflict).map((item) => {
    const methods = [...new Set([...item.supporting, ...item.opposing].map((entry) => entry.method))];
    return {
      type: 'direct-opposition',
      element: item.element,
      methods,
      description: `${item.element}은(는) ${item.supporting.map((entry) => entry.method).join('·')} 관점의 후보인 동시에 ${item.opposing.map((entry) => entry.method).join('·')} 관점의 주의 요소다.`,
      evidence: uniqueEvidence([
        ...item.supporting.flatMap((entry) => entry.evidence),
        ...item.opposing.flatMap((entry) => entry.evidence)
      ])
    };
  });
}

function buildPriorityDivergence(opinions: YongsinOpinion[]): ConsensusConflict[] {
  const tops = opinions.flatMap((opinion) => {
    const top = opinion.value.candidates[0];
    return top ? [{ method: opinion.method, candidate: top }] : [];
  });
  const distinct = new Set(tops.map((item) => item.candidate.element));
  if (tops.length < 2 || distinct.size < 2) return [];
  return [{
    type: 'priority-divergence',
    element: null,
    methods: tops.map((item) => item.method),
    description: `독립 용신법의 1순위가 ${tops.map((item) => `${item.method}:${item.candidate.element}`).join(', ')}로 갈린다. 이는 오류로 삭제하지 않고 판단 순서가 필요한 쟁점으로 남긴다.`,
    evidence: uniqueEvidence(tops.flatMap((item) => [
      ...item.candidate.supportingEvidence,
      ...item.candidate.opposingEvidence
    ]))
  }];
}

function contributingMethods(ranking: ConsensusElement[]): YongsinMethod[] {
  return [...new Set(ranking.flatMap((item) => item.supporting.map((entry) => entry.method)))];
}

export function buildYongsinConsensus(opinions: YongsinOpinion[]): RuleResult<ConsensusAssessment> {
  const rule = RULES.consensus;
  const ranking = buildElementRanking(opinions);
  const directConflicts = buildDirectConflicts(ranking);
  const conflicts = [...directConflicts, ...buildPriorityDivergence(opinions)];
  const top = ranking.find((item) => item.netScore > 0);
  const primaryCandidates = top && top.netScore >= 0.12
    ? ranking
        .filter((item) => item.netScore > 0 && top.netScore - item.netScore <= 0.12)
        .map((item) => item.element)
    : [];
  const second = ranking.find((item) => item !== top && item.netScore > 0);
  const narrowMargin = Boolean(top && second && top.netScore - second.netScore < 0.08);
  const unresolved = primaryCandidates.length === 0 || directConflicts.length > 0 || narrowMargin;
  const methods = contributingMethods(ranking);
  const averageConfidence = methods.length === 0
    ? 0
    : opinions
        .filter((opinion) => methods.includes(opinion.method))
        .reduce((sum, opinion) => sum + opinion.confidence.score, 0) / methods.length;
  const agreement = top && methods.length > 0 ? top.agreementCount / methods.length : 0;
  const confidenceScore = Math.min(0.78, clamp(
    0.2 + methods.length / 5 * 0.3 + agreement * 0.25 + averageConfidence * 0.25 - directConflicts.length * 0.07
  ));
  const status = primaryCandidates.length === 0
    ? 'insufficient'
    : top && top.agreementCount >= 2 && directConflicts.length === 0
      ? 'supported'
      : 'conditional';
  const summary = primaryCandidates.length === 0
    ? '독립 용신법을 합성했으나 우선 후보를 정할 근거가 충분하지 않다.'
    : `${primaryCandidates.join('·')}을(를) 우선 검토 후보로 제시하되${unresolved ? ' 충돌과 근접 점수를 함께 검토해야 한다.' : ' 복수 관점의 일치 근거가 있다.'}`;
  const aggregateEvidence = [
    makeEvidence(
      rule,
      'method-coverage',
      'context',
      `독립 용신법 ${opinions.length}개 중 후보를 낸 관점은 ${methods.length}개다.`,
      methods.length / 5,
      opinions.map((opinion) => opinion.ruleId)
    ),
    ...(top ? [makeEvidence(
      rule,
      `top-${top.element}`,
      'support',
      `${top.element}의 합성 순점수는 ${top.netScore}, 지지 관점 수는 ${top.agreementCount}개다.`,
      Math.max(0.35, top.netScore),
      top.supporting.map((item) => item.method)
    )] : []),
    ...directConflicts.map((conflict, index) => makeEvidence(
      rule,
      `direct-conflict-${conflict.element}-${index}`,
      'opposition',
      conflict.description,
      0.8,
      conflict.methods
    ))
  ];

  return {
    ...rule,
    status,
    value: {
      summary,
      ranking,
      primaryCandidates,
      conflicts,
      unresolved
    },
    confidence: makeConfidence(
      confidenceScore,
      ['후보 점수에 각 독립 관점의 신뢰도를 곱하고 찬반을 모두 합산했다.'],
      conflicts.length > 0 ? ['관점 간 충돌이 있어 전문가의 우선순위 판단이 필요하다.'] : []
    ),
    evidence: aggregateEvidence,
    caveats: [
      '합성 1위는 확정 용신이 아니라 우선 검토 후보다.',
      '찬성 근거와 반대 근거는 ranking의 supporting·opposing에 원문 Evidence로 보존된다.'
    ]
  };
}
