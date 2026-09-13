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
  return detectRelations([
    participant(labels[0], component, table.indexOf(labels[0] as never), 'left'),
    participant(labels[1], component, table.indexOf(labels[1] as never), 'right')
  ]).some((item) => item.relation === relation);
}

function result(total: number, mismatches: number) {
  return { total, matches: total - mismatches, mismatches };
}

export function evaluateIndependentTables() {
  const twelveStageMismatches = stems.flatMap((stem, stemIndex) =>
    branches.map((branch, branchIndex) =>
      independentTwelveStage(stem, branch) === getTwelveYunseong(stemIndex, branchIndex)
    )
  ).filter((match) => !match).length;
  const tenGodMismatches = stems.flatMap((dayStem, dayIndex) =>
    stems.map((targetStem, targetIndex) => independentTenGod(dayStem, targetStem) === tenGod(dayIndex, targetIndex))
  ).filter((match) => !match).length;
  const hiddenStemMismatches = DZ.filter((branch) =>
    JSON.stringify(HIDDEN_STEMS[branch].map((index) => TG[index])) !== JSON.stringify(independentHiddenStems[branch])
  ).length;
  const relationChecks = [
    ...independentStandardRelations.stemCombination.map((pair) => relationExists(pair, 'stem', 'stem-combination')),
    ...independentStandardRelations.stemClash.map((pair) => relationExists(pair, 'stem', 'stem-clash')),
    ...independentStandardRelations.branchCombination.map((pair) => relationExists(pair, 'branch', 'six-combination')),
    ...independentStandardRelations.branchClash.map((pair) => relationExists(pair, 'branch', 'clash')),
    ...independentStandardRelations.branchBreak.map((pair) => relationExists(pair, 'branch', 'break')),
    ...independentStandardRelations.branchHarm.map((pair) => relationExists(pair, 'branch', 'harm'))
  ];
  return {
    twelveStages: result(120, twelveStageMismatches),
    tenGods: result(100, tenGodMismatches),
    hiddenStems: result(12, hiddenStemMismatches),
    standardRelations: result(33, relationChecks.filter((match) => !match).length),
    policySensitiveRelationsExcluded: ['punishment', 'resentment', 'partial-three-harmony', 'combination-transformation']
  };
}
