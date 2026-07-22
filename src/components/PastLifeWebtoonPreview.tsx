import { Link } from 'react-router-dom';
import {
  PAST_LIFE_NARRATIVE_POLICY,
  PAST_LIFE_PRODUCT,
  PAST_LIFE_REPORT_VOLUMES
} from '../products/past-life-goblin/contract';
import { getPastLifeWebtoonScene } from '../products/past-life-goblin/sceneManifest';
import '../styles/past-life-webtoon.css';

type WebtoonPreviewScene = {
  volumeIndex: number;
  sceneKey: Parameters<typeof getPastLifeWebtoonScene>[0];
  narration: string;
  goblinLine: string;
};

const webtoonPreviewScenes = [
  {
    volumeIndex: 0,
    sceneKey: 'volume-01-panel-01',
    narration: '이름이 지워진 장부에는 얼굴 대신, 늘 먼저 책임을 집어 드는 손이 남아 있었다.',
    goblinLine: '네가 누구였다고 정하지 않을게. 먼저 네가 반복해서 맡는 역할부터 보자.'
  },
  {
    volumeIndex: 1,
    sceneKey: 'volume-02-panel-02',
    narration: '붉은 실은 운명을 묶지 않았다. 약속을 말하지 못한 두 사람의 거리를 비췄다.',
    goblinLine: '끌림보다 오래 남는 건, 서로가 약속을 지키는 방식이야.'
  },
  {
    volumeIndex: 2,
    sceneKey: 'volume-03-panel-02',
    narration: '실은 벌처럼 조이지 않았다. 끝맺지 못한 선택이 같은 매듭으로 돌아왔을 뿐이다.',
    goblinLine: '업은 형벌이 아니야. 다음번에 다르게 답할 수 있는 반복이지.'
  },
  {
    volumeIndex: 3,
    sceneKey: 'volume-04-panel-01',
    narration: '오래된 장면과 오늘의 장면이 포개지자, 익숙한 침묵의 순서가 드러났다.',
    goblinLine: '사람은 달라도 네가 참는 순서는 닮을 수 있어.'
  },
  {
    volumeIndex: 4,
    sceneKey: 'volume-05-panel-02',
    narration: '매듭은 과거를 알아내서가 아니라, 오늘 한 문장을 먼저 말할 때 느슨해졌다.',
    goblinLine: '해원은 기억을 찾는 일이 아니야. 이번 선택을 네가 다시 쓰는 거야.'
  }
] as const satisfies readonly WebtoonPreviewScene[];

const intakeState = { tabOrigin: '/' } as const;

export default function PastLifeWebtoonPreview() {
  return (
    <section className="dokkaebi-webtoon-preview__rail" aria-labelledby="past-life-webtoon-preview-title">
      <header className="dokkaebi-webtoon-preview__intro">
        <span className="dokkaebi-webtoon-preview__eyebrow">다섯 권 · 다섯 상징 장면</span>
        <h2 id="past-life-webtoon-preview-title" className="dokkaebi-webtoon-preview__title">
          장부를 넘기면, 반복하던 선택이 한 장면씩 모습을 드러냅니다
        </h2>
        <p className="dokkaebi-webtoon-preview__lead">
          아래 장면은 사주에 나타난 반복 기질을 이해하기 위한 웹툰형 미리보기입니다.
        </p>
      </header>

      <div className="dokkaebi-webtoon-preview__episodes">
        {webtoonPreviewScenes.map((scene) => {
          const volume = PAST_LIFE_REPORT_VOLUMES[scene.volumeIndex];
          const sceneId = `past-life-webtoon-${volume.id}`;
          const artwork = getPastLifeWebtoonScene(scene.sceneKey);

          return (
            <article
              key={volume.id}
              className="dokkaebi-webtoon-preview__episode"
              aria-labelledby={`${sceneId}-title`}
            >
              <header className="dokkaebi-webtoon-preview__chapter">
                <span className="dokkaebi-webtoon-preview__volume">{volume.volume}</span>
                <h3 id={`${sceneId}-title`} className="dokkaebi-webtoon-preview__chapter-title">
                  {volume.title}
                </h3>
                <p className="dokkaebi-webtoon-preview__chapter-line">{volume.line}</p>
              </header>

              <figure className="dokkaebi-webtoon-preview__panel">
                <picture className="dokkaebi-webtoon-preview__picture">
                  <source srcSet={artwork.avifSrc} type="image/avif" />
                  <source srcSet={artwork.src} type="image/webp" />
                  <img
                    className="dokkaebi-webtoon-preview__image"
                    src={artwork.src}
                    width={artwork.width}
                    height={artwork.height}
                    loading="lazy"
                    decoding="async"
                    alt={artwork.alt}
                    data-scene-key={artwork.key}
                  />
                </picture>
                <figcaption className="dokkaebi-webtoon-preview__caption">
                  <span className="dokkaebi-webtoon-preview__symbolic-label">
                    상징 장면 · 실제 전생 기록 아님
                  </span>
                  <p className="dokkaebi-webtoon-preview__narration">{scene.narration}</p>
                  <blockquote className="dokkaebi-webtoon-preview__dialogue">
                    <span className="dokkaebi-webtoon-preview__speaker">도깨비 장부지기</span>
                    <p className="dokkaebi-webtoon-preview__speech">“{scene.goblinLine}”</p>
                  </blockquote>
                </figcaption>
              </figure>
            </article>
          );
        })}
      </div>

      <footer className="dokkaebi-webtoon-preview__ending">
        <p className="dokkaebi-webtoon-preview__notice" role="note">
          {PAST_LIFE_NARRATIVE_POLICY.notice}
        </p>
        <Link
          to="/form/past-life-goblin"
          state={intakeState}
          className="dokkaebi-webtoon-preview__cta"
        >
          <span className="dokkaebi-webtoon-preview__cta-label">{PAST_LIFE_PRODUCT.primaryAction}</span>
          <strong className="dokkaebi-webtoon-preview__cta-price">{PAST_LIFE_PRODUCT.price}</strong>
        </Link>
      </footer>
    </section>
  );
}
