import { describe, expect, it } from 'vitest';
import type { GZ } from '../../types';
import {
  createGzParticipants,
  detectRelations,
  type PillarPosition,
  type RelationLayer,
  type RelationParticipant
} from './index';

let participantSequence = 0;

function component(
  gz: GZ,
  componentName: 'stem' | 'branch',
  layer: RelationLayer = 'natal',
  position: PillarPosition = 'luck'
): RelationParticipant {
  participantSequence += 1;
  const participants = createGzParticipants(
    gz,
    layer,
    position,
    'test:' + participantSequence
  );
  const found = participants.find((participant) => participant.component === componentName);
  if (!found) throw new Error('participant not created');
  return found;
}

function relationNames(participants: RelationParticipant[]) {
  return detectRelations(participants).map((relation) => relation.subtype || relation.name);
}

describe('v2 relation evidence engine', () => {
  it('detects all five stem combinations with their transformation element', () => {
    const cases: Array<[number, number, string]> = [
      [0, 5, '토'],
      [1, 6, '금'],
      [2, 7, '수'],
      [3, 8, '목'],
      [4, 9, '화']
    ];
    for (const [left, right, transformedElement] of cases) {
      const result = detectRelations([
        component({ tg: left, dz: 0 }, 'stem'),
        component({ tg: right, dz: 0 }, 'stem')
      ]);
      const combination = result.find((relation) => relation.relation === 'stem-combination');
      expect(combination?.transformedElement).toBe(transformedElement);
      expect(combination?.uncertainty.join(' ')).toContain('합화');
    }
  });

  it('detects the four classical stem clashes', () => {
    const cases = [
      [0, 6],
      [1, 7],
      [2, 8],
      [3, 9]
    ];
    for (const [left, right] of cases) {
      const result = detectRelations([
        component({ tg: left, dz: 0 }, 'stem'),
        component({ tg: right, dz: 0 }, 'stem')
      ]);
      expect(result.some((relation) => relation.relation === 'stem-clash')).toBe(true);
    }
  });

  it('detects branch six-combination, clash, punishment, break, harm, and resentment independently', () => {
    expect(
      detectRelations([
        component({ tg: 0, dz: 0 }, 'branch'),
        component({ tg: 0, dz: 1 }, 'branch')
      ]).some((relation) => relation.relation === 'six-combination')
    ).toBe(true);
    expect(
      detectRelations([
        component({ tg: 0, dz: 0 }, 'branch'),
        component({ tg: 0, dz: 6 }, 'branch')
      ]).some((relation) => relation.relation === 'clash')
    ).toBe(true);
    expect(
      detectRelations([
        component({ tg: 0, dz: 0 }, 'branch'),
        component({ tg: 0, dz: 3 }, 'branch')
      ]).some((relation) => relation.relation === 'punishment')
    ).toBe(true);
    expect(
      detectRelations([
        component({ tg: 0, dz: 0 }, 'branch'),
        component({ tg: 0, dz: 9 }, 'branch')
      ]).some((relation) => relation.relation === 'break')
    ).toBe(true);

    const overlapping = detectRelations([
      component({ tg: 0, dz: 0 }, 'branch'),
      component({ tg: 0, dz: 7 }, 'branch')
    ]);
    expect(overlapping.some((relation) => relation.relation === 'harm')).toBe(true);
    expect(overlapping.some((relation) => relation.relation === 'resentment')).toBe(true);
  });

  it('keeps overlapping relations instead of choosing one doctrine silently', () => {
    const result = detectRelations([
      component({ tg: 0, dz: 5 }, 'branch'),
      component({ tg: 0, dz: 8 }, 'branch')
    ]);
    expect(result.map((relation) => relation.relation)).toEqual(
      expect.arrayContaining(['six-combination', 'punishment', 'break'])
    );
  });

  it('detects self punishment only when the branch is repeated', () => {
    const single = detectRelations([component({ tg: 0, dz: 4 }, 'branch')]);
    expect(single.some((relation) => relation.subtype === '진진 자형')).toBe(false);

    const repeated = detectRelations([
      component({ tg: 0, dz: 4 }, 'branch', 'natal', 'year'),
      component({ tg: 0, dz: 4 }, 'branch', 'natal', 'day')
    ]);
    expect(repeated.some((relation) => relation.subtype === '진진 자형')).toBe(true);
  });

  it('applies cross-layer scope correctly when self-punishment occurs in several layers', () => {
    const natalYear = component({ tg: 0, dz: 6 }, 'branch', 'natal', 'year');
    const natalDay = component({ tg: 0, dz: 6 }, 'branch', 'natal', 'day');
    const dayun = component({ tg: 0, dz: 6 }, 'branch', 'dayun', 'luck');
    const cross = detectRelations([natalYear, natalDay, dayun], {
      scope: 'cross-layer-only'
    }).filter((relation) => relation.subtype === '오오 자형');
    const within = detectRelations([natalYear, natalDay, dayun], {
      scope: 'within-layer-only'
    }).filter((relation) => relation.subtype === '오오 자형');

    expect(cross).toHaveLength(2);
    expect(within).toHaveLength(1);
  });

  it('requires all three members for three-harmony and seasonal-harmony', () => {
    const incomplete = detectRelations([
      component({ tg: 0, dz: 8 }, 'branch'),
      component({ tg: 0, dz: 0 }, 'branch')
    ]);
    expect(incomplete.some((relation) => relation.relation === 'three-harmony')).toBe(false);

    const threeHarmony = detectRelations([
      component({ tg: 0, dz: 8 }, 'branch'),
      component({ tg: 0, dz: 0 }, 'branch'),
      component({ tg: 0, dz: 4 }, 'branch')
    ]);
    expect(threeHarmony.some((relation) => relation.subtype === '신자진 수국')).toBe(true);

    const seasonal = detectRelations([
      component({ tg: 0, dz: 2 }, 'branch'),
      component({ tg: 0, dz: 3 }, 'branch'),
      component({ tg: 0, dz: 4 }, 'branch')
    ]);
    expect(seasonal.some((relation) => relation.subtype === '인묘진 목방')).toBe(true);
  });

  it('honors cross-layer scope and is invariant to participant order', () => {
    const personA = component({ tg: 0, dz: 0 }, 'branch', 'personA', 'day');
    const personASecond = component({ tg: 0, dz: 1 }, 'branch', 'personA', 'month');
    const personB = component({ tg: 0, dz: 1 }, 'branch', 'personB', 'day');
    const cross = detectRelations([personA, personASecond, personB], {
      scope: 'cross-layer-only'
    });
    expect(
      cross.every(
        (relation) => new Set(relation.participants.map((participant) => participant.layer)).size > 1
      )
    ).toBe(true);

    const forward = relationNames([personA, personB]).sort();
    const reverse = relationNames([personB, personA]).sort();
    expect(reverse).toEqual(forward);
  });
});
