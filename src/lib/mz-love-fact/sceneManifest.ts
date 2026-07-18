import { MZ_LOVE_SCENE_KEYS } from './types';
import type { MzLoveSceneKey, SceneArtwork } from './types';

const GENERATED_ROOT = '/images/mz-love-fact/generated';

export const MZ_LOVE_SCENE_MANIFEST = {
  'hero-fan-closed': { key: 'hero-fan-closed', src: `${GENERATED_ROOT}/hero-fan-closed.webp`, alt: '접힌 검붉은 부채를 들고 정면을 바라보는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.28 }, kind: 'character' },
  'whisper-fact': { key: 'whisper-fact', src: `${GENERATED_ROOT}/whisper-fact.webp`, alt: '가까이 다가와 차분하게 팩폭을 건네는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.24 }, kind: 'character' },
  'love-self-mirror': { key: 'love-self-mirror', src: `${GENERATED_ROOT}/love-self-mirror.webp`, alt: '붉은 실이 비치는 원형 거울로 연애 패턴을 살피는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.52, y: 0.34 }, kind: 'symbolic' },
  'attraction-danger': { key: 'attraction-danger', src: `${GENERATED_ROOT}/attraction-danger.webp`, alt: '위험하게 꼬인 붉은 실을 바라보며 경고하는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.48, y: 0.3 }, kind: 'symbolic' },
  'stable-partner-signal': { key: 'stable-partner-signal', src: `${GENERATED_ROOT}/stable-partner-signal.webp`, alt: '차분하게 정돈된 붉은 실로 안정적인 관계 신호를 보여주는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.32 }, kind: 'symbolic' },
  'final-fact-bomb': { key: 'final-fact-bomb', src: `${GENERATED_ROOT}/final-fact-bomb.webp`, alt: '카메라를 향해 마지막 조언을 건네는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.26 }, kind: 'character' },
  'attraction-vs-longevity': { key: 'attraction-vs-longevity', src: `${GENERATED_ROOT}/attraction-vs-longevity.webp`, alt: '강렬한 설렘과 차분한 안정의 붉은 실을 비교하는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.36 }, kind: 'symbolic' },
  'future-partner-fan': { key: 'future-partner-fan', src: `${GENERATED_ROOT}/future-partner-fan.webp`, alt: '펼친 부채 속 상징적인 다음 인연의 실루엣을 보여주는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.38 }, kind: 'symbolic' },
  'first-meeting-scene': { key: 'first-meeting-scene', src: `${GENERATED_ROOT}/first-meeting-scene.webp`, alt: '도시의 일상 공간에서 새로운 대화가 시작되는 상징적인 장면', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.42 }, kind: 'symbolic' },
  'waiting-for-message': { key: 'waiting-for-message', src: `${GENERATED_ROOT}/waiting-for-message.webp`, alt: '휴대전화 알림과 꼬인 붉은 실로 연락 패턴을 살피는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.34 }, kind: 'symbolic' },
  'room-corridor': { key: 'room-corridor', src: `${GENERATED_ROOT}/room-corridor.webp`, alt: '붉은 실이 깊숙한 상담실로 이어지는 어두운 무당집 복도', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.48 }, kind: 'space' },
  'room-consultation': { key: 'room-consultation', src: `${GENERATED_ROOT}/room-consultation.webp`, alt: '부채와 촛불과 원형 거울이 놓인 고급스러운 MZ무당 상담실', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.52 }, kind: 'space' },
  'red-thread-knot': { key: 'red-thread-knot', src: `${GENERATED_ROOT}/red-thread-knot.webp`, alt: '복잡하게 얽힌 붉은 실의 매듭으로 반복되는 끌림을 보여주는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.38 }, kind: 'symbolic' },
  'green-flag-lantern': { key: 'green-flag-lantern', src: `${GENERATED_ROOT}/green-flag-lantern.webp`, alt: '안전한 관계의 행동 기준을 상징하는 따뜻한 등불을 밝히는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.46, y: 0.34 }, kind: 'symbolic' },
  'red-flag-warning': { key: 'red-flag-warning', src: `${GENERATED_ROOT}/red-flag-warning.webp`, alt: '날카롭게 갈라진 붉은 실 사이에서 관계의 위험 신호를 경고하는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.32 }, kind: 'symbolic' },
  'timing-rising-moon': { key: 'timing-rising-moon', src: `${GENERATED_ROOT}/timing-rising-moon.webp`, alt: '열두 달의 연애 흐름을 달과 원형 시간판으로 짚어 주는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.4 }, kind: 'symbolic' },
  'timing-pause-moon': { key: 'timing-pause-moon', src: `${GENERATED_ROOT}/timing-pause-moon.webp`, alt: '어두운 달의 흐름 앞에서 관계의 속도를 잠시 늦추라고 권하는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.38 }, kind: 'symbolic' },
  'closure-thread-cut': { key: 'closure-thread-cut', src: `${GENERATED_ROOT}/closure-thread-cut.webp`, alt: '느슨해진 붉은 인연의 실을 놓아 보내며 관계의 마침표를 짚는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.36 }, kind: 'symbolic' },
  'boundary-circle': { key: 'boundary-circle', src: `${GENERATED_ROOT}/boundary-circle.webp`, alt: '빛나는 원형 경계 안에 서서 연애에서 지켜야 할 선을 보여주는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.4 }, kind: 'symbolic' },
  'action-plan-calendar': { key: 'action-plan-calendar', src: `${GENERATED_ROOT}/action-plan-calendar.webp`, alt: '달력과 차분히 정돈된 붉은 매듭으로 연애 행동 계획을 세우는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.42 }, kind: 'symbolic' },
  'message-do-dont': { key: 'message-do-dont', src: `${GENERATED_ROOT}/message-do-dont.webp`, alt: '두 갈래로 나뉜 휴대전화 불빛을 보며 연락의 선택지를 짚어 주는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.34 }, kind: 'symbolic' },
  'attraction-spark': { key: 'attraction-spark', src: `${GENERATED_ROOT}/attraction-spark.webp`, alt: '맞닿은 붉은 실 사이로 번지는 불꽃에서 강렬한 첫 끌림을 읽는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.35 }, kind: 'symbolic' },
  'longevity-lantern': { key: 'longevity-lantern', src: `${GENERATED_ROOT}/longevity-lantern.webp`, alt: '꾸준히 빛나는 등불과 곧게 이어진 붉은 실로 오래가는 관계를 비추는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.48, y: 0.38 }, kind: 'symbolic' },
  'self-worth-crown': { key: 'self-worth-crown', src: `${GENERATED_ROOT}/self-worth-crown.webp`, alt: '빛나는 관 장식과 거울 앞에서 연애에 흔들리지 않는 자기 가치를 되찾는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.3 }, kind: 'symbolic' },
  'friend-introduction-door': { key: 'friend-introduction-door', src: `${GENERATED_ROOT}/friend-introduction-door.webp`, alt: '친구의 소개를 상징하는 열린 문 너머의 새 인연을 바라보는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.42 }, kind: 'symbolic' },
  'work-connection-table': { key: 'work-connection-table', src: `${GENERATED_ROOT}/work-connection-table.webp`, alt: '작업 테이블 사이를 잇는 붉은 실에서 일과 연결된 인연의 접점을 찾는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.44 }, kind: 'symbolic' },
  'hobby-meeting-studio': { key: 'hobby-meeting-studio', src: `${GENERATED_ROOT}/hobby-meeting-studio.webp`, alt: '취미 공방에서 자연스럽게 대화가 시작되는 새 만남의 순간을 지켜보는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.43 }, kind: 'symbolic' },
  'moonlit-date': { key: 'moonlit-date', src: `${GENERATED_ROOT}/moonlit-date.webp`, alt: '달빛 아래 나란히 걷는 두 사람의 실루엣과 이어진 붉은 실을 바라보는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.4 }, kind: 'symbolic' },
  'reunion-shadow': { key: 'reunion-shadow', src: `${GENERATED_ROOT}/reunion-shadow.webp`, alt: '다시 마주한 두 그림자와 조심스럽게 이어진 붉은 실로 재회 가능성을 살피는 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.4 }, kind: 'symbolic' },
  'report-seal-final': { key: 'report-seal-final', src: `${GENERATED_ROOT}/report-seal-final.webp`, alt: '연애 리포트의 완성을 상징하는 붉은 봉인을 손에 든 MZ무당', width: 1080, height: 1920, focalPoint: { x: 0.5, y: 0.34 }, kind: 'character' },
} as const satisfies Record<MzLoveSceneKey, SceneArtwork>;

export { MZ_LOVE_SCENE_KEYS };
export function getMzLoveScene(key: MzLoveSceneKey): SceneArtwork { return MZ_LOVE_SCENE_MANIFEST[key]; }
export function isMzLoveSceneKey(value: string): value is MzLoveSceneKey { return (MZ_LOVE_SCENE_KEYS as readonly string[]).includes(value); }
