import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Fingerprint,
  HeartHandshake,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { findServiceById, type LoveReaction } from '../api/mockData';
import seoRouteData from '../content/seoRoutes.json';
import { MZ_LOVE_CHOICE_STORAGE_KEY, normalizeLoveReaction } from '../lib/mz-love-fact/microChoice';
import { getMzLoveScene } from '../lib/mz-love-fact/sceneManifest';
import type { MzLoveSceneKey } from '../lib/mz-love-fact/types';
import '../styles/mz-love-fact.css';

const SERVICE_ID = 'love-reading';
const FORM_PATH = `/form/${SERVICE_ID}`;
const seoLoveFaqs = seoRouteData['/detail/love-reading'].faqs;

type LoveChoiceId = LoveReaction;

type LoveChoice = {
  id: LoveChoiceId;
  label: string;
  response: string;
};

const loveChoices: LoveChoice[] = [
  {
    id: 'A',
    label: '“괜찮아ㅎㅎ”라고 바로 답한다',
    response: '괜찮은 척부터 하는 타입이네. 서운함보다 관계가 깨질까 봐 먼저 분위기를 지키는 편.'
  },
  {
    id: 'B',
    label: '왜 늦었는지 확인한다',
    response: '확신이 없으면 바로 답을 찾으려 하고. 애매함을 오래 견디기보다 관계의 이름부터 확인하는 편.'
  },
  {
    id: 'C',
    label: '나도 일부러 늦게 답한다',
    response: '상대보다 덜 좋아하는 사람처럼 보이려 하지. 마음보다 주도권을 먼저 지키려는 순간이 있어.'
  },
  {
    id: 'D',
    label: '별 의미 없는 척하지만 계속 신경 쓴다',
    response: '겉으론 조용한데 혼자 관계를 백 번 돌려보네. 말하지 않은 가능성까지 대신 해석하는 편.'
  }
];

const recommendationLines = [
  '연락은 오는데 관계는 안 정해지고',
  '좋아질수록 내가 더 불안해지고',
  '끝난 인연을 자꾸 다시 확인하고',
  '항상 다른 사람인데 결말은 비슷하고'
] as const;

const chapterScenes: Array<{
  number: string;
  title: string;
  teaser: string;
  scene: MzLoveSceneKey;
}> = [
  {
    number: '01',
    title: '연애할 때 넌 딴사람 돼',
    teaser: '평소의 판단력과 좋아하는 사람 앞의 선택이 왜 달라지는지 읽어요.',
    scene: 'love-self-mirror'
  },
  {
    number: '02',
    title: '왜 늘 이런 사람에게 꽂힐까',
    teaser: '빠르게 끌리는 신호와 익숙해서 놓지 못하는 패턴을 분리해 봐요.',
    scene: 'attraction-danger'
  },
  {
    number: '03',
    title: '끌리는 타입 vs 오래 갈 타입',
    teaser: '설렘을 만드는 조건과 관계를 지키는 조건은 같지 않을 수 있어요.',
    scene: 'attraction-vs-longevity'
  },
  {
    number: '04',
    title: '오래 갈 사람은 따로 있어',
    teaser: '말보다 약속·연락·만남이 일정한 사람의 신호를 구체적으로 짚어요.',
    scene: 'stable-partner-signal'
  },
  {
    number: '05',
    title: '다음에 들어오는 사람',
    teaser: '얼굴을 단정하지 않고 분위기, 관계 속도, 만남의 조건을 읽어요.',
    scene: 'future-partner-fan'
  },
  {
    number: '06',
    title: '어디서 어떻게 시작될까',
    teaser: '일, 취미, 소개처럼 인연이 실제로 연결되기 쉬운 장면을 살펴봐요.',
    scene: 'first-meeting-scene'
  },
  {
    number: '07',
    title: '지금부터 12개월 연애 흐름',
    teaser: '좋은 달만 고르지 않고 시작·조율·거리두기에 유리한 흐름을 나눠요.',
    scene: 'room-consultation'
  },
  {
    number: '08',
    title: '연락에서 네가 망치는 포인트',
    teaser: '기다림, 확인, 밀어내기 중 반복되는 실수를 행동 단위로 바꿔요.',
    scene: 'waiting-for-message'
  },
  {
    number: '09',
    title: '이번에 바꿔야 할 세 가지',
    teaser: '다음 관계에서 바로 써볼 수 있는 30일 행동 기준으로 마무리해요.',
    scene: 'final-fact-bomb'
  }
];

const trustItems = [
  '생년월일시를 명식으로 먼저 계산',
  '일간·십성·배우자궁·합충·대운·세운 분석',
  '해석마다 확인 가능한 명리 근거 태그 표시',
  '상대의 속마음을 사실처럼 확정하지 않음',
  '미래를 단정하지 않고 조건과 가능성으로 안내',
  '결과 저장 후 보관함에서 다시보기'
] as const;

const faqItems = [
  {
    question: '태어난 시간을 모르면 볼 수 없나요?',
    answer:
      '가능합니다. 출생시간을 모름으로 선택하면 시주를 제외하고 확인 가능한 범위 안에서 해석하며, 시간에 따라 달라질 수 있는 부분은 결과에서 따로 알려드려요.'
  },
  ...seoLoveFaqs,
  {
    question: '결과는 얼마나 걸리나요?',
    answer:
      '정보 입력과 결제를 마치면 명식 계산과 리포트 생성이 순서대로 진행됩니다. 생성 상태는 화면에 표시되며 완료된 결과는 보관함에서 다시 볼 수 있어요.'
  },
  {
    question: '결과 생성에 실패하면 어떻게 하나요?',
    answer:
      '생성 상태를 확인한 뒤 다시 시도할 수 있도록 안내합니다. 결제했는데 결과가 열리지 않는 경우에는 주문 내역과 함께 고객센터로 문의해 주세요.'
  },
  {
    question: '결과를 운명처럼 따라야 하나요?',
    answer:
      '아니요. 명리 해석은 선택을 대신하는 예언이 아니라 패턴을 점검하는 참고 자료예요. 중요한 관계 결정은 실제 행동, 대화, 안전을 함께 살펴 결정해 주세요.'
  }
] as const;

const sampleTimeline = [
  { month: '1–3개월', mood: '정리', copy: '애매한 연락을 선별하고 내 기준을 다시 세우는 흐름' },
  { month: '4–6개월', mood: '접점', copy: '일·취미처럼 반복적으로 만나는 환경에서 접점이 커지는 흐름' },
  { month: '7–9개월', mood: '조율', copy: '빠른 결론보다 연락과 약속의 일관성을 확인해야 하는 흐름' },
  { month: '10–12개월', mood: '선택', copy: '관계를 실제로 만드는 사람에게 에너지를 모으는 흐름' }
] as const;

function readStoredChoice(): LoveChoiceId | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.sessionStorage.getItem(MZ_LOVE_CHOICE_STORAGE_KEY);
    const normalized = normalizeLoveReaction(stored);

    if (normalized && stored !== normalized) {
      window.sessionStorage.setItem(MZ_LOVE_CHOICE_STORAGE_KEY, normalized);
    }

    return normalized;
  } catch {
    return null;
  }
}

function storeChoice(choiceId: LoveChoiceId) {
  try {
    window.sessionStorage.setItem(MZ_LOVE_CHOICE_STORAGE_KEY, choiceId);
  } catch {
    // The interaction still works when storage is blocked by the browser.
  }
}

function SceneImage({
  sceneKey,
  className,
  eager = false
}: {
  sceneKey: MzLoveSceneKey;
  className?: string;
  eager?: boolean;
}) {
  const scene = getMzLoveScene(sceneKey);
  const avifSrc = scene.src.toLowerCase().endsWith('.webp') ? scene.src.slice(0, -5) + '.avif' : null;
  const priorityAttribute = eager ? { fetchpriority: 'high' as const } : {};

  return (
    <picture className="mz-love-scene-picture">
      {avifSrc ? (
        <source srcSet={avifSrc} type="image/avif" sizes="(max-width: 840px) 100vw, 820px" />
      ) : null}
      <img
        className={className}
        src={scene.src}
        alt={scene.alt}
        width={scene.width}
        height={scene.height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        {...priorityAttribute}
        sizes="(max-width: 840px) 100vw, 820px"
        style={{ objectPosition: `${scene.focalPoint.x * 100}% ${scene.focalPoint.y * 100}%` }}
      />
    </picture>
  );
}

function Dialogue({ children, aside }: { children: ReactNode; aside?: string }) {
  return (
    <div className="mz-love-dialogue">
      <span className="mz-love-dialogue-name">MZ무당</span>
      <p>{children}</p>
      {aside ? <small>{aside}</small> : null}
    </div>
  );
}

export default function LoveReadingLanding() {
  const service = findServiceById(SERVICE_ID);
  const heroRef = useRef<HTMLElement>(null);
  const choiceResultRef = useRef<HTMLDivElement>(null);
  const [selectedChoice, setSelectedChoice] = useState<LoveChoiceId | null>(readStoredChoice);
  const [showStickyCta, setShowStickyCta] = useState(false);

  const selectedChoiceData = useMemo(
    () => loveChoices.find((choice) => choice.id === selectedChoice) ?? null,
    [selectedChoice]
  );

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || !('IntersectionObserver' in window)) {
      setShowStickyCta(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => setShowStickyCta(!entry.isIntersecting), {
      threshold: 0.12
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const chooseReaction = (choiceId: LoveChoiceId) => {
    setSelectedChoice(choiceId);
    storeChoice(choiceId);
    window.requestAnimationFrame(() => choiceResultRef.current?.focus({ preventScroll: true }));
  };

  const formState = selectedChoice
    ? { tabOrigin: '/detail/love-reading', loveReaction: selectedChoice }
    : { tabOrigin: '/detail/love-reading' };

  return (
    <main className="mz-love-landing">
      <header className="mz-love-site-header">
        <Link to="/" className="mz-love-brand" aria-label="운월당 홈으로 이동">
          운월당
        </Link>
        <Link to={FORM_PATH} state={formState} className="mz-love-header-link">
          내 연애 보기
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </header>

      <section ref={heroRef} className="mz-love-hero" aria-labelledby="mz-love-title">
        <SceneImage sceneKey="room-corridor" className="mz-love-hero-image" eager />
        <div className="mz-love-hero-scrim" aria-hidden="true" />
        <div className="mz-love-red-thread" aria-hidden="true" />
        <div className="mz-love-hero-copy">
          <span className="mz-love-act-label">ACT 00 · 붉은 실의 문</span>
          <p className="mz-love-eyebrow">사주로 읽는 나의 연애 반복 패턴</p>
          <h1 id="mz-love-title">
            네 연애,
            <br />
            사람만 바뀌었지
            <br />
            결말은 비슷하지 않아?
          </h1>
          <p className="mz-love-hero-lead">
            붉은 실 따라 들어와.
            <br />
            이번엔 왜 그런지 보여줄게.
          </p>
          <a href="#mz-love-character" className="mz-love-enter-button">
            들어가기
            <ArrowDown size={18} aria-hidden="true" />
          </a>
          <span className="mz-love-scroll-cue" aria-hidden="true">
            SCROLL
          </span>
        </div>
      </section>

      <section id="mz-love-character" className="mz-love-character-reveal" aria-labelledby="mz-love-character-title">
        <div className="mz-love-scene-frame mz-love-scene-frame--portrait">
          <SceneImage sceneKey="hero-fan-closed" />
          <span className="mz-love-frame-glow" aria-hidden="true" />
        </div>
        <div className="mz-love-scene-copy">
          <span className="mz-love-act-label">ACT 01 · MZ무당 등장</span>
          <h2 id="mz-love-character-title" className="mz-love-visually-hidden">
            MZ무당과의 첫 대화
          </h2>
          <Dialogue>
            문 열었으면 들어와.
            <br />
            네 연애부터 볼게.
          </Dialogue>
          <Dialogue aside="근데 사주 보기 전에 하나만 대답해.">
            잠깐.
            <br />
            너 다음 사람보다 먼저 보이는 게 있어.
          </Dialogue>
          <a href="#mz-love-choice" className="mz-love-text-link">
            대답하러 가기
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section id="mz-love-choice" className="mz-love-choice-section" aria-labelledby="mz-love-choice-title">
        <div className="mz-love-section-heading">
          <span className="mz-love-act-label">ACT 02 · 5초 연애 반응</span>
          <p>생각 오래 하지 마. 제일 먼저 드는 쪽으로.</p>
          <h2 id="mz-love-choice-title">
            호감 있던 사람이 하루 만에
            <br />
            “미안, 바빴어”라고 답했다.
          </h2>
        </div>

        <div className="mz-love-choice-grid" role="group" aria-label="연애 반응 선택">
          {loveChoices.map((choice, index) => (
            <button
              key={choice.id}
              type="button"
              className={selectedChoice === choice.id ? 'is-selected' : ''}
              aria-pressed={selectedChoice === choice.id}
              onClick={() => chooseReaction(choice.id)}
            >
              <span>{String.fromCharCode(65 + index)}</span>
              {choice.label}
              {selectedChoice === choice.id ? <Check size={17} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>

        <div
          ref={choiceResultRef}
          className={`mz-love-choice-result ${selectedChoiceData ? 'is-visible' : ''}`}
          tabIndex={-1}
          aria-live="polite"
        >
          {selectedChoiceData ? (
            <>
              <span className="mz-love-dialogue-name">MZ무당의 한마디</span>
              <p>{selectedChoiceData.response}</p>
              <small>이건 사주 결과가 아니라, 네가 고른 반응을 기억해 두는 거야.</small>
              <Link to={FORM_PATH} state={formState} className="mz-love-primary-button">
                내 사주 연결하기
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <p>하나를 고르면 MZ무당이 바로 대답해요.</p>
          )}
        </div>
      </section>

      <section className="mz-love-recommend" aria-labelledby="mz-love-recommend-title">
        <div className="mz-love-recommend-art" aria-hidden="true">
          <SceneImage sceneKey="waiting-for-message" />
        </div>
        <div className="mz-love-recommend-copy">
          <span className="mz-love-act-label">ACT 03 · 이런 밤이 익숙하다면</span>
          <h2 id="mz-love-recommend-title">사람은 달랐는데, 나는 같은 곳에서 흔들렸어.</h2>
          <ul>
            {recommendationLines.map((line, index) => (
              <li key={line}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{line}</p>
              </li>
            ))}
          </ul>
          <blockquote>
            사람이 문제였을 수도 있어.
            <br />
            근데 네가 사랑하는 방식도 한번은 봐야 해.
          </blockquote>
        </div>
      </section>

      <section className="mz-love-chapters" aria-labelledby="mz-love-chapters-title">
        <div className="mz-love-section-heading mz-love-section-heading--center">
          <span className="mz-love-act-label">ACT 04 · 봉인된 연애 장면</span>
          <h2 id="mz-love-chapters-title">
            목차가 아니라,
            <br />
            네가 마주하게 될 아홉 장면
          </h2>
          <p>한 장씩 넘길 때마다 질문이 더 구체적으로 바뀌어요.</p>
        </div>

        <ol className="mz-love-chapter-list">
          {chapterScenes.map((chapter, index) => (
            <li key={chapter.number} className="mz-love-chapter-card">
              <div className="mz-love-chapter-image">
                <SceneImage sceneKey={chapter.scene} />
                <span className="mz-love-chapter-shade" aria-hidden="true" />
              </div>
              <div className="mz-love-chapter-copy">
                <span>CHAPTER {chapter.number}</span>
                <h3>{chapter.title}</h3>
                <p>{chapter.teaser}</p>
                {index > 1 ? (
                  <small>
                    <LockKeyhole size={13} aria-hidden="true" />
                    개인 결과에서 열림
                  </small>
                ) : (
                  <small className="is-open">
                    <Sparkles size={13} aria-hidden="true" />
                    미리보기
                  </small>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mz-love-fact-sample" aria-labelledby="mz-love-fact-sample-title">
        <div className="mz-love-fact-visual">
          <SceneImage sceneKey="whisper-fact" />
        </div>
        <div className="mz-love-fact-card">
          <span className="mz-love-act-label">ACT 05 · 샘플 팩폭</span>
          <div className="mz-love-sample-notice">가상의 샘플 사용자 예시</div>
          <h2 id="mz-love-fact-sample-title">
            평소엔 판단이 빠른 사람인데,
            <br />
            좋아하는 사람 앞에서는 행동보다 가능성을 더 오래 믿는 편.
          </h2>
          <div className="mz-love-evidence-tags" aria-label="명리 근거 예시">
            <span>일지</span>
            <span>편관</span>
            <span>현재 대운</span>
          </div>
          <dl className="mz-love-fact-breakdown">
            <div>
              <dt>쉽게 풀면</dt>
              <dd>확신을 늦게 주는 상대일수록 관계를 더 오래 확인하려는 경향으로 읽힙니다.</dd>
            </div>
            <div>
              <dt>다른 가능성</dt>
              <dd>다만 상대가 행동을 꾸준히 보여주고 있다면 표현 속도가 느린 관계일 수 있어요.</dd>
            </div>
            <div className="is-action">
              <dt>지금 할 일</dt>
              <dd>3주 동안 말이 아니라 약속·연락·만남의 일관성을 확인하세요.</dd>
            </div>
          </dl>
          <p className="mz-love-method-note">실제 리포트도 ‘팩폭 → 근거 → 반대 가능성 → 행동’ 순서로 읽혀요.</p>
        </div>
      </section>

      <section className="mz-love-reversal" aria-labelledby="mz-love-reversal-title">
        <SceneImage sceneKey="final-fact-bomb" className="mz-love-reversal-image" />
        <div className="mz-love-reversal-overlay" aria-hidden="true" />
        <div className="mz-love-reversal-copy">
          <span className="mz-love-act-label">ACT 06 · 반전</span>
          <h2 id="mz-love-reversal-title">다음 사람이 궁금하지?</h2>
          <Dialogue>
            근데 다음 사람 얼굴보다
            <br />
            네가 또 놓칠 신호부터 보는 게 먼저야.
          </Dialogue>
          <strong>
            설렘은 빠르게 오고,
            <br />
            안정감은 조용히 와.
          </strong>
          <Link to={FORM_PATH} state={formState} className="mz-love-primary-button">
            내 첫 팩폭 확인하기
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mz-love-trust" aria-labelledby="mz-love-trust-title">
        <div className="mz-love-trust-room">
          <SceneImage sceneKey="room-consultation" />
          <div className="mz-love-trust-seal" aria-hidden="true">
            <Fingerprint size={34} />
          </div>
        </div>
        <div className="mz-love-trust-copy">
          <span className="mz-love-act-label">ACT 07 · 계산과 해석</span>
          <h2 id="mz-love-trust-title">
            AI가 사주를
            <br />
            계산하지 않습니다.
          </h2>
          <p>
            생년월일시로 명식을 코드 엔진이 계산한 뒤, 그 결과를 바탕으로 연애 패턴을 해석합니다.
          </p>
          <p>
            Gemini는 개인화 문장을 생성하거나 재작성하지 않습니다. 확정된 문장을 그대로 구조화하고 허용된 근거 ID만 연결하며, 서버가 문장 일치와 근거 적합성을 다시 검증합니다.
          </p>
          <ul>
            {trustItems.map((item) => (
              <li key={item}>
                <ShieldCheck size={17} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mz-love-trust-caption">
            해석은 관계를 단정하거나 결정을 대신하지 않아요. 계산 근거와 현실에서 확인할 행동을 함께 제공합니다.
          </p>
        </div>
      </section>

      <section className="mz-love-report-preview" aria-labelledby="mz-love-report-title">
        <div className="mz-love-section-heading mz-love-section-heading--center">
          <span className="mz-love-act-label">ACT 08 · 결과 미리보기</span>
          <h2 id="mz-love-report-title">스크린샷이 아닌, 실제 결과의 읽는 방식</h2>
          <p>아래 내용은 가상의 샘플 데이터이며 실제 결과는 입력한 명식과 고민에 맞춰 달라집니다.</p>
        </div>

        <div className="mz-love-report-shell">
          <header className="mz-love-report-header">
            <span>SAMPLE REPORT</span>
            <h3>김연화 님의 연애 결</h3>
            <p>계수 일간 · 일지 배우자궁 · 현재 대운 흐름</p>
          </header>

          <article className="mz-love-report-fact">
            <small>첫 팩폭</small>
            <h3>마음이 커질수록 상대의 행동보다 가능성을 먼저 믿는 편.</h3>
            <p>기다림이 배려가 되는 관계와, 나만 해석하는 관계를 구분하는 게 이번 흐름의 핵심이에요.</p>
          </article>

          <div className="mz-love-report-versus">
            <article>
              <span>끌리는 타입</span>
              <h3>초반 온도가 높고 예측하기 어려운 사람</h3>
              <p>긴장감이 호기심으로 느껴지기 쉬워요.</p>
            </article>
            <div aria-hidden="true">VS</div>
            <article>
              <span>오래 갈 타입</span>
              <h3>약속과 연락의 속도가 일정한 사람</h3>
              <p>조용해 보여도 관계를 실제로 쌓는 쪽이에요.</p>
            </article>
          </div>

          <article className="mz-love-report-next">
            <div>
              <span>다음 인연의 분위기</span>
              <h3>처음보다 세 번째 만남에서 편안함이 커지는 사람</h3>
              <p>빠른 설렘보다 대화의 리듬과 반복되는 접점을 먼저 확인해 보세요.</p>
            </div>
            <SceneImage sceneKey="first-meeting-scene" />
          </article>

          <article className="mz-love-report-timeline">
            <span>12개월 연애 흐름</span>
            <div>
              {sampleTimeline.map((item) => (
                <section key={item.month}>
                  <small>{item.month}</small>
                  <strong>{item.mood}</strong>
                  <p>{item.copy}</p>
                </section>
              ))}
            </div>
          </article>

          <article className="mz-love-report-plan">
            <span>30일 행동 플랜</span>
            <ol>
              <li>
                <strong>DAY 01–07</strong>
                <p>내가 추측한 것과 상대가 실제로 한 행동을 두 칸으로 나눠 적기</p>
              </li>
              <li>
                <strong>DAY 08–21</strong>
                <p>약속·연락·만남의 일관성을 확인하고 애매한 호의에 의미 더하지 않기</p>
              </li>
              <li>
                <strong>DAY 22–30</strong>
                <p>원하는 관계의 속도를 한 문장으로 말하고 상대의 행동으로 답 확인하기</p>
              </li>
            </ol>
          </article>
        </div>
      </section>

      <section className="mz-love-offer" aria-labelledby="mz-love-offer-title">
        <span className="mz-love-act-label">ACT 09 · 내 결과 열기</span>
        <div className="mz-love-offer-icon" aria-hidden="true">
          <HeartHandshake size={31} />
        </div>
        <p>{service.advisor}의 개인 맞춤 리포트</p>
        <h2 id="mz-love-offer-title">MZ무당 팩폭 연애운</h2>
        <strong>{service.price}</strong>
        <ul>
          <li>
            <Clock3 size={16} aria-hidden="true" /> 입력 약 2분
          </li>
          <li>
            <RefreshCw size={16} aria-hidden="true" /> 결과 저장 · 다시보기
          </li>
        </ul>
        <Link to={FORM_PATH} state={formState} className="mz-love-offer-button">
          내 연애 팩폭 전부 열기
          <ArrowRight size={19} aria-hidden="true" />
        </Link>
        <small>가짜 할인이나 마감 압박 없이, 표시된 상품 가격으로 결제됩니다.</small>
      </section>

      <section className="mz-love-faq" aria-labelledby="mz-love-faq-title">
        <div className="mz-love-section-heading">
          <span className="mz-love-act-label">ACT 10 · 들어가기 전에</span>
          <h2 id="mz-love-faq-title">자주 묻는 질문</h2>
        </div>
        <div className="mz-love-faq-list">
          {faqItems.map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>
                <span>{item.question}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
        <div className="mz-love-final-dialogue">
          <SceneImage sceneKey="hero-fan-closed" />
          <blockquote>
            이번에는 네가 좋아하는지만 보지 마.
            <br />
            그 사람이 관계를 실제로 만들고 있는지 봐.
          </blockquote>
        </div>
        <p className="mz-love-legal">
          본 콘텐츠는 사주명리의 상징과 해석을 바탕으로 자기이해를 돕는 참고 자료입니다. 상대의 마음이나 미래를 사실로
          단정하지 않으며, 의료·법률·재정 등 전문적인 판단을 대신하지 않습니다.
        </p>
      </section>

      <nav className="mz-love-related" aria-label="운월당 대표 사주 리포트">
        <div>
          <span>내 인생 전체 흐름도 함께 보고 싶다면</span>
          <strong>성향·직업·재물·연애·대운을 한 번에 보는 종합사주</strong>
        </div>
        <Link to="/detail/general-saju">
          종합사주 풀이 보기
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <Link to="/detail/past-life-goblin">
          MZ 도깨비 전생사주 보기
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </nav>

      <footer className="mz-love-footer">
        <Link to="/">운월당</Link>
        <nav aria-label="법적 안내">
          <Link to="/terms">이용약관</Link>
          <Link to="/privacy">개인정보처리방침</Link>
          <Link to="/refund">환불정책</Link>
        </nav>
      </footer>

      <aside className={`mz-love-sticky-cta ${showStickyCta ? 'is-visible' : ''}`} aria-label="연애운 시작">
        <div>
          <span>MZ무당 팩폭 연애운</span>
          <strong>{service.price}</strong>
        </div>
        <Link to={FORM_PATH} state={formState}>
          내 결과 열기
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </aside>
    </main>
  );
}
