import { describe, expect, it } from 'vitest';
import {
  describeGuiyeondoTally,
  rankGuiyeondoConnections,
  tallyGuiyeondoSignals
} from './connectionRanking';
import type { GuiyeondoPerson, GuiyeondoRelationshipType, GuiyeondoVector } from './types';

const vector = (
  tendency: GuiyeondoVector['tendency'],
  confidence = 0.8,
  supported = tendency !== 'insufficient'
): GuiyeondoVector => ({
  id: 'romance',
  label: '연애 흐름',
  statement: '',
  tendency,
  confidence,
  evidenceIds: [],
  uncertainty: [],
  supported
});

const person = (
  name: string,
  vectors: GuiyeondoVector[],
  type: GuiyeondoRelationshipType | null = 'soulmate'
): GuiyeondoPerson => ({
  id: name,
  name,
  source: 'direct',
  createdAt: '2026-01-01T00:00:00.000Z',
  analysis: {
    status: 'full',
    calendarVersions: { owner: 'v1', guest: 'v1' },
    compatibilityEngineVersion: '2.0.0',
    purposes: {} as GuiyeondoPerson['analysis']['purposes'],
    vectors,
    classification: {
      type,
      status: type ? 'provisional' : 'insufficient',
      policyVersion: type ? 'guiyeondo-exploration-v0.1' : null,
      evidenceIds: []
    },
    calculationFingerprint: 'fp',
    uncertainty: []
  }
});

describe('귀연도 연결 순위', () => {
  it('근거가 확정되지 않은 벡터는 어느 칸에도 세지 않는다', () => {
    const tally = tallyGuiyeondoSignals([
      vector('supportive'),
      vector('tension'),
      vector('conditional'),
      vector('insufficient', 0),
      vector('supportive', 0.9, false) // supported=false 는 tendency 와 무관하게 미확정
    ]);

    expect(tally).toMatchObject({ supportive: 1, conditional: 1, tension: 1, unresolved: 2 });
    // 확정된 셋의 평균만 낸다. 미확정의 0 이 평균을 끌어내리면 안 된다.
    expect(tally.averageConfidence).toBeCloseTo(0.8, 5);
  });

  it('확정된 신호가 없으면 평균 확신도는 null 이다', () => {
    expect(tallyGuiyeondoSignals([vector('insufficient', 0)]).averageConfidence).toBeNull();
    expect(tallyGuiyeondoSignals([]).averageConfidence).toBeNull();
  });

  it('지지에서 마찰을 뺀 수가 큰 사람이 위로 온다', () => {
    const ranked = rankGuiyeondoConnections([
      person('마찰많음', [vector('supportive'), vector('tension'), vector('tension')]),
      person('지지많음', [vector('supportive'), vector('supportive'), vector('supportive')]),
      person('보통', [vector('supportive'), vector('supportive'), vector('tension')])
    ]);

    expect(ranked.map((row) => row.person.name)).toEqual(['지지많음', '보통', '마찰많음']);
    expect(ranked.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it('분류가 확정되지 않은 사람은 신호가 좋아도 아래로 간다', () => {
    const ranked = rankGuiyeondoConnections([
      person('미확정', [vector('supportive'), vector('supportive'), vector('supportive')], null),
      person('확정', [vector('tension'), vector('tension')], 'caution-relation')
    ]);

    expect(ranked.map((row) => row.person.name)).toEqual(['확정', '미확정']);
    expect(ranked[1].classified).toBe(false);
  });

  it('같은 값이면 확신도로, 그래도 같으면 이름으로 갈라 순서가 흔들리지 않는다', () => {
    const build = () =>
      rankGuiyeondoConnections([
        person('나윤', [vector('supportive', 0.6)]),
        person('가온', [vector('supportive', 0.6)]),
        person('다래', [vector('supportive', 0.9)])
      ]).map((row) => row.person.name);

    expect(build()).toEqual(['다래', '가온', '나윤']);
    // 같은 입력이면 몇 번을 돌려도 같은 순서여야 한다.
    expect(build()).toEqual(build());
  });

  it('요약 문구는 0 인 칸을 늘어놓지 않는다', () => {
    expect(
      describeGuiyeondoTally(tallyGuiyeondoSignals([vector('supportive'), vector('supportive')]))
    ).toBe('지지 2');
    expect(
      describeGuiyeondoTally(tallyGuiyeondoSignals([vector('supportive'), vector('tension')]))
    ).toBe('지지 1 · 마찰 1');
    expect(describeGuiyeondoTally(tallyGuiyeondoSignals([vector('insufficient', 0)]))).toBe(
      '확정된 신호 없음'
    );
  });
});
