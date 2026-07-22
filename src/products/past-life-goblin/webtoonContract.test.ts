import { describe, expect, it } from 'vitest';
import {
  PAST_LIFE_REPORT_VOLUMES,
  PAST_LIFE_REPORT_TOPIC_COUNT
} from './contract';
import {
  PAST_LIFE_WEBTOON_CROP_POSITIONS,
  PAST_LIFE_WEBTOON_VOLUMES,
  getPastLifeFocusVolumeId,
  getPastLifeWebtoonVolume
} from './webtoonContract';

describe('past-life webtoon presentation contract', () => {
  it('keeps the five canonical volumes and assigns three panels to each', () => {
    expect(PAST_LIFE_WEBTOON_VOLUMES.map((volume) => volume.id)).toEqual(
      PAST_LIFE_REPORT_VOLUMES.map((volume) => volume.id)
    );
    expect(PAST_LIFE_WEBTOON_VOLUMES).toHaveLength(5);

    PAST_LIFE_WEBTOON_VOLUMES.forEach((volume) => {
      expect(volume.panels).toHaveLength(3);
      expect(volume.panels.map((panel) => panel.order)).toEqual([1, 2, 3]);
      expect(volume.panels.map((panel) => panel.cropPosition)).toEqual(
        PAST_LIFE_WEBTOON_CROP_POSITIONS
      );
      expect(volume.panels.every((panel) => panel.symbolic)).toBe(true);
    });
  });

  it('covers topics 1 through 26 exactly once and never crosses a volume boundary', () => {
    const assignedTopics = PAST_LIFE_WEBTOON_VOLUMES.flatMap((volume) =>
      volume.panels.flatMap((panel) => panel.topicNumbers)
    );

    expect(assignedTopics).toHaveLength(PAST_LIFE_REPORT_TOPIC_COUNT);
    expect(assignedTopics).toEqual(
      Array.from({ length: PAST_LIFE_REPORT_TOPIC_COUNT }, (_, index) => index + 1)
    );
    expect(new Set(assignedTopics).size).toBe(PAST_LIFE_REPORT_TOPIC_COUNT);

    PAST_LIFE_WEBTOON_VOLUMES.forEach((webtoonVolume) => {
      const canonical = PAST_LIFE_REPORT_VOLUMES.find(
        (volume) => volume.id === webtoonVolume.id
      );
      const canonicalTopics = new Set(canonical?.topics.map((topic) => topic.number));

      webtoonVolume.panels.forEach((panel) => {
        panel.topicNumbers.forEach((topicNumber) => {
          expect(canonicalTopics.has(topicNumber)).toBe(true);
        });
      });
    });
  });

  it('uses fifteen stable, unique scene keys', () => {
    const sceneKeys = PAST_LIFE_WEBTOON_VOLUMES.flatMap((volume) =>
      volume.panels.map((panel) => panel.sceneKey)
    );

    expect(sceneKeys).toHaveLength(15);
    expect(new Set(sceneKeys).size).toBe(15);
    expect(getPastLifeWebtoonVolume('release')?.panels[2].sceneKey).toBe(
      'volume-05-panel-03'
    );
  });

  it('routes every intake focus to one highlighted volume', () => {
    expect(getPastLifeFocusVolumeId('자기이해')).toBe('seal');
    expect(getPastLifeFocusVolumeId('연애')).toBe('relationship');
    expect(getPastLifeFocusVolumeId('인간관계')).toBe('relationship');
    expect(getPastLifeFocusVolumeId('재회 후유증')).toBe('karma');
    expect(getPastLifeFocusVolumeId('직업')).toBe('present');
    expect(getPastLifeFocusVolumeId('알 수 없는 관심사')).toBe('present');
  });
});
