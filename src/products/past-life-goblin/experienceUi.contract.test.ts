import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAST_LIFE_REPORT_VOLUMES } from './contract';
import { PAST_LIFE_WEBTOON_SCENE_MANIFEST } from './sceneManifest';
import { PAST_LIFE_WEBTOON_VOLUMES } from './webtoonContract';

const landingSource = readFileSync(new URL('../../pages/PastLifeLanding.tsx', import.meta.url), 'utf8');
const storyReportSource = readFileSync(
  new URL('../../components/PastLifeStoryReport.tsx', import.meta.url),
  'utf8'
);
const webtoonPreviewSource = readFileSync(
  new URL('../../components/PastLifeWebtoonPreview.tsx', import.meta.url),
  'utf8'
);
const experienceContentSource = readFileSync(
  new URL('../../content/pastLifeExperience.ts', import.meta.url),
  'utf8'
);
const heroFilmSource = readFileSync(new URL('../../components/HeroFilm.tsx', import.meta.url), 'utf8');
const immersionSource = readFileSync(new URL('../../pages/PastLifeImmersion.tsx', import.meta.url), 'utf8');
const pastLifeCss = readFileSync(new URL('../../styles/past-life.css', import.meta.url), 'utf8');

function imageTags(source: string) {
  return source.match(/<img\b[\s\S]*?\/>/gu) ?? [];
}

describe('past-life-goblin media and style regression contract', () => {
  it('lazy-loads every non-critical report image and every landing ledger image', () => {
    const reportImages = imageTags(storyReportSource);
    const landingImages = [...imageTags(landingSource), ...imageTags(webtoonPreviewSource)];
    const eagerReportImages = reportImages.filter((tag) => tag.includes('loading="eager"'));
    const lazyReportImages = reportImages.filter((tag) => tag.includes('loading="lazy"'));

    expect(reportImages.length).toBeGreaterThan(2);
    expect(eagerReportImages).toHaveLength(1);
    expect(lazyReportImages).toHaveLength(reportImages.length - 1);
    expect(landingImages.length).toBeGreaterThan(0);
    landingImages.forEach((tag) => expect(tag).toContain('loading="lazy"'));
    expect(Object.values(PAST_LIFE_WEBTOON_SCENE_MANIFEST)).toHaveLength(15);
    Object.values(PAST_LIFE_WEBTOON_SCENE_MANIFEST).forEach((scene) => {
      expect(scene.src).toMatch(/\.webp$/u);
      expect(scene.avifSrc).toMatch(/\.avif$/u);
    });
  });

  it('connects pause controls and lifecycle stops to both video experiences', () => {
    [heroFilmSource, immersionSource].forEach((source) => {
      expect(source).toContain('pausePastLifeVideos');
      expect(source).toContain("document.addEventListener('visibilitychange'");
      expect(source).toContain("window.addEventListener('pagehide'");
    });

    expect(heroFilmSource).toContain('aria-label="대표 영상 제어"');
    expect(heroFilmSource).toContain("manuallyPausedRef.current = true;");
    expect(immersionSource).toContain('className="dokkaebi-immersion-playback"');
    expect(immersionSource).toContain("aria-label={isPlaying ? '영상 일시정지' : '영상 재생'}");
  });

  it('reduces motion across entry, immersion, landing, intake, and report roots', () => {
    const reducedMotionBlocks =
      pastLifeCss.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/gu) ?? [];
    const experienceBlock = reducedMotionBlocks.find((block) =>
      block.includes('.dokkaebi-entry-page *')
    );

    expect(experienceBlock).toBeDefined();
    [
      '.dokkaebi-entry-page *::before',
      '.dokkaebi-entry-page *::after',
      '.dokkaebi-immersion-page *::before',
      '.dokkaebi-immersion-page *::after',
      '.dokkaebi-landing *',
      '.past-life-goblin-flow-page *',
      '.past-life-report-page *'
    ].forEach((selector) => expect(experienceBlock).toContain(selector));
    expect(experienceBlock).toContain('animation-duration: 0.01ms !important;');
    expect(experienceBlock).toContain('transition-duration: 0.01ms !important;');
  });

  it('scopes every home artwork override to the past-life product URL', () => {
    const homeSelectorLines = pastLifeCss
      .split(/\r?\n/gu)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('.home-'));

    expect(homeSelectorLines.length).toBeGreaterThan(0);
    homeSelectorLines.forEach((selector) => {
      expect(selector).toContain('[href="/detail/past-life-goblin"]');
    });
  });

  it('derives all webtoon episodes and topics from the product-owned volume contract', () => {
    expect(experienceContentSource).toContain(
      "from '../products/past-life-goblin/contract';"
    );
    expect(experienceContentSource).toContain(
      'export { PAST_LIFE_NARRATIVE_POLICY, PAST_LIFE_PRODUCT, PAST_LIFE_REPORT_VOLUMES };'
    );
    expect(storyReportSource).toContain('buildPastLifeWebtoonViewModel');
    expect(storyReportSource).toContain('viewModel.volumes.map((volume, index) =>');
    expect(storyReportSource).not.toContain("['pastlife-seal', 'pastlife-relationship'");

    expect(PAST_LIFE_WEBTOON_VOLUMES.map((volume) => volume.id)).toEqual(
      PAST_LIFE_REPORT_VOLUMES.map((volume) => volume.id)
    );
    expect(PAST_LIFE_WEBTOON_VOLUMES.flatMap((volume) => volume.panels)).toHaveLength(15);
    expect(
      PAST_LIFE_WEBTOON_VOLUMES.flatMap((volume) =>
        volume.panels.flatMap((panel) => panel.topicNumbers)
      )
    ).toEqual(Array.from({ length: 26 }, (_, index) => index + 1));
  });
});
