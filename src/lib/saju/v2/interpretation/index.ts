import type { Bazi } from '../../types';
import { buildYongsinConsensus } from './consensus';
import { analyzeInterpretationFoundations } from './foundations';
import type { ExpertInterpretation } from './types';
import { analyzeYongsinOpinions } from './yongsin';

export function analyzeExpertInterpretation(bazi: Bazi): ExpertInterpretation {
  const foundations = analyzeInterpretationFoundations(bazi);
  const yongsinOpinions = analyzeYongsinOpinions(bazi, foundations);
  const consensus = buildYongsinConsensus(yongsinOpinions);

  return {
    foundations,
    yongsinOpinions,
    consensus
  };
}

export { buildYongsinConsensus } from './consensus';
export {
  analyzeClimate,
  analyzeElementPower,
  analyzeExposures,
  analyzeHiddenStemSeasonality,
  analyzeInterpretationFoundations,
  analyzeMonthCommand,
  analyzeStemRoots
} from './foundations';
export { INTERPRETATION_ENGINE_VERSION } from './types';
export type * from './types';
export { analyzeYongsinOpinions } from './yongsin';
