import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PAST_LIFE_WEBTOON_SCENE_MANIFEST,
  getPastLifeWebtoonScene
} from './sceneManifest';
import { PAST_LIFE_WEBTOON_VOLUMES } from './webtoonContract';

const publicRoot = fileURLToPath(new URL('../../../public/', import.meta.url));

const EXPECTED_DIMENSIONS = [
  [1024, 571], [1024, 439], [1024, 506],
  [1024, 570], [1024, 438], [1024, 509],
  [1024, 507], [1024, 504], [1024, 509],
  [1024, 508], [1024, 502], [1024, 509],
  [1024, 508], [1024, 504], [1024, 509]
] as const;

const EXPECTED_ALTS = [
  '달빛이 비치는 기록관에서 익명의 상징 인물이 오래된 장부를 조심스럽게 여는 장면',
  '먹 묻은 손과 황동 봉인, 청염이 비치는 장부지기를 가까이 담은 상징 장면',
  '희미한 갈림길 앞에서 검은 장부를 든 익명의 상징 인물이 선택을 앞둔 장면',
  '달빛 아래 다리 위에서 붉은 실을 든 두 익명의 상징 인물이 마주 보는 장면',
  '비 내리는 밤 두 사람의 손이 황동 약속패를 함께 쥔 모습을 담은 상징 장면',
  '비 내리는 지붕 위에서 두 익명의 인물이 반대 방향으로 걷고 청염만 남은 상징 장면',
  '무거운 장부 짐을 등에 진 익명의 상징 인물이 어두운 산길을 오르는 장면',
  '입을 가린 익명의 인물 곁에 전달하지 못한 편지와 갈라진 약속패가 놓인 상징 장면',
  '같은 모양의 나무문이 끝없이 이어져 반복되는 선택을 비추는 상징 복도 장면',
  '과거의 장부 짐과 현대의 가방과 알림 화면이 한 인물 위에 겹쳐 보이는 상징 장면',
  '현대 책상에서 여러 요청과 알림에 둘러싸인 익명의 인물이 숨을 고르는 상징 장면',
  '새벽 책상에서 익명의 인물이 한 과업만 남기고 경계선을 긋는 상징 장면',
  '갈라진 황동 약속패에 묶인 붉은 실 매듭을 두 손으로 천천히 푸는 상징 장면',
  '무거운 장부 짐을 내려놓은 익명의 인물이 새벽빛 문을 여는 상징 장면',
  '빈 기록 카드와 열린 검은 장부 위에 느슨해진 붉은 실이 놓인 마지막 상징 장면'
] as const;

describe('past-life webtoon scene manifest', () => {
  it('defines one independently optimized artwork pair for all fifteen panels', () => {
    const scenes = Object.values(PAST_LIFE_WEBTOON_SCENE_MANIFEST);

    expect(scenes).toHaveLength(15);
    expect(new Set(scenes.map((scene) => scene.src)).size).toBe(15);
    expect(new Set(scenes.map((scene) => scene.avifSrc)).size).toBe(15);

    scenes.forEach((scene, index) => {
      expect([scene.width, scene.height]).toEqual(EXPECTED_DIMENSIONS[index]);
      expect(scene.alt).toBe(EXPECTED_ALTS[index]);
      expect([scene.renderWidth, scene.renderHeight]).toEqual([1024, 512]);
      expect(scene.focalPoint).toEqual({ x: 0.5, y: 0.5 });
      expect(scene.kind).toBe('symbolic');
      expect(scene.alt.length).toBeGreaterThan(25);
      expect(scene.alt).toMatch(/상징|장면/u);
    });
  });

  it('has a non-empty local AVIF and WebP file for every declared source', () => {
    Object.values(PAST_LIFE_WEBTOON_SCENE_MANIFEST).forEach((scene) => {
      [scene.src, scene.avifSrc].forEach((source) => {
        const path = join(publicRoot, source.replace(/^\//u, ''));
        expect(existsSync(path), `${source} should exist`).toBe(true);
        expect(statSync(path).size, `${source} should not be empty`).toBeGreaterThan(0);
      });
    });
  });

  it('matches every contract key and preserves its narrative crop slot', () => {
    PAST_LIFE_WEBTOON_VOLUMES.forEach((volume) => {
      volume.panels.forEach((panel) => {
        const scene = getPastLifeWebtoonScene(panel.sceneKey);
        expect(scene.key).toBe(panel.sceneKey);
        expect(scene.cropPosition).toBe(panel.cropPosition);
      });
    });
  });
});
