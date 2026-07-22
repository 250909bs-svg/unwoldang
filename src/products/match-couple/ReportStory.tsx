import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  Home,
  Share2,
  Sparkles
} from 'lucide-react';
import type { SajuReportData } from '../../lib/saju/report';
import coverAvif from './assets/couple-cover.avif';
import coverWebp from './assets/couple-cover.webp';
import dailyAvif from './assets/couple-daily.avif';
import dailyWebp from './assets/couple-daily.webp';
import frictionAvif from './assets/couple-friction.avif';
import frictionWebp from './assets/couple-friction.webp';
import ritualAvif from './assets/couple-ritual.avif';
import ritualWebp from './assets/couple-ritual.webp';
import { buildMatchCoupleStoryChapters, type MatchCoupleStoryChapter } from './story';
import type { MatchCouplePersonFacts, MatchCoupleReportModel } from './types';

type QuestionAnswer = SajuReportData['questionAnswers'][number];

type MatchCoupleStoryReportProps = {
  model: MatchCoupleReportModel;
  answers: QuestionAnswer[];
  createdAt: string;
  storageKey: string;
  shareMessage: string;
  onShare: () => void | Promise<void>;
};

type ArtworkKey = 'cover' | 'daily' | 'friction' | 'ritual';

const artwork: Record<ArtworkKey, { avif: string; webp: string; alt: string }> = {
  cover: {
    avif: coverAvif,
    webp: coverWebp,
    alt: '달빛 아래 두 사람의 붉은 실과 푸른 실이 하나의 매듭을 이루는 궁합 상담 장면'
  },
  friction: {
    avif: frictionAvif,
    webp: frictionWebp,
    alt: '엇갈린 두 사람이 갈등의 실을 다시 연결하는 궁합 웹툰 장면'
  },
  daily: {
    avif: dailyAvif,
    webp: dailyWebp,
    alt: '달빛 아래 두 사람이 연락과 생활 일정, 공동 지출 기준을 함께 정리하는 장면'
  },
  ritual: {
    avif: ritualAvif,
    webp: ritualWebp,
    alt: '두 사람이 붉은 실과 푸른 실로 한 달의 관계 실험을 함께 만드는 장면'
  }
};

const tendencyLabels = {
  supportive: '보완 근거 우세',
  conditional: '조건부 조율',
  tension: '적극 조율 필요',
  insufficient: '판정 유보'
} as const;

function resolveArtworkKey(key: string): ArtworkKey {
  if (/rule|contract|question|experiment|calendar|ritual|final/u.test(key)) return 'ritual';
  if (/message|communication|routine|daily|ledger|money/u.test(key)) return 'daily';
  if (/relation|friction|conflict|caution|warning/u.test(key)) return 'friction';
  return 'cover';
}

function StoryArtwork({
  artworkKey,
  quote,
  eager = false,
  chapterOrder
}: {
  artworkKey: string;
  quote: string;
  eager?: boolean;
  chapterOrder?: number;
}) {
  const key = resolveArtworkKey(artworkKey);
  const scene = artwork[key];

  return (
    <figure className={`match-couple-story-art is-${key}${chapterOrder ? ` is-chapter-${chapterOrder}` : ''}`}>
      <picture>
        <source srcSet={scene.avif} type="image/avif" />
        <img
          src={scene.webp}
          alt={scene.alt}
          width={941}
          height={1672}
          loading={eager ? 'eager' : 'lazy'}
          {...(eager ? { fetchpriority: 'high' as const } : {})}
        />
      </picture>
      <span className="match-couple-story-art__shade" aria-hidden="true" />
      <figcaption>
        <span>월연도령</span>
        <blockquote>“{quote}”</blockquote>
      </figcaption>
    </figure>
  );
}

function evidenceLabel(id: string) {
  const exact: Record<string, string> = {
    'person:self:day-master': '본인 일간',
    'person:self:five-elements': '본인 오행 분포',
    'person:self:ten-gods': '본인 십신 분포',
    'person:self:spouse-palace': '본인 배우자궁',
    'person:partner:day-master': '상대방 일간',
    'person:partner:five-elements': '상대방 오행 분포',
    'person:partner:ten-gods': '상대방 십신 분포',
    'person:partner:spouse-palace': '상대방 배우자궁',
    'compatibility:day-master': '두 일간의 상호작용',
    'compatibility:spouse-palace': '두 배우자궁의 상호작용',
    'compatibility:element-exchange:personA': '본인이 상대에게 주는 오행 흐름',
    'compatibility:element-exchange:personB': '상대가 본인에게 주는 오행 흐름'
  };
  if (exact[id]) return exact[id];
  if (id.startsWith('relation:')) {
    const [, , name] = id.split(':');
    return name ? `교차 관계 · ${name}` : '두 원국의 교차 관계';
  }
  return '두 원국에서 확인한 명리 근거';
}

function EvidenceDisclosure({ chapter }: { chapter: MatchCoupleStoryChapter }) {
  const evidence = [...new Set(chapter.evidenceIds.map(evidenceLabel))];
  const uncertainty = [...new Set(chapter.uncertainty)];

  return (
    <details className="match-couple-story-evidence">
      <summary>
        <span>왜 이렇게 읽었는지</span>
        계산 근거와 다른 가능성 보기
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div>
        <section>
          <strong>직접 연결한 근거</strong>
          <ul>
            {(evidence.length ? evidence : ['현재 입력에서 확인 가능한 관계 맥락']).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <strong>해석의 한계</strong>
          <ul>
            {(uncertainty.length
              ? uncertainty
              : ['이 문장은 관계 결과를 확정하지 않고 실제 행동으로 확인할 기준만 제안합니다.']
            ).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>
    </details>
  );
}

function PersonCard({ person, role }: { person: MatchCouplePersonFacts | null; role: '본인' | '상대방' }) {
  if (!person) {
    return (
      <article className="match-couple-story-person is-withheld">
        <span>{role}</span>
        <h3>원국 결론 유보</h3>
        <p>시간 미상 시나리오에서 일주가 달라 임의의 시각을 고르지 않았습니다.</p>
      </article>
    );
  }

  return (
    <article className={`match-couple-story-person is-${role === '본인' ? 'self' : 'partner'}`}>
      <header>
        <span>{role}</span>
        <h3>{person.name}</h3>
        <strong>{person.dayMaster} · {person.dayMasterElement} 일간</strong>
      </header>
      <dl className="match-couple-story-pillars">
        <div><dt>연주</dt><dd>{person.pillars.year}</dd></div>
        <div><dt>월주</dt><dd>{person.pillars.month}</dd></div>
        <div><dt>일주</dt><dd>{person.pillars.day}</dd></div>
        <div className={!person.pillars.hour ? 'is-unknown' : undefined}>
          <dt>시주</dt><dd>{person.pillars.hour || '미상'}</dd>
        </div>
      </dl>
      <section className="match-couple-story-fact-row">
        <div>
          <span>배우자궁</span>
          <b>{person.spousePalace.branch} · {person.spousePalace.element} · {person.spousePalace.tenGod}</b>
        </div>
        <div>
          <span>계산 상태</span>
          <b>{person.availability.status === 'available' ? '확인 가능' : '일부 제한'}</b>
        </div>
      </section>
      <details className="match-couple-story-distribution">
        <summary>오행·십신 분포 펼치기</summary>
        <div>
          <section>
            <strong>오행</strong>
            <ul>{person.fiveElements.map((item) => <li key={item.label}><span>{item.label}</span><b>{item.weight}</b></li>)}</ul>
          </section>
          <section>
            <strong>십신</strong>
            <ul>{person.tenGods.filter((item) => item.weight > 0).map((item) => <li key={item.label}><span>{item.label}</span><b>{item.weight}</b></li>)}</ul>
          </section>
        </div>
      </details>
      {person.availability.note ? <p className="match-couple-story-person__note">{person.availability.note}</p> : null}
    </article>
  );
}

function RelationMap({ model }: { model: MatchCoupleReportModel }) {
  return (
    <div className="match-couple-story-relations">
      {model.relations.map((group) => (
        <article key={group.id} className={group.items.length ? 'has-evidence' : 'is-empty'}>
          <header><strong>{group.label}</strong><span>{group.items.length ? `${group.items.length}개 근거` : '직접 근거 없음'}</span></header>
          {group.items.length ? (
            <div>
              {group.items.map((item) => (
                <details key={item.id}>
                  <summary>{item.subtype || item.name}</summary>
                  <p>{item.description}</p>
                  {item.uncertainty.length ? <small>{item.uncertainty.join(' ')}</small> : null}
                </details>
              ))}
            </div>
          ) : <p>없는 관계를 채워 넣지 않았습니다.</p>}
        </article>
      ))}
    </div>
  );
}

function CautionBoard({ model }: { model: MatchCoupleReportModel }) {
  return (
    <div className="match-couple-story-cautions">
      <section><span>STOP · 말</span><ul>{model.cautionWords.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><span>STOP · 행동</span><ul>{model.cautionActions.map((item) => <li key={item}>{item}</li>)}</ul></section>
    </div>
  );
}

function RuleContract({ model }: { model: MatchCoupleReportModel }) {
  return (
    <ol className="match-couple-story-contract">
      {model.relationshipRules.map((rule, index) => (
        <li key={rule}><span>{String(index + 1).padStart(2, '0')}</span><p>{rule}</p><Check size={18} aria-hidden="true" /></li>
      ))}
    </ol>
  );
}

function QuestionCards({ model, answers }: { model: MatchCoupleReportModel; answers: QuestionAnswer[] }) {
  return (
    <div className="match-couple-story-questions">
      {model.questions.map((question, index) => {
        const answer = answers[index];
        return (
          <article key={`${index}-${question}`}>
            <blockquote>
              <span>{model.names[0]}의 질문 {index + 1}</span>
              <p>“{question}”</p>
            </blockquote>
            <section>
              <span>월연도령의 답</span>
              <h3>{answer?.title || (model.guidance ? '행동으로 확인할 기준부터 보겠습니다.' : '계산 가능한 범위까지만 답합니다.')}</h3>
              <p>{answer?.analysis || (model.guidance
                ? '개별 생성 답변을 확인할 수 없어 계산 근거와 관계 규칙만 제공합니다.'
                : '시간 미상 시나리오에서 핵심 기둥이 달라 단일 답을 만들지 않았습니다.'
              )}</p>
              {answer?.advice?.length ? <ul>{answer.advice.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            </section>
          </article>
        );
      })}
    </div>
  );
}

function readCompleted(storageKey: string) {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function ExperimentChecklist({ model, storageKey }: { model: MatchCoupleReportModel; storageKey: string }) {
  const key = `unwoldang:match-couple:experiment:${storageKey}`;
  const [completed, setCompleted] = useState<string[]>(() => readCompleted(key));
  const [status, setStatus] = useState('');

  const toggle = (days: string) => {
    const next = completed.includes(days) ? completed.filter((item) => item !== days) : [...completed, days];
    setCompleted(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      setStatus('이 기기에 관계 실험 진행을 저장했습니다.');
    } catch {
      setStatus('현재 브라우저에서는 저장하지 못했지만 체크 상태는 이 화면에 유지됩니다.');
    }
  };

  return (
    <section className="match-couple-story-experiment" aria-labelledby="match-couple-experiment-progress">
      <header>
        <span id="match-couple-experiment-progress">30 DAY RELATIONSHIP LAB</span>
        <strong>{completed.length} / {model.experiment.length} 구간 실천</strong>
        <progress max={model.experiment.length} value={completed.length} aria-label={`관계 실험 ${model.experiment.length}개 중 ${completed.length}개 완료`} />
      </header>
      <div>
        {model.experiment.map((item) => (
          <label key={item.days} className={completed.includes(item.days) ? 'is-complete' : undefined}>
            <input type="checkbox" checked={completed.includes(item.days)} onChange={() => toggle(item.days)} />
            <span>{item.days}</span>
            <strong>{item.title}</strong>
            <p>{item.action}</p>
            <small>{item.check}</small>
          </label>
        ))}
      </div>
      <p role="status" aria-live="polite">{status}</p>
    </section>
  );
}

function ChapterBody({
  chapter,
  model,
  answers,
  storageKey
}: {
  chapter: MatchCoupleStoryChapter;
  model: MatchCoupleReportModel;
  answers: QuestionAnswer[];
  storageKey: string;
}) {
  switch (chapter.order) {
    case 1:
      return <div className="match-couple-story-people"><PersonCard person={model.people[0]} role="본인" /><PersonCard person={model.people[1]} role="상대방" /></div>;
    case 2:
      return <RelationMap model={model} />;
    case 10:
      return <CautionBoard model={model} />;
    case 11:
      return <RuleContract model={model} />;
    case 12:
      return <QuestionCards model={model} answers={answers} />;
    case 13:
      return <ExperimentChecklist model={model} storageKey={storageKey} />;
    default:
      return chapter.practicalRule ? (
        <aside className="match-couple-story-rule"><Sparkles size={18} aria-hidden="true" /><div><span>둘이 바로 써볼 규칙</span><p>{chapter.practicalRule}</p></div></aside>
      ) : null;
  }
}

function ChapterSection({
  chapter,
  model,
  answers,
  storageKey,
  children
}: {
  chapter: MatchCoupleStoryChapter;
  model: MatchCoupleReportModel;
  answers: QuestionAnswer[];
  storageKey: string;
  children?: ReactNode;
}) {
  return (
    <section className={`match-couple-story-chapter is-${chapter.artworkKey}`} id={`match-couple-chapter-${chapter.order}`} aria-labelledby={`match-couple-chapter-title-${chapter.order}`}>
      <header>
        <span>{chapter.eyebrow}</span>
        <h2 id={`match-couple-chapter-title-${chapter.order}`}>{chapter.title}</h2>
      </header>
      <StoryArtwork artworkKey={chapter.artworkKey} quote={chapter.factBomb} chapterOrder={chapter.order} />
      <div className="match-couple-story-dialogue">
        <blockquote className="is-reader"><span>월연도령 · 관계 팩폭</span><p>{chapter.statement}</p></blockquote>
        {chapter.practicalRule ? <blockquote className="is-couple"><span>{model.names[0]} × {model.names[1]}</span><p>{chapter.practicalRule}</p></blockquote> : null}
      </div>
      <ChapterBody chapter={chapter} model={model} answers={answers} storageKey={storageKey} />
      {children}
      <EvidenceDisclosure chapter={chapter} />
      {chapter.order < 13 ? (
        <a className="match-couple-story-next" href={`#match-couple-chapter-${chapter.order + 1}`}>
          <span>두 색의 실 따라 다음 장</span><ArrowDown size={18} aria-hidden="true" />
        </a>
      ) : null}
    </section>
  );
}

function directAnswers(model: MatchCoupleReportModel) {
  const guidance = model.guidance;
  return [
    { label: '관계 한 줄', value: model.overview?.statement || '핵심 일주가 달라 단일 결론을 유보했습니다.' },
    { label: '끌림', value: guidance?.attraction.statement || '판정 유보' },
    { label: '감정 표현', value: guidance?.emotionalExpression.statement || '판정 유보' },
    { label: '연락·대화', value: guidance?.communication.statement || '판정 유보' },
    { label: '갈등 회복', value: guidance?.conflictRecovery.statement || '판정 유보' },
    { label: '생활 습관', value: guidance?.dailyLife.statement || '판정 유보' },
    { label: '소비·재물', value: guidance?.money.statement || '판정 유보' },
    { label: '장기 역할', value: guidance?.longTermRoles.statement || '판정 유보' },
    { label: '관계 안전장치', value: model.relationshipRules[0] || '둘이 확인 가능한 규칙부터 합의하세요.' }
  ];
}

export default function MatchCoupleStoryReport({
  model,
  answers,
  createdAt,
  storageKey,
  shareMessage,
  onShare
}: MatchCoupleStoryReportProps) {
  const chapters = useMemo(() => buildMatchCoupleStoryChapters(model), [model]);
  const answersDeck = useMemo(() => directAnswers(model), [model]);
  const tendency = model.overview?.tendency || 'insufficient';
  const formattedDate = Number.isNaN(new Date(createdAt).getTime())
    ? createdAt
    : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date(createdAt));

  return (
    <article className="match-couple-story" aria-labelledby="match-couple-story-title">
      <nav className="match-couple-story-topbar" aria-label="리포트 메뉴">
        <Link to="/my"><ArrowLeft size={18} aria-hidden="true" /><span>보관함</span></Link>
        <strong>월연도령 · 관계 상담록</strong>
        <Link to="/" aria-label="홈으로"><Home size={18} aria-hidden="true" /></Link>
      </nav>

      <section className="match-couple-story-cover" id="match-couple-story-cover">
        <StoryArtwork artworkKey="cover" quote="좋다, 나쁘다보다 이 관계가 실제로 어떻게 움직이는지부터 볼게." eager />
        <div className="match-couple-story-cover__copy">
          <span>PRIVATE MATCH CONSULTATION</span>
          <h1 id="match-couple-story-title">{model.names[0]} <i>×</i> {model.names[1]}</h1>
          <p>{model.relationshipSummary}</p>
          <div className={`match-couple-story-tendency is-${tendency}`}><strong>{tendencyLabels[tendency]}</strong><span>점수가 아닌 정성 근거</span></div>
          <blockquote>{model.overview?.statement || '입력 시나리오에서 일주가 달라 단일 궁합 결론을 유보했습니다.'}</blockquote>
          <dl>
            <div><dt>상담 생성일</dt><dd>{formattedDate}</dd></div>
            <div><dt>리포트 구성</dt><dd>13개 웹툰 장</dd></div>
            <div><dt>{model.names[0]}</dt><dd>{model.people[0]?.availability.status === 'available' ? '원국 확인' : '일부 제한'}</dd></div>
            <div><dt>{model.names[1]}</dt><dd>{model.people[1]?.availability.status === 'available' ? '원국 확인' : '일부 제한'}</dd></div>
          </dl>
          <div className="match-couple-story-cover__actions" data-export-remove="true">
            <a href="#match-couple-story-toc"><BookOpen size={17} aria-hidden="true" />목차</a>
            <button type="button" onClick={() => void onShare()}><Share2 size={17} aria-hidden="true" />상품 공유</button>
          </div>
          {shareMessage ? <small role="status" aria-live="polite">{shareMessage}</small> : null}
        </div>
      </section>

      <nav className="match-couple-story-toc" id="match-couple-story-toc" aria-label="궁합 웹툰 목차">
        <details>
          <summary><BookOpen size={18} aria-hidden="true" /><span>13개 장 목차 열기</span><ChevronDown size={18} aria-hidden="true" /></summary>
          <ol>
            <li><a href="#match-couple-story-docket"><span>서문</span>두 사람의 관계 접수서</a></li>
            <li><a href="#match-couple-story-quick-answers"><span>핵심</span>결론부터 보는 9개 직답</a></li>
            {chapters.map((chapter) => <li key={chapter.id}><a href={`#match-couple-chapter-${chapter.order}`}><span>{String(chapter.order).padStart(2, '0')}</span>{chapter.title}</a></li>)}
          </ol>
        </details>
      </nav>

      <section className="match-couple-story-docket" id="match-couple-story-docket" aria-labelledby="match-couple-story-docket-title">
        <header><span>CONSULTATION DOCKET</span><h2 id="match-couple-story-docket-title">둘을 섞기 전에, 두 원국을 따로 확인했습니다</h2><p>입력 맥락과 명리 계산값을 분리하고, 두 사람에게 공통으로 확인되는 근거만 관계 해석에 연결했습니다.</p></header>
        <div className="match-couple-story-docket__people"><PersonCard person={model.people[0]} role="본인" /><PersonCard person={model.people[1]} role="상대방" /></div>
        {model.limitations.length ? (
          <details className="match-couple-story-limitations">
            <summary><CircleAlert size={18} aria-hidden="true" /><span>계산에서 제외하거나 유보한 항목 {model.limitations.length}개</span><ChevronDown size={18} aria-hidden="true" /></summary>
            <ul>{model.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          </details>
        ) : null}
      </section>

      <section className="match-couple-story-quick" id="match-couple-story-quick-answers" aria-labelledby="match-couple-story-quick-title">
        <header><span>9 DIRECT ANSWERS</span><h2 id="match-couple-story-quick-title">바쁜 둘을 위한 관계 핵심 9가지</h2><p>먼저 결론을 읽고, 뒤의 13개 장에서 계산 근거와 실제 행동을 확인하세요.</p></header>
        <ol>{answersDeck.map((item, index) => <li key={item.label}><span>{String(index + 1).padStart(2, '0')} · {item.label}</span><p>{item.value}</p></li>)}</ol>
      </section>

      <div className="match-couple-story-chapters">
        {chapters.map((chapter) => <ChapterSection key={chapter.id} chapter={chapter} model={model} answers={answers} storageKey={storageKey} />)}
      </div>

      <footer className="match-couple-story-footer">
        <Archive size={24} aria-hidden="true" />
        <strong>점수가 아니라, 둘이 운영할 수 있는 관계 기준을 남깁니다.</strong>
        <p>이 리포트는 전통 명리의 구조적 상호작용을 설명하는 참고 자료이며 상대의 마음이나 관계 결과를 확정하지 않습니다.</p>
        <div><Link to="/my">보관함에서 다시 보기</Link><Link to="/detail/match-couple">상품 상세 보기</Link></div>
      </footer>
    </article>
  );
}
