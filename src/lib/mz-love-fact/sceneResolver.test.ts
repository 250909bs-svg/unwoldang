import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { MZ_LOVE_RELATIONSHIP_FIXTURES } from './fixtures';
import { MZ_LOVE_SCENE_KEYS, MZ_LOVE_SCENE_MANIFEST } from './sceneManifest';
import { hasDuplicateMzLoveScenes, resolveMzLoveChapterScenes, resolveMzLoveScene } from './sceneResolver';

describe('MZ love scene manifest and resolver', () => {
  it('references exactly the thirty generated WebP assets', () => {
    expect(Object.keys(MZ_LOVE_SCENE_MANIFEST)).toEqual([...MZ_LOVE_SCENE_KEYS]);
    expect(MZ_LOVE_SCENE_KEYS).toHaveLength(30);
    expect(new Set(Object.values(MZ_LOVE_SCENE_MANIFEST).map((scene) => scene.src)).size).toBe(30);
    Object.entries(MZ_LOVE_SCENE_MANIFEST).forEach(([key, scene]) => {
      expect(scene.src).toBe(`/images/mz-love-fact/generated/${key}.webp`);
      expect(scene.alt).toMatch(/[가-힣]/u);
      expect(scene.alt).not.toMatch(/텍스트|문구|글자|타이포|자막/u);
      expect(scene.width).toBe(1080);
      expect(scene.height).toBe(1920);
    });
  });

  it('has both production WebP and AVIF files for every manifest scene', () => {
    Object.values(MZ_LOVE_SCENE_MANIFEST).forEach((scene) => {
      const webp = resolve(process.cwd(), 'public', scene.src.replace(/^\//, ''));
      const avif = webp.replace(/\.webp$/u, '.avif');
      expect(existsSync(webp), webp).toBe(true);
      expect(existsSync(avif), avif).toBe(true);
      expect(statSync(webp).size, webp).toBeGreaterThan(0);
      expect(statSync(avif).size, avif).toBeGreaterThan(0);
    });
  });

  it('resolves thirteen chapters without repeating a scene', () => {
    const fixture = MZ_LOVE_RELATIONSHIP_FIXTURES[0];
    const resolved = resolveMzLoveChapterScenes(fixture.report.chapters, fixture.report.user.relationshipStatus);
    const scenes = [...resolved.values()];
    expect(resolved.size).toBe(13);
    expect(scenes.filter(Boolean)).toHaveLength(13);
    expect(scenes.filter((scene) => scene === null)).toHaveLength(0);
    expect(hasDuplicateMzLoveScenes(scenes)).toBe(false);
    expect(resolved.get('repeated-attraction')?.key).toBe('red-thread-knot');
    expect(resolved.get('twelve-month-timing')?.key).toBe('timing-rising-moon');
    expect(resolved.get('relationship-flags')?.key).toBe('red-flag-warning');
    expect(resolved.get('action-plan')?.key).toBe('green-flag-lantern');
  });

  it('honors the previously used set', () => {
    const scene = resolveMzLoveScene({
      chapterId: 'repeated-attraction',
      relationshipStatus: 'situationship',
      riskFlags: ['불확실한 상대에게 끌리는 경향'],
      previouslyUsedScenes: ['attraction-danger'],
    });
    expect(scene?.key).not.toBe('attraction-danger');
  });

  it('uses the expanded scenes when a chapter has a specific semantic signal', () => {
    expect(resolveMzLoveScene({
      chapterId: 'meeting-scenes',
      relationshipStatus: 'single',
      timingSignals: ['친구 소개로 자연스럽게 연결되는 시기'],
    })?.key).toBe('friend-introduction-door');
    expect(resolveMzLoveScene({
      chapterId: 'relationship-status',
      relationshipStatus: 'breakup-reunion',
      riskFlags: ['전 연인과 재회할 때는 행동의 변화를 확인하세요'],
    })?.key).toBe('reunion-shadow');
    expect(resolveMzLoveScene({
      chapterId: 'action-plan',
      relationshipStatus: 'dating',
      derivedFacts: [{
        id: 'action-plan-test',
        kind: 'boundary',
        statement: '30일 행동 계획을 주차별로 실천하세요',
        evidence: [],
        confidence: 0.8,
      }],
    })?.key).toBe('action-plan-calendar');
  });
});
