import { describe, expect, it } from 'vitest';
import { getTwelveYunseong, tenGod } from '../baziCalcs';
import { BRANCH_ELEM, DZ, ELEMENT, HIDDEN_STEMS, TG } from '../constants';
import { detectRelations } from '../v2/interactions/relations';
import type { RelationComponent, RelationKind, RelationParticipant } from '../v2/interactions/types';
import {
  branches,
  independentHiddenStems,
  independentStandardRelations,
  independentTenGod,
  independentTwelveStage,
  stems
} from './independentTables';

function participant(label: string, component: RelationComponent, index: number, id: string): RelationParticipant {
  return {
    id,
    layer: 'natal',
    position: id === 'left' ? 'year' : 'month',
    component,
    index,
    label: label as RelationParticipant['label'],
    element: component === 'stem'
      ? ELEMENT[label as keyof typeof ELEMENT]
      : BRANCH_ELEM[label as keyof typeof BRANCH_ELEM]
  };
}

function relationExists(pair: string, component: RelationComponent, relation: RelationKind) {
  const labels = [...pair];
  const table = component === 'stem' ? stems : branches;
  const evidence = detectRelations([
    participant(labels[0], component, table.indexOf(labels[0] as never), 'left'),
    participant(labels[1], component, table.indexOf(labels[1] as never), 'right')
  ]);
  return evidence.some((item) => item.relation === relation);
}

describe('independently sourced deterministic mapping tables', () => {
  it('cross-checks all 120 twelve-stage cells against the cited external table', () => {
    const comparisons = stems.flatMap((stem, stemIndex) =>
      branches.map((branch, branchIndex) => ({
        expected: independentTwelveStage(stem, branch),
        actual: getTwelveYunseong(stemIndex, branchIndex)
      }))
    );
    expect(comparisons).toHaveLength(120);
    expect(comparisons.filter((item) => item.expected !== item.actual)).toEqual([]);
  });

  it('cross-checks all 100 stem-to-stem Ten-God cells', () => {
    const comparisons = stems.flatMap((dayStem, dayIndex) =>
      stems.map((targetStem, targetIndex) => ({
        expected: independentTenGod(dayStem, targetStem),
        actual: tenGod(dayIndex, targetIndex)
      }))
    );
    expect(comparisons).toHaveLength(100);
    expect(comparisons.filter((item) => item.expected !== item.actual)).toEqual([]);
  });

  it('cross-checks all 12 canonical hidden-stem rows and their order', () => {
    const actual = Object.fromEntries(
      DZ.map((branch) => [branch, HIDDEN_STEMS[branch].map((index) => TG[index])])
    );
    expect(actual).toEqual(independentHiddenStems);
  });

  it('cross-checks 33 standard pair relations and keeps policy-sensitive relations out', () => {
    const checks = [
      ...independentStandardRelations.stemCombination.map((pair) => relationExists(pair, 'stem', 'stem-combination')),
      ...independentStandardRelations.stemClash.map((pair) => relationExists(pair, 'stem', 'stem-clash')),
      ...independentStandardRelations.branchCombination.map((pair) => relationExists(pair, 'branch', 'six-combination')),
      ...independentStandardRelations.branchClash.map((pair) => relationExists(pair, 'branch', 'clash')),
      ...independentStandardRelations.branchBreak.map((pair) => relationExists(pair, 'branch', 'break')),
      ...independentStandardRelations.branchHarm.map((pair) => relationExists(pair, 'branch', 'harm'))
    ];
    expect(checks).toHaveLength(33);
    expect(checks.every(Boolean)).toBe(true);
  });
});
