import {
  PAST_LIFE_REPORT_VOLUMES,
  type PastLifeVolumeId
} from './contract';

export const PAST_LIFE_WEBTOON_CROP_POSITIONS = ['top', 'center', 'bottom'] as const;

export type PastLifeWebtoonCropPosition =
  (typeof PAST_LIFE_WEBTOON_CROP_POSITIONS)[number];

export type PastLifeWebtoonSceneKey =
  | 'volume-01-panel-01'
  | 'volume-01-panel-02'
  | 'volume-01-panel-03'
  | 'volume-02-panel-01'
  | 'volume-02-panel-02'
  | 'volume-02-panel-03'
  | 'volume-03-panel-01'
  | 'volume-03-panel-02'
  | 'volume-03-panel-03'
  | 'volume-04-panel-01'
  | 'volume-04-panel-02'
  | 'volume-04-panel-03'
  | 'volume-05-panel-01'
  | 'volume-05-panel-02'
  | 'volume-05-panel-03';

export type PastLifeWebtoonPanelContract = {
  id: `${PastLifeVolumeId}-${PastLifeWebtoonCropPosition}`;
  order: 1 | 2 | 3;
  sceneKey: PastLifeWebtoonSceneKey;
  cropPosition: PastLifeWebtoonCropPosition;
  topicNumbers: readonly number[];
  symbolic: true;
};

export type PastLifeWebtoonVolumeContract = {
  id: PastLifeVolumeId;
  order: 1 | 2 | 3 | 4 | 5;
  panels: readonly PastLifeWebtoonPanelContract[];
};

const panel = (
  volumeId: PastLifeVolumeId,
  order: 1 | 2 | 3,
  sceneKey: PastLifeWebtoonSceneKey,
  cropPosition: PastLifeWebtoonCropPosition,
  topicNumbers: readonly number[]
): PastLifeWebtoonPanelContract => ({
  id: `${volumeId}-${cropPosition}`,
  order,
  sceneKey,
  cropPosition,
  topicNumbers,
  symbolic: true
});

/**
 * Presentation-only grouping for the five-volume report contract. Every
 * canonical topic is assigned to exactly one of the three panels in its own
 * volume; the stored report sections and their prose remain untouched.
 */
export const PAST_LIFE_WEBTOON_VOLUMES = [
  {
    id: 'seal',
    order: 1,
    panels: [
      panel('seal', 1, 'volume-01-panel-01', 'top', [1, 2]),
      panel('seal', 2, 'volume-01-panel-02', 'center', [3, 4]),
      panel('seal', 3, 'volume-01-panel-03', 'bottom', [5])
    ]
  },
  {
    id: 'relationship',
    order: 2,
    panels: [
      panel('relationship', 1, 'volume-02-panel-01', 'top', [6]),
      panel('relationship', 2, 'volume-02-panel-02', 'center', [7]),
      panel('relationship', 3, 'volume-02-panel-03', 'bottom', [8, 9])
    ]
  },
  {
    id: 'karma',
    order: 3,
    panels: [
      panel('karma', 1, 'volume-03-panel-01', 'top', [10, 11]),
      panel('karma', 2, 'volume-03-panel-02', 'center', [12, 13]),
      panel('karma', 3, 'volume-03-panel-03', 'bottom', [14, 15])
    ]
  },
  {
    id: 'present',
    order: 4,
    panels: [
      panel('present', 1, 'volume-04-panel-01', 'top', [16]),
      panel('present', 2, 'volume-04-panel-02', 'center', [17, 18]),
      panel('present', 3, 'volume-04-panel-03', 'bottom', [19, 20])
    ]
  },
  {
    id: 'release',
    order: 5,
    panels: [
      panel('release', 1, 'volume-05-panel-01', 'top', [21, 22]),
      panel('release', 2, 'volume-05-panel-02', 'center', [23, 24]),
      panel('release', 3, 'volume-05-panel-03', 'bottom', [25, 26])
    ]
  }
] as const satisfies readonly PastLifeWebtoonVolumeContract[];

const PAST_LIFE_FOCUS_VOLUME_BY_TOPIC: Readonly<Record<string, PastLifeVolumeId>> = {
  연애: 'relationship',
  '재회 후유증': 'karma',
  직업: 'present',
  돈: 'present',
  가족: 'present',
  인간관계: 'relationship',
  자기이해: 'seal'
};

export function getPastLifeFocusVolumeId(focus: string): PastLifeVolumeId {
  return PAST_LIFE_FOCUS_VOLUME_BY_TOPIC[focus.trim()] ?? 'present';
}

export function getPastLifeWebtoonVolume(volumeId: PastLifeVolumeId) {
  return PAST_LIFE_WEBTOON_VOLUMES.find((volume) => volume.id === volumeId);
}

export function getPastLifeCanonicalVolume(volumeId: PastLifeVolumeId) {
  return PAST_LIFE_REPORT_VOLUMES.find((volume) => volume.id === volumeId);
}
