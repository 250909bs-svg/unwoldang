import { describe, expect, it } from 'vitest';
import { reunionImages } from '../../features/reunion/assets';
import { reunionPanelImages, type ReunionPanelKey } from '../../features/reunion/reunionPanelAssets';
import {
  REUNION_BEAT_HEIGHTS,
  REUNION_CHAPTER_IDS,
  REUNION_SCENE_KEYS,
  type ReunionSceneKey
} from './reportTypes';

describe('reunion report type contract', () => {
  /**
   * `src/lib` 이 `src/features` 를 import 하지 않도록 장면 키를 두 곳에 선언했다.
   * 두 목록이 갈라지면 렌더러가 존재하지 않는 파일을 요청하므로 여기서 잠근다.
   */
  it('declares exactly the panel keys that reunionPanelAssets ships', () => {
    expect([...REUNION_SCENE_KEYS].sort()).toEqual(Object.keys(reunionPanelImages).sort());
  });

  it('keeps the two key sets assignable to each other at compile time', () => {
    const fromPanel: ReunionSceneKey = 'hero' satisfies ReunionPanelKey;
    const fromScene: ReunionPanelKey = 'moveOnClose' satisfies ReunionSceneKey;
    expect([fromPanel, fromScene]).toEqual(['hero', 'moveOnClose']);
  });

  /** `assets.ts` 는 계약 테스트가 키 목록을 정확 비교하므로 이 작업에서 건드리지 않았다. */
  it('leaves the editorial asset map untouched', () => {
    expect(Object.keys(reunionImages)).toEqual(['hero', 'reflection', 'contact', 'reunion', 'moveOn']);
  });

  it('names the eight chapters once each', () => {
    expect(REUNION_CHAPTER_IDS).toHaveLength(8);
    expect(new Set(REUNION_CHAPTER_IDS).size).toBe(8);
  });

  it('fixes the three beat heights', () => {
    expect(REUNION_BEAT_HEIGHTS).toEqual({ 'beat-sm': 120, 'beat-md': 240, 'beat-lg': 360 });
  });
});
