import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import PastLifeWebtoonPreview from './PastLifeWebtoonPreview';
import { getPastLifeWebtoonScene } from '../products/past-life-goblin/sceneManifest';

const previewSceneKeys = [
  'volume-01-panel-01',
  'volume-02-panel-02',
  'volume-03-panel-02',
  'volume-04-panel-01',
  'volume-05-panel-02'
] as const;

function renderPreview() {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(PastLifeWebtoonPreview)
    )
  );
}

describe('PastLifeWebtoonPreview', () => {
  it('renders one manifest-backed AVIF/WebP picture for each of the five ledgers', () => {
    const markup = renderPreview();
    const imageTags = Array.from(markup.matchAll(/<img[^>]*>/g), (match) => match[0]);

    expect(markup.match(/<picture/g)).toHaveLength(5);
    expect(markup.match(/type="image\/avif"/g)).toHaveLength(5);
    expect(markup.match(/type="image\/webp"/g)).toHaveLength(5);
    expect(imageTags).toHaveLength(5);

    previewSceneKeys.forEach((sceneKey, index) => {
      const artwork = getPastLifeWebtoonScene(sceneKey);
      const imageTag = imageTags[index];

      expect(markup).toContain(artwork.avifSrc);
      expect(markup).toContain(artwork.src);
      expect(imageTag).toContain(`data-scene-key="${artwork.key}"`);
      expect(imageTag).toContain(`src="${artwork.src}"`);
      expect(imageTag).toContain(`width="${artwork.width}"`);
      expect(imageTag).toContain(`height="${artwork.height}"`);
      expect(imageTag).toContain(`alt="${artwork.alt}"`);
    });
  });

  it('keeps every preview image deferred and asynchronously decoded', () => {
    const markup = renderPreview();

    expect(markup.match(/loading="lazy"/g)).toHaveLength(5);
    expect(markup.match(/decoding="async"/g)).toHaveLength(5);
    expect(markup.match(/<img[^>]*alt="[^"]+"/g)).toHaveLength(5);
  });

  it('labels every panel as symbolic and states that the story is not a past-life fact', () => {
    const markup = renderPreview();

    expect(markup.match(/상징 장면 · 실제 전생 기록 아님/g)).toHaveLength(5);
    expect(markup).toContain('과거 생애나 초자연적 사실을 증명하지 않습니다.');
    expect(
      markup.match(/dokkaebi-webtoon-preview__speaker\">도깨비 장부지기/g)
    ).toHaveLength(5);
  });

  it('ends at the unchanged past-life intake route and product price', () => {
    const markup = renderPreview();

    expect(markup).toContain('href="/form/past-life-goblin"');
    expect(markup).toContain('내 전생 장부 열기');
    expect(markup).toContain('49,000원');
  });

  it('uses only product-scoped class names', () => {
    const markup = renderPreview();
    const classNames = Array.from(markup.matchAll(/class="([^"]+)"/g)).flatMap((match) =>
      match[1].split(/\s+/)
    );

    expect(classNames.length).toBeGreaterThan(0);
    expect(classNames.every((className) => className.startsWith('dokkaebi-webtoon-preview__'))).toBe(true);
  });
});
