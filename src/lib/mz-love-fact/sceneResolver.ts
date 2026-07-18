import { getMzLoveScene } from './sceneManifest';
import { MZ_LOVE_CHAPTER_IDS, MZ_LOVE_SCENE_KEYS } from './types';
import type {
  DerivedRelationshipFact,
  LoveReportChapter,
  MzLoveChapterId,
  MzLoveSceneKey,
  RelationshipStatus,
  SceneArtwork,
} from './types';

export interface ResolveMzLoveSceneInput {
  chapterId: MzLoveChapterId;
  relationshipStatus: RelationshipStatus;
  derivedFacts?: readonly DerivedRelationshipFact[];
  timingSignals?: readonly string[];
  riskFlags?: readonly string[];
  previouslyUsedScenes?: Iterable<MzLoveSceneKey>;
}

const CHAPTER_SCENE_CANDIDATES: Record<MzLoveChapterId, readonly MzLoveSceneKey[]> = {
  'love-self': ['love-self-mirror', 'self-worth-crown', 'boundary-circle', 'whisper-fact'],
  'repeated-attraction': ['red-thread-knot', 'attraction-danger', 'attraction-spark', 'closure-thread-cut', 'room-corridor'],
  'attracted-partner': ['future-partner-fan', 'attraction-spark', 'moonlit-date', 'whisper-fact'],
  'lasting-partner': ['stable-partner-signal', 'longevity-lantern', 'moonlit-date', 'room-consultation'],
  'attraction-comparison': ['attraction-vs-longevity', 'attraction-spark', 'longevity-lantern'],
  'next-partner': ['whisper-fact', 'friend-introduction-door', 'work-connection-table', 'hobby-meeting-studio', 'hero-fan-closed'],
  'meeting-scenes': ['first-meeting-scene', 'friend-introduction-door', 'work-connection-table', 'hobby-meeting-studio', 'moonlit-date'],
  'twelve-month-timing': ['timing-rising-moon', 'timing-pause-moon', 'moonlit-date', 'room-corridor'],
  'communication-pattern': ['waiting-for-message', 'message-do-dont', 'boundary-circle'],
  'relationship-status': ['room-consultation', 'reunion-shadow', 'closure-thread-cut', 'boundary-circle'],
  'relationship-flags': ['red-flag-warning', 'green-flag-lantern', 'boundary-circle', 'hero-fan-closed'],
  'action-plan': ['green-flag-lantern', 'action-plan-calendar', 'message-do-dont', 'boundary-circle', 'hero-fan-closed'],
  'final-fact': ['final-fact-bomb', 'report-seal-final', 'closure-thread-cut'],
};

const STATUS_PREFERENCES: Partial<Record<RelationshipStatus, readonly MzLoveSceneKey[]>> = {
  single: ['first-meeting-scene', 'future-partner-fan', 'friend-introduction-door', 'hobby-meeting-studio'],
  meeting: ['first-meeting-scene', 'stable-partner-signal', 'moonlit-date'],
  situationship: ['attraction-danger', 'waiting-for-message', 'message-do-dont', 'boundary-circle'],
  dating: ['stable-partner-signal', 'room-consultation', 'moonlit-date', 'longevity-lantern'],
  ambiguous: ['waiting-for-message', 'attraction-danger', 'message-do-dont', 'boundary-circle'],
  'breakup-reunion': ['room-corridor', 'room-consultation', 'reunion-shadow', 'closure-thread-cut'],
  'long-term': ['stable-partner-signal', 'room-consultation', 'longevity-lantern'],
};

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function semanticPreferences(input: ResolveMzLoveSceneInput): MzLoveSceneKey[] {
  const text = [
    ...(input.derivedFacts ?? []).map((fact) => fact.statement),
    ...(input.timingSignals ?? []),
    ...(input.riskFlags ?? []),
  ].join(' ');
  const preferred: MzLoveSceneKey[] = [];
  if (/(반복|얽힘|매듭|꼬인|패턴)/.test(text)) preferred.push('red-thread-knot');
  if (/(불확실|회피|애매|위험|불안|경계|레드\s*플래그)/.test(text)) {
    preferred.push('red-flag-warning', 'attraction-danger');
  }
  if (/(안정|명확|일관|책임|회복|그린\s*플래그|실천|행동\s*기준)/.test(text)) {
    preferred.push('green-flag-lantern', 'stable-partner-signal');
  }
  if (/(12개월|열두\s*달|월별|시기|타이밍|흐름|대운|세운)/.test(text)) preferred.push('timing-rising-moon');
  if (/(잠시\s*멈|멈춤|속도(?:를|가)?\s*늦|정체\s*구간|관망)/.test(text)) preferred.unshift('timing-pause-moon');
  if (/(관계\s*정리|놓아\s*보내|종결|마침표|끝내야)/.test(text)) preferred.push('closure-thread-cut');
  if (/(경계선|기준선|선을\s*지키|거리\s*두기|단호한\s*기준)/.test(text)) preferred.unshift('boundary-circle');
  if (/(30일|삼십\s*일|주차별|체크리스트|행동\s*계획|실천\s*계획)/.test(text)) preferred.unshift('action-plan-calendar');
  if (/(보낼까|말까|문자|카톡|DM|디엠)/i.test(text)) preferred.push('message-do-dont');
  if (/(불꽃|스파크|첫눈에|번쩍(?:이는|인)?\s*끌림)/.test(text)) preferred.push('attraction-spark');
  if (/(장기적인|지속되는|꾸준한|오래가는)/.test(text)) preferred.push('longevity-lantern');
  if (/(자존감|자기\s*가치|나를\s*먼저)/.test(text)) preferred.push('self-worth-crown');
  if (/(친구|지인)\s*(?:의\s*)?소개/.test(text)) preferred.push('friend-introduction-door');
  if (/(직장|프로젝트|업무|동료)/.test(text)) preferred.push('work-connection-table');
  if (/(취미|공방|클래스|동호회)/.test(text)) preferred.push('hobby-meeting-studio');
  if (/(달빛|밤\s*산책|데이트)/.test(text)) preferred.push('moonlit-date');
  if (/(재회|다시\s*만나|전\s*연인)/.test(text)) preferred.push('reunion-shadow');
  if (/(최종\s*요약|리포트\s*완성|결론을\s*내)/.test(text)) preferred.push('report-seal-final');
  if (/(연락|답장|메시지)/.test(text)) preferred.push('waiting-for-message');
  if (/(새로운|소개|모임|업무|만남)/.test(text)) preferred.push('first-meeting-scene');
  return preferred;
}

/**
 * Selects an existing artwork deterministically. Supplying previously used
 * keys guarantees the resolver never returns the same scene twice.
 */
export function resolveMzLoveScene(input: ResolveMzLoveSceneInput): SceneArtwork | null {
  const used = new Set(input.previouslyUsedScenes ?? []);
  const semantic = semanticPreferences(input).filter((key) =>
    CHAPTER_SCENE_CANDIDATES[input.chapterId].includes(key),
  );
  const candidates = unique([
    ...semantic,
    ...CHAPTER_SCENE_CANDIDATES[input.chapterId],
    ...(STATUS_PREFERENCES[input.relationshipStatus] ?? []),
    ...MZ_LOVE_SCENE_KEYS,
  ]);
  const selected = candidates.find((key) => !used.has(key));
  return selected ? getMzLoveScene(selected) : null;
}

export function resolveMzLoveChapterScenes(
  chapters: readonly Pick<LoveReportChapter, 'id' | 'derivedFacts'>[],
  relationshipStatus: RelationshipStatus,
): ReadonlyMap<MzLoveChapterId, SceneArtwork | null> {
  const used = new Set<MzLoveSceneKey>();
  const result = new Map<MzLoveChapterId, SceneArtwork | null>();
  const ordered = [...chapters].sort(
    (left, right) => MZ_LOVE_CHAPTER_IDS.indexOf(left.id) - MZ_LOVE_CHAPTER_IDS.indexOf(right.id),
  );
  for (const chapter of ordered) {
    const scene = resolveMzLoveScene({
      chapterId: chapter.id,
      relationshipStatus,
      derivedFacts: chapter.derivedFacts,
      previouslyUsedScenes: used,
    });
    if (scene) used.add(scene.key);
    result.set(chapter.id, scene);
  }
  return result;
}

export function hasDuplicateMzLoveScenes(
  scenes: Iterable<SceneArtwork | MzLoveSceneKey | null>,
): boolean {
  const seen = new Set<MzLoveSceneKey>();
  for (const scene of scenes) {
    if (!scene) continue;
    const key = typeof scene === 'string' ? scene : scene.key;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
