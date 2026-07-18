import { describe, expect, it } from 'vitest';
import { MZ_LOVE_FIXTURES_BY_KEY, MZ_LOVE_RELATIONSHIP_FIXTURES } from './fixtures';
import { MZ_LOVE_CHAPTER_IDS } from './types';
import { buildMzLoveViewModel } from './viewModel';

describe('MZ love relationship fixtures', () => {
  it('ships six complete relationship scenarios with thirteen ordered chapters', () => {
    expect(MZ_LOVE_RELATIONSHIP_FIXTURES).toHaveLength(6);
    MZ_LOVE_RELATIONSHIP_FIXTURES.forEach((fixture) => {
      expect(fixture.report.chapters).toHaveLength(13);
      expect(fixture.report.chapters.map((chapter) => chapter.id)).toEqual([...MZ_LOVE_CHAPTER_IDS]);
      expect(fixture.report.chapters.every((chapter) => chapter.result.evidence.length > 0)).toBe(true);
      expect(fixture.report.chapters.every((chapter) => chapter.result.action.length > 0)).toBe(true);
      expect(new Set(fixture.report.chapters.map((chapter) => chapter.result.factBomb)).size).toBeGreaterThan(10);
      expect(new Set(fixture.report.chapters.map((chapter) => chapter.result.interpretation)).size).toBeGreaterThan(10);
      expect(new Set(fixture.report.chapters.map((chapter) => chapter.result.evidence.map((item) => item.id).join('|'))).size).toBeGreaterThan(1);
    });
  });

  it('renders only the branch matching each relationship status', () => {
    expect(MZ_LOVE_FIXTURES_BY_KEY.situationship.report.relationshipStatusBranch.factBomb).toContain('신중한 사람');
    expect(MZ_LOVE_FIXTURES_BY_KEY.ambiguous.report.relationshipStatusBranch.factBomb).toContain('기다릴 가치');
    expect(MZ_LOVE_FIXTURES_BY_KEY.breakup.report.relationshipStatusBranch.factBomb).toContain('헤어진 원인');
  });

  it('marks unknown birth time and publishes the precision limitation', () => {
    const fixture = MZ_LOVE_FIXTURES_BY_KEY['unknown-birth-time'].report;
    expect(fixture.sajuSummary.birthTimeKnown).toBe(false);
    expect(fixture.sajuSummary.pillars.hour).toBeNull();
    expect(fixture.disclaimers.join(' ')).toContain('출생시간 미입력');
  });

  it('builds a scene-resolved UI model without duplicate visuals', () => {
    const model = buildMzLoveViewModel(MZ_LOVE_FIXTURES_BY_KEY.single.report);
    const keys = model.chapters.flatMap((chapter) => chapter.scene ? [chapter.scene.key] : []);
    expect(model.chapters).toHaveLength(13);
    expect(new Set(keys).size).toBe(keys.length);
    expect(model.progress).toEqual({ completed: 13, total: 13 });
  });
});
