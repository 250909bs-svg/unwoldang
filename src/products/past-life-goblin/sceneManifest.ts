import type {
  PastLifeWebtoonCropPosition,
  PastLifeWebtoonSceneKey
} from './webtoonContract';

export type PastLifeWebtoonSceneArtwork = {
  key: PastLifeWebtoonSceneKey;
  src: string;
  avifSrc: string;
  width: number;
  height: number;
  renderWidth: 1024;
  renderHeight: 512;
  focalPoint: { x: 0.5; y: 0.5 };
  cropPosition: PastLifeWebtoonCropPosition;
  kind: 'symbolic';
  alt: string;
};

const artwork = (
  key: PastLifeWebtoonSceneKey,
  width: number,
  height: number,
  cropPosition: PastLifeWebtoonCropPosition,
  alt: string
): PastLifeWebtoonSceneArtwork => ({
  key,
  src: `/media/past-life-goblin/webtoon/${key}.webp`,
  avifSrc: `/media/past-life-goblin/webtoon/${key}.avif`,
  width,
  height,
  renderWidth: 1024,
  renderHeight: 512,
  focalPoint: { x: 0.5, y: 0.5 },
  cropPosition,
  kind: 'symbolic',
  alt
});

/**
 * Fifteen independently optimized crops from the five volume triptychs. Text
 * and customer data are deliberately absent from the bitmap; narration and
 * dialogue remain accessible HTML in the report renderer.
 */
export const PAST_LIFE_WEBTOON_SCENE_MANIFEST = {
  'volume-01-panel-01': artwork(
    'volume-01-panel-01',
    1024,
    571,
    'top',
    '달빛이 비치는 기록관에서 익명의 상징 인물이 오래된 장부를 조심스럽게 여는 장면'
  ),
  'volume-01-panel-02': artwork(
    'volume-01-panel-02',
    1024,
    439,
    'center',
    '먹 묻은 손과 황동 봉인, 청염이 비치는 장부지기를 가까이 담은 상징 장면'
  ),
  'volume-01-panel-03': artwork(
    'volume-01-panel-03',
    1024,
    506,
    'bottom',
    '희미한 갈림길 앞에서 검은 장부를 든 익명의 상징 인물이 선택을 앞둔 장면'
  ),
  'volume-02-panel-01': artwork(
    'volume-02-panel-01',
    1024,
    570,
    'top',
    '달빛 아래 다리 위에서 붉은 실을 든 두 익명의 상징 인물이 마주 보는 장면'
  ),
  'volume-02-panel-02': artwork(
    'volume-02-panel-02',
    1024,
    438,
    'center',
    '비 내리는 밤 두 사람의 손이 황동 약속패를 함께 쥔 모습을 담은 상징 장면'
  ),
  'volume-02-panel-03': artwork(
    'volume-02-panel-03',
    1024,
    509,
    'bottom',
    '비 내리는 지붕 위에서 두 익명의 인물이 반대 방향으로 걷고 청염만 남은 상징 장면'
  ),
  'volume-03-panel-01': artwork(
    'volume-03-panel-01',
    1024,
    507,
    'top',
    '무거운 장부 짐을 등에 진 익명의 상징 인물이 어두운 산길을 오르는 장면'
  ),
  'volume-03-panel-02': artwork(
    'volume-03-panel-02',
    1024,
    504,
    'center',
    '입을 가린 익명의 인물 곁에 전달하지 못한 편지와 갈라진 약속패가 놓인 상징 장면'
  ),
  'volume-03-panel-03': artwork(
    'volume-03-panel-03',
    1024,
    509,
    'bottom',
    '같은 모양의 나무문이 끝없이 이어져 반복되는 선택을 비추는 상징 복도 장면'
  ),
  'volume-04-panel-01': artwork(
    'volume-04-panel-01',
    1024,
    508,
    'top',
    '과거의 장부 짐과 현대의 가방과 알림 화면이 한 인물 위에 겹쳐 보이는 상징 장면'
  ),
  'volume-04-panel-02': artwork(
    'volume-04-panel-02',
    1024,
    502,
    'center',
    '현대 책상에서 여러 요청과 알림에 둘러싸인 익명의 인물이 숨을 고르는 상징 장면'
  ),
  'volume-04-panel-03': artwork(
    'volume-04-panel-03',
    1024,
    509,
    'bottom',
    '새벽 책상에서 익명의 인물이 한 과업만 남기고 경계선을 긋는 상징 장면'
  ),
  'volume-05-panel-01': artwork(
    'volume-05-panel-01',
    1024,
    508,
    'top',
    '갈라진 황동 약속패에 묶인 붉은 실 매듭을 두 손으로 천천히 푸는 상징 장면'
  ),
  'volume-05-panel-02': artwork(
    'volume-05-panel-02',
    1024,
    504,
    'center',
    '무거운 장부 짐을 내려놓은 익명의 인물이 새벽빛 문을 여는 상징 장면'
  ),
  'volume-05-panel-03': artwork(
    'volume-05-panel-03',
    1024,
    509,
    'bottom',
    '빈 기록 카드와 열린 검은 장부 위에 느슨해진 붉은 실이 놓인 마지막 상징 장면'
  )
} as const satisfies Record<PastLifeWebtoonSceneKey, PastLifeWebtoonSceneArtwork>;

export function getPastLifeWebtoonScene(key: PastLifeWebtoonSceneKey) {
  return PAST_LIFE_WEBTOON_SCENE_MANIFEST[key];
}
