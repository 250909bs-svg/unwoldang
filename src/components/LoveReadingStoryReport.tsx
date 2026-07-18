import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { MZ_LOVE_SCENE_MANIFEST } from '../lib/mz-love-fact/sceneManifest';
import { buildMzLoveViewModel, mzLoveCustomerNarrativeOrFallback } from '../lib/mz-love-fact/viewModel';
import type {
  EvidenceTag,
  MzLoveChapterViewModel,
  MzLoveReportViewModel,
  RelationshipStatus,
  SceneArtwork
} from '../lib/mz-love-fact/types';
import type { SajuReportData } from '../lib/saju/report';
import { createLoveReadingProductShareData } from '../lib/loveReadingShare';
import '../styles/mz-love-fact.css';
import '../styles/mz-love-report.css';

type LoveChapter = MzLoveChapterViewModel;
type LoveViewModel = MzLoveReportViewModel;

type ChecklistItem = {
  id: string;
  week: number;
  label: string;
};

export type LoveReadingStoryReportProps = {
  report: SajuReportData;
  finalCtaLabel?: string;
  shareLabel?: string;
  checklistStorageKey?: string;
  relationshipStatus?: RelationshipStatus;
  birthTimeKnown?: boolean;
  onFinalCta?: (completedMissionIds: string[]) => void;
  onShare?: () => void | Promise<void>;
  onChecklistChange?: (completedMissionIds: string[]) => void;
};

const MESSAGE_CHOICES = [
  {
    id: 'ask-now',
    text: '“왜 답장 안 해?”라고 바로 확인한다',
    response: '답을 빨리 받는 것보다, 내가 원하는 연락과 관계의 기준을 차분하게 한 번 말하는 게 먼저야.'
  },
  {
    id: 'act-fine',
    text: '“괜찮아, 바빴나 보네.”라고 넘긴다',
    response: '괜찮은 척이 배려가 되는 날도 있지만, 서운함을 계속 숨기면 상대는 네 기준을 배울 기회가 없어.'
  },
  {
    id: 'delay-back',
    text: '나도 일부러 답장을 늦춘다',
    response: '속도를 맞추는 것과 밀당은 달라. 감정을 시험하지 말고 다음 약속을 실제로 잡는지 확인해.'
  }
] as const;

const DEFAULT_RED_FLAGS = [
  '관계에 대한 질문은 피하면서 필요할 때만 연락한다',
  '약속을 반복해서 미루고도 구체적인 대안을 만들지 않는다',
  '서운함을 말했을 때 대화보다 네 예민함을 문제 삼는다'
] as const;

const DEFAULT_GREEN_FLAGS = [
  '말한 약속을 작은 것부터 꾸준히 지킨다',
  '불편한 대화 뒤에도 연락을 끊지 않고 해결을 시도한다',
  '좋아한다는 말과 실제 시간 배분이 같은 방향을 향한다'
] as const;

function readChecklist(storageKey: string) {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || '[]') as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [] as string[];
  }
}

function writeChecklist(storageKey: string, completed: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(completed));
  } catch {
    // The checklist remains usable in-memory when private browsing blocks storage.
  }
}

function compactList(values: Array<string | undefined>, fallbacks: readonly string[], limit = 3) {
  const unique = [...values, ...fallbacks]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.indexOf(value) === index);

  return unique.slice(0, limit);
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function sceneStyle(scene: SceneArtwork): CSSProperties {
  return {
    objectPosition: `${Math.round(scene.focalPoint.x * 100)}% ${Math.round(scene.focalPoint.y * 100)}%`
  };
}

function SceneFigure({ scene, quote, eager = false }: { scene: SceneArtwork; quote?: string; eager?: boolean }) {
  return (
    <figure className="mz-love-report__scene">
      <div className="mz-love-report__scene-frame">
        <picture>
          <source type="image/avif" srcSet={scene.src.replace(/\.webp$/, '.avif')} />
          <img
            src={scene.src}
            alt={scene.alt}
            width={scene.width}
            height={scene.height}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            style={sceneStyle(scene)}
          />
        </picture>
        <span className="mz-love-report__scene-shade" aria-hidden="true" />
      </div>
      {quote ? <figcaption>“{quote}”</figcaption> : null}
    </figure>
  );
}

const EVIDENCE_SOURCE_LABELS: Record<EvidenceTag['source'], string> = {
  'natal-chart': '원국 계산값',
  'ten-god': '십성 계산값',
  relationship: '관계 분석 원문',
  timing: '시기 분석 원문',
  'engine-meta': '전문 판정 원문'
};

export function EvidenceDisclosure({ evidence }: { evidence: readonly EvidenceTag[] }) {
  if (!evidence.length) {
    return null;
  }

  return (
    <section className="mz-love-report__evidence-panel" aria-label="명리 해석과 원문이 직접 연결된 근거">
      <p className="mz-love-report__evidence-heading">이 명리 해석과 직접 연결된 원문 근거</p>
      <ul className="mz-love-report__evidence">
        {evidence.map((item) => (
          <li key={item.id}>
            <details>
              <summary>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </summary>
              <div className="mz-love-report__evidence-detail">
                <p>{item.description}</p>
                <dl>
                  <div><dt>출처</dt><dd>{EVIDENCE_SOURCE_LABELS[item.source]}</dd></div>
                  {typeof item.confidence === 'number'
                    ? <div><dt>신뢰도</dt><dd>{Math.round(item.confidence * 100)}%</dd></div>
                    : null}
                </dl>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReadingFormula({ chapter }: { chapter: LoveChapter }) {
  const steps = [
    { label: chapter.evidence.length > 0 ? '명리 해석' : '관계 패턴 해석', value: chapter.interpretation },
    { label: '현실 장면', value: chapter.realLifeScene },
    { label: '반대 가능성', value: chapter.counterpoint },
    { label: '확인 기준', value: chapter.checkSignal },
    { label: '지금 할 행동', value: chapter.action }
  ];

  return (
    <div className="mz-love-report__reading">
      <blockquote className="mz-love-report__fact-bomb">
        <span>팩폭</span>
        <p>{chapter.factBomb}</p>
      </blockquote>
      <ol className="mz-love-report__formula" aria-label={`${chapter.title} 상세 해석`}>
        {steps.map((step, index) => (
          <li key={step.label}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.value}</p>
              {index === 0 ? <EvidenceDisclosure evidence={chapter.evidence} /> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AttractionComparison({ attraction, lasting }: { attraction?: LoveChapter; lasting?: LoveChapter }) {
  const [activeTab, setActiveTab] = useState<'attraction' | 'lasting'>('attraction');
  const profiles = [
    { id: 'attraction' as const, chapter: attraction, label: '강하게 끌리는 신호' },
    { id: 'lasting' as const, chapter: lasting, label: '조용히 쌓이는 신호' }
  ];

  return (
    <section className="mz-love-report__comparison" aria-labelledby="love-comparison-title">
      <header>
        <span>DIRECT COMPARE</span>
        <h3 id="love-comparison-title">설렘과 지속 가능성을 따로 볼게</h3>
      </header>
      <div className="mz-love-report__tabs" role="tablist" aria-label="연애 상대 유형 비교" data-export-remove="true">
        <button
          type="button"
          role="tab"
          id="attraction-tab"
          aria-selected={activeTab === 'attraction'}
          aria-controls="love-type-panel-attraction"
          onClick={() => setActiveTab('attraction')}
        >
          내가 끌리는 사람
        </button>
        <button
          type="button"
          role="tab"
          id="lasting-tab"
          aria-selected={activeTab === 'lasting'}
          aria-controls="love-type-panel-lasting"
          onClick={() => setActiveTab('lasting')}
        >
          실제로 오래 갈 사람
        </button>
      </div>
      {profiles.map((profile) => {
        if (!profile.chapter) {
          return null;
        }

        const values = [
          { label: '첫인상', value: profile.chapter.factBomb },
          { label: '연락과 감정 표현', value: profile.chapter.realLifeScene },
          { label: '관계 속도', value: profile.chapter.interpretation },
          { label: '장기 가능성', value: profile.chapter.checkSignal },
          { label: '놓치지 말 것', value: profile.chapter.action }
        ];

        return (
          <div
            className={`mz-love-report__comparison-panel mz-love-report__comparison-panel--${profile.id}`}
            id={`love-type-panel-${profile.id}`}
            key={profile.id}
            role="tabpanel"
            aria-labelledby={`${profile.id}-tab`}
            tabIndex={activeTab === profile.id ? 0 : -1}
            hidden={activeTab !== profile.id}
            data-export-reveal="true"
          >
            <strong>{profile.label}</strong>
            <dl>
              {values.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </section>
  );
}

function MonthTimeline({ report }: { report: SajuReportData }) {
  const months = report.monthLuck.slice(0, 12);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!months.length) {
    return null;
  }

  return (
    <section className="mz-love-report__timeline" aria-labelledby="love-timeline-title">
      <header>
        <span>12 MONTH SIGNAL</span>
        <h3 id="love-timeline-title">붉은 구슬을 눌러 월별 흐름을 확인해</h3>
        <p>정확한 사건 날짜가 아니라, 관계가 움직이기 쉬운 온도와 조건을 보여줍니다.</p>
      </header>
      <div className="mz-love-report__month-tabs" role="tablist" aria-label="12개월 연애 흐름" data-export-remove="true">
        {months.map((month, index) => (
          <button
            type="button"
            role="tab"
            key={`${month.year}-${month.month}`}
            id={`love-month-tab-${index}`}
            aria-selected={index === activeIndex}
            aria-controls={`love-month-panel-${index}`}
            onClick={() => setActiveIndex(index)}
          >
            <span aria-hidden="true" />
            {month.month}월
          </button>
        ))}
      </div>
      {months.map((month, index) => {
        const temperatureLabel = month.score >= 75 ? '상승' : month.score >= 55 ? '관찰' : '정비';
        const flowFallback = month.score >= 75
          ? '대화와 만남의 접점을 한 번 더 넓혀 보기 좋은 흐름이에요.'
          : month.score >= 55
            ? '서두르기보다 상대의 말과 행동이 같은 방향인지 살펴볼 흐름이에요.'
            : '새로운 결론보다 내 감정과 관계의 경계를 돌보는 데 집중할 흐름이에요.';
        const summary = mzLoveCustomerNarrativeOrFallback(month.summary, flowFallback);
        const focus = mzLoveCustomerNarrativeOrFallback(
          month.focus,
          '큰 반응 한 번보다 약속·연락·만남이 꾸준히 이어지는지 확인하세요.'
        );
        const warning = mzLoveCustomerNarrativeOrFallback(
          month.warning,
          '특정 날짜나 한 번의 연락이 관계의 결말을 정한다고 단정하지 마세요.'
        );

        return (
          <article
            className="mz-love-report__month-panel"
            id={`love-month-panel-${index}`}
            key={`${month.year}-${month.month}`}
            role="tabpanel"
            aria-labelledby={`love-month-tab-${index}`}
            tabIndex={index === activeIndex ? 0 : -1}
            hidden={index !== activeIndex}
            data-export-reveal="true"
          >
            <div className="mz-love-report__temperature">
              <span>{month.year}년 {month.month}월 · {temperatureLabel}</span>
              <strong>{month.score}°</strong>
              <meter min="0" max="100" value={month.score} aria-label={`연애운 온도 ${month.score}점`} />
            </div>
            <dl>
              <div>
                <dt>주요 흐름</dt>
                <dd>{summary}</dd>
              </div>
              <div>
                <dt>집중할 행동</dt>
                <dd>{focus}</dd>
              </div>
              <div>
                <dt>주의할 점</dt>
                <dd>{warning}</dd>
              </div>
              <div>
                <dt>이번 달 확인 기준</dt>
                <dd>사건을 단정하지 않고 관계의 말과 행동을 함께 봅니다.</dd>
              </div>
            </dl>
          </article>
        );
      })}
    </section>
  );
}

function MessageChoice({ chapter }: { chapter: LoveChapter }) {
  const [selectedId, setSelectedId] = useState<(typeof MESSAGE_CHOICES)[number]['id'] | null>(null);
  const selected = MESSAGE_CHOICES.find((choice) => choice.id === selectedId);

  return (
    <section className="mz-love-report__message-choice" aria-labelledby="message-choice-title">
      <header>
        <span>MESSAGE TEST</span>
        <h3 id="message-choice-title">답장이 늦을 때, 네가 제일 자주 하는 반응은?</h3>
      </header>
      <div className="mz-love-report__message-options" data-export-remove="true">
        {MESSAGE_CHOICES.map((choice) => (
          <button
            type="button"
            key={choice.id}
            aria-pressed={selectedId === choice.id}
            onClick={() => setSelectedId(choice.id)}
          >
            {choice.text}
          </button>
        ))}
      </div>
      {selected ? (
        <div className="mz-love-report__message-answer" role="status" aria-live="polite" data-export-remove="true">
          <span>MZ무당의 해설</span>
          <p>“{selected.response}”</p>
          <strong>이번 관계에서 확인할 것</strong>
          <p>{chapter.checkSignal}</p>
        </div>
      ) : (
        <p className="mz-love-report__message-hint" data-export-remove="true">하나를 고르면 밀당 대신 쓸 수 있는 기준을 알려줄게.</p>
      )}
      <div className="mz-love-report__export-message-list" data-export-only="true" aria-hidden="true">
        <h4>메시지 반응별 해설</h4>
        {MESSAGE_CHOICES.map((choice) => (
          <article key={choice.id}>
            <strong>{choice.text}</strong>
            <p>{choice.response}</p>
          </article>
        ))}
        <p><strong>이번 관계에서 확인할 것</strong> · {chapter.checkSignal}</p>
      </div>
    </section>
  );
}

function FlagBoard({
  redFlags: reportRedFlags,
  greenFlags: reportGreenFlags,
  chapter
}: {
  redFlags: readonly string[];
  greenFlags: readonly string[];
  chapter: LoveChapter;
}) {
  const redFlags = compactList([...reportRedFlags], DEFAULT_RED_FLAGS);
  const greenFlags = compactList([...reportGreenFlags], DEFAULT_GREEN_FLAGS);

  return (
    <section className="mz-love-report__flag-board" aria-labelledby="flag-board-title">
      <header>
        <span>BEHAVIOR CHECK</span>
        <h3 id="flag-board-title">불안한 말보다 반복되는 행동을 봐</h3>
      </header>
      <div className="mz-love-report__flag-columns">
        <article className="mz-love-report__flag-card mz-love-report__flag-card--red">
          <h4>멈춰서 볼 레드 플래그</h4>
          <ul>
            {redFlags.map((flag) => <li key={flag}>{flag}</li>)}
          </ul>
        </article>
        <article className="mz-love-report__flag-card mz-love-report__flag-card--green">
          <h4>심심해 보여도 지킬 그린 플래그</h4>
          <ul>
            {greenFlags.map((flag) => <li key={flag}>{flag}</li>)}
          </ul>
        </article>
      </div>
      <aside className="mz-love-report__watch-rule">
        <strong>얼마나 지켜볼까?</strong>
        <p>{chapter.checkSignal}</p>
        <p>{chapter.action}</p>
      </aside>
    </section>
  );
}

function buildChecklist(actionPlan: LoveViewModel['actionPlan'], actionChapter?: LoveChapter): ChecklistItem[] {
  if (actionPlan.thirtyDays.length >= 4) {
    return actionPlan.thirtyDays.flatMap((mission, index) => [
      {
        id: `w${mission.week}-primary-${index}`,
        week: mission.week,
        label: mission.task
      },
      {
        id: `w${mission.week}-start-${index}`,
        week: mission.week,
        label: actionPlan.start[index % Math.max(actionPlan.start.length, 1)] || DEFAULT_GREEN_FLAGS[index % DEFAULT_GREEN_FLAGS.length]
      },
      {
        id: `w${mission.week}-check-${index}`,
        week: mission.week,
        label: actionPlan.check[index % Math.max(actionPlan.check.length, 1)] || actionChapter?.checkSignal || '말보다 반복되는 행동을 확인하기'
      }
    ]);
  }

  const stop = compactList([...actionPlan.stop], DEFAULT_RED_FLAGS);
  const start = compactList([...actionPlan.start], DEFAULT_GREEN_FLAGS);
  const check = compactList(
    [actionChapter?.checkSignal, actionChapter?.action, actionPlan.check[0]],
    ['말과 약속이 같은 방향인지 기록하기', '불편한 질문 뒤 상대의 태도 확인하기', '내가 원하는 관계를 한 문장으로 말하기']
  );

  return [
    { id: 'w1-pattern', week: 1, label: '반복해서 마음이 흔들린 장면을 한 줄로 기록하기' },
    { id: 'w1-stop', week: 1, label: stop[0] },
    { id: 'w1-feeling', week: 1, label: '상대의 말과 별개로 오늘 내 감정에 이름 붙이기' },
    { id: 'w2-actions', week: 2, label: '말한 약속과 실제 행동을 분리해서 적기' },
    { id: 'w2-green', week: 2, label: start[0] },
    { id: 'w2-check', week: 2, label: check[0] },
    { id: 'w3-question', week: 3, label: '관계에서 필요한 질문을 돌려 말하지 않고 묻기' },
    { id: 'w3-start', week: 3, label: start[1] },
    { id: 'w3-boundary', week: 3, label: check[1] },
    { id: 'w4-review', week: 4, label: '4주 동안 반복된 행동 신호를 다시 읽기' },
    { id: 'w4-stop', week: 4, label: stop[1] },
    { id: 'w4-decide', week: 4, label: check[2] }
  ];
}

function MissionChecklist({
  items,
  completed,
  onToggle
}: {
  items: ChecklistItem[];
  completed: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <section className="mz-love-report__mission" id="mz-love-30-day-mission" aria-labelledby="mission-title">
      <header>
        <span>30 DAY MISSION</span>
        <h3 id="mission-title">이번 사랑을 바꾸는 30일</h3>
        <p>{completed.length}/{items.length}개 완료 · 선택하면 이 기기에 자동 저장됩니다.</p>
        <progress max={items.length} value={completed.length} aria-label={`30일 미션 ${items.length}개 중 ${completed.length}개 완료`} />
      </header>
      {[1, 2, 3, 4].map((week) => (
        <fieldset key={week}>
          <legend>{week}주차 · {['내 반복 패턴 기록', '말과 행동 분리', '필요한 질문하기', '계속할 관계 판단'][week - 1]}</legend>
          {items.filter((item) => item.week === week).map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={completed.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </section>
  );
}

function ChapterSection({
  chapter,
  children
}: {
  chapter: LoveChapter;
  children?: ReactNode;
}) {
  return (
    <section
      className={`mz-love-report__chapter mz-love-report__chapter--${chapter.layout || 'story'}`}
      id={`mz-love-chapter-${chapter.order}`}
      aria-labelledby={`mz-love-chapter-title-${chapter.order}`}
      data-scene={chapter.scene?.key}
    >
      <header className="mz-love-report__chapter-heading">
        <span>{chapter.eyebrow}</span>
        <h2 id={`mz-love-chapter-title-${chapter.order}`}>{chapter.title}</h2>
        {chapter.subtitle ? <p>{chapter.subtitle}</p> : null}
      </header>
      {chapter.scene ? <SceneFigure scene={chapter.scene} quote={chapter.characterLine} /> : (
        <blockquote className="mz-love-report__character-line">“{chapter.characterLine}”</blockquote>
      )}
      <ReadingFormula chapter={chapter} />
      {children}
      {chapter.order < 13 ? (
        <a className="mz-love-report__next-thread" href={`#mz-love-chapter-${chapter.order + 1}`}>
          붉은 실 따라 다음 장 보기
        </a>
      ) : null}
    </section>
  );
}

export default function LoveReadingStoryReport({
  report,
  finalCtaLabel = '내 30일 미션 저장하기',
  shareLabel = '이 상품 공유하기',
  checklistStorageKey,
  relationshipStatus,
  birthTimeKnown,
  onFinalCta,
  onShare,
  onChecklistChange
}: LoveReadingStoryReportProps) {
  const viewModel = useMemo(
    () => buildMzLoveViewModel(report, { relationshipStatus, birthTimeKnown }),
    [birthTimeKnown, relationshipStatus, report]
  );
  const coverScene = MZ_LOVE_SCENE_MANIFEST['hero-fan-closed'] ?? viewModel.chapters.find((chapter) => chapter.scene)?.scene ?? null;
  const attraction = viewModel.chapters.find((chapter) => chapter.order === 3);
  const lasting = viewModel.chapters.find((chapter) => chapter.order === 4);
  const messageChapter = viewModel.chapters.find((chapter) => chapter.order === 9);
  const flagChapter = viewModel.chapters.find((chapter) => chapter.order === 11);
  const actionChapter = viewModel.chapters.find((chapter) => chapter.order === 12);
  const storageKey = checklistStorageKey || `unwoldang:mz-love-mission:${report.serialNumber}`;
  const checklist = useMemo(() => buildChecklist(viewModel.actionPlan, actionChapter), [actionChapter, viewModel.actionPlan]);
  const [completed, setCompleted] = useState<string[]>(() => readChecklist(storageKey));
  const [shareStatus, setShareStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const updateCompleted = (next: string[]) => {
    setCompleted(next);
    writeChecklist(storageKey, next);
    onChecklistChange?.(next);
  };

  const toggleMission = (id: string) => {
    updateCompleted(completed.includes(id) ? completed.filter((item) => item !== id) : [...completed, id]);
  };

  const handleFinalCta = () => {
    writeChecklist(storageKey, completed);
    onFinalCta?.(completed);
    setSaveStatus('30일 미션을 이 기기에 저장했어요. 다음에 다시 열어도 이어집니다.');
  };

  const handleShare = async () => {
    try {
      if (onShare) {
        await onShare();
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(createLoveReadingProductShareData(
          typeof window !== 'undefined' ? window.location.origin : undefined
        ));
      } else if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined') {
        await navigator.clipboard.writeText(createLoveReadingProductShareData(window.location.origin).url);
      }
      setShareStatus('상품 링크를 공유할 준비가 됐어요. 개인 결과는 포함되지 않아요.');
    } catch (error) {
      setShareStatus(error instanceof DOMException && error.name === 'AbortError' ? '공유를 취소했어요.' : '공유 중 문제가 생겼어요. 다시 시도해 주세요.');
    }
  };

  return (
    <article className="mz-love-report" aria-labelledby="mz-love-report-title">
      <section className="mz-love-report__cover" id="mz-love-report-cover">
        {coverScene ? <SceneFigure scene={coverScene} eager /> : null}
        <div className="mz-love-report__cover-copy">
          <span>{viewModel.cover.eyebrow}</span>
          <h1 id="mz-love-report-title">{viewModel.cover.title}</h1>
          <p>{viewModel.cover.subtitle}</p>
          <blockquote>“좋아. 이제 듣기 좋은 말 말고 네 연애에 필요한 말부터 할게.”</blockquote>
          <dl className="mz-love-report__cover-meta">
            <div><dt>생성일</dt><dd>{formatCreatedAt(viewModel.cover.createdAt)}</dd></div>
            <div><dt>현재 관계</dt><dd>{viewModel.cover.relationshipLabel}</dd></div>
            <div><dt>읽는 기준</dt><dd>감정·말·행동</dd></div>
            <div><dt>리포트 구성</dt><dd>13개 연애 챕터</dd></div>
          </dl>
          <ul className="mz-love-report__keywords" aria-label="핵심 연애 키워드">
            {viewModel.cover.keywords.map((keyword) => <li key={keyword}>{keyword}</li>)}
          </ul>
          <div className="mz-love-report__cover-actions" data-export-remove="true">
            <a href="#mz-love-30-day-mission">미션 저장</a>
            <button type="button" onClick={handleShare}>상품 공유</button>
            <a href="#mz-love-report-toc">목차</a>
          </div>
        </div>
      </section>

      <nav className="mz-love-report__toc" id="mz-love-report-toc" aria-label="팩폭 연애운 목차">
        <details>
          <summary>13개 챕터 목차 열기</summary>
          <ol>
            {viewModel.chapters.map((chapter) => (
              <li key={chapter.id}>
                <a href={`#mz-love-chapter-${chapter.order}`}>
                  <span>{String(chapter.order).padStart(2, '0')}</span>
                  {chapter.title}
                </a>
              </li>
            ))}
          </ol>
        </details>
      </nav>

      <div className="mz-love-report__chapters">
        {viewModel.chapters.map((chapter) => (
          <ChapterSection key={chapter.id} chapter={chapter}>
            {chapter.order === 5 ? <AttractionComparison attraction={attraction} lasting={lasting} /> : null}
            {chapter.order === 8 ? <MonthTimeline report={report} /> : null}
            {chapter.order === 9 && messageChapter ? <MessageChoice chapter={messageChapter} /> : null}
            {chapter.order === 11 && flagChapter ? (
              <FlagBoard redFlags={viewModel.redFlags} greenFlags={viewModel.greenFlags} chapter={flagChapter} />
            ) : null}
            {chapter.order === 12 ? (
              <MissionChecklist items={checklist} completed={completed} onToggle={toggleMission} />
            ) : null}
            {chapter.order === 13 ? (
              <footer className="mz-love-report__final-actions" data-export-remove="true">
                <button type="button" onClick={handleFinalCta}>{finalCtaLabel}</button>
                <button type="button" onClick={handleShare}>{shareLabel}</button>
                <p className="mz-love-report__status" role="status" aria-live="polite">{saveStatus || shareStatus}</p>
              </footer>
            ) : null}
          </ChapterSection>
        ))}
      </div>

      <footer className="mz-love-report__disclaimer">
        <strong>읽기 전에 기억해 주세요</strong>
        <ul>
          {viewModel.disclaimers.map((disclaimer) => <li key={disclaimer}>{disclaimer}</li>)}
        </ul>
      </footer>
    </article>
  );
}
