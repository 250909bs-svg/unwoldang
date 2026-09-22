import type { GuiyeondoPerson, GuiyeondoRelationshipType, GuiyeondoVector } from './types';

/**
 * 귀연도에 연결된 사람들을 한 줄로 세운다.
 *
 * **점수를 지어내지 않는다.** 궁합 엔진은 0~100 종합점수를 의도적으로 만들지 않고
 * (`relationshipAnalysis.ts` 의 "임의 점수를 만들지 않았습니다"), 벡터마다
 * `tendency`(supportive / conditional / tension / insufficient)와 `confidence` 만 낸다.
 * 그래서 순위도 그 두 값에서만 끌어온다. 화면에 쓰는 숫자는 전부 **실제로 센 신호 개수**다.
 *
 * 정렬 기준은 위에서부터:
 *   1) 근거가 확정된 사람이 먼저 (분류 미확정은 아래로)
 *   2) 지지 신호에서 마찰 신호를 뺀 수
 *   3) 지지 신호 수
 *   4) 확정된 신호들의 평균 확신도
 *   5) 이름 (같은 값일 때 순서가 매번 흔들리지 않게)
 */

export type GuiyeondoSignalTally = {
  /** 근거가 확정된 벡터만 센다. supported=false 는 어느 칸에도 넣지 않는다. */
  supportive: number;
  conditional: number;
  tension: number;
  /** 엔진이 독립 근거를 확정하지 못한 벡터 수. */
  unresolved: number;
  /** 확정된 벡터들의 평균 확신도. 확정된 게 없으면 null. */
  averageConfidence: number | null;
};

export type GuiyeondoRankedConnection = {
  person: GuiyeondoPerson;
  /** 1부터. 분류 미확정도 번호를 받되 항상 뒤로 간다. */
  rank: number;
  type: GuiyeondoRelationshipType | null;
  classified: boolean;
  tally: GuiyeondoSignalTally;
  /** 정렬에 쓴 값. 화면에는 점수로 내보이지 않는다. */
  netSupport: number;
};

export function tallyGuiyeondoSignals(vectors: readonly GuiyeondoVector[]): GuiyeondoSignalTally {
  const tally: GuiyeondoSignalTally = {
    supportive: 0,
    conditional: 0,
    tension: 0,
    unresolved: 0,
    averageConfidence: null
  };

  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const vector of vectors) {
    if (!vector.supported || vector.tendency === 'insufficient') {
      tally.unresolved += 1;
      continue;
    }

    if (vector.tendency === 'supportive') tally.supportive += 1;
    else if (vector.tendency === 'tension') tally.tension += 1;
    else tally.conditional += 1;

    confidenceSum += vector.confidence;
    confidenceCount += 1;
  }

  if (confidenceCount > 0) {
    tally.averageConfidence = confidenceSum / confidenceCount;
  }

  return tally;
}

export function rankGuiyeondoConnections(
  people: readonly GuiyeondoPerson[]
): GuiyeondoRankedConnection[] {
  const rows = people.map((person) => {
    const tally = tallyGuiyeondoSignals(person.analysis.vectors);
    const type = person.analysis.classification.type;

    return {
      person,
      type,
      classified: Boolean(type),
      tally,
      netSupport: tally.supportive - tally.tension,
      rank: 0
    };
  });

  rows.sort((a, b) => {
    if (a.classified !== b.classified) return a.classified ? -1 : 1;
    if (a.netSupport !== b.netSupport) return b.netSupport - a.netSupport;
    if (a.tally.supportive !== b.tally.supportive) return b.tally.supportive - a.tally.supportive;

    const aConfidence = a.tally.averageConfidence ?? -1;
    const bConfidence = b.tally.averageConfidence ?? -1;
    if (aConfidence !== bConfidence) return bConfidence - aConfidence;

    return a.person.name.localeCompare(b.person.name, 'ko-KR');
  });

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

/** 목록 한 줄에 붙일 요약. 센 개수만 쓰고, 없는 칸은 아예 빼서 0 이 나열되지 않게 한다. */
export function describeGuiyeondoTally(tally: GuiyeondoSignalTally): string {
  const parts: string[] = [];
  if (tally.supportive) parts.push(`지지 ${tally.supportive}`);
  if (tally.conditional) parts.push(`조건부 ${tally.conditional}`);
  if (tally.tension) parts.push(`마찰 ${tally.tension}`);
  if (parts.length === 0) return '확정된 신호 없음';
  return parts.join(' · ');
}
