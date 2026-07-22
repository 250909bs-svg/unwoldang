import { ArrowLeft, ArrowRight, Check, LockKeyhole, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IntakeFormData, LoveFocus } from '../api/mockData';
import { useAuth } from '../context/AuthContext';
import { validateBirthInput } from '../lib/birthInputValidation';
import { buildMzLoveViewModel } from '../lib/mz-love-fact/viewModel';
import { mapIntakeRelationshipStatus } from '../lib/mz-love-fact/relationshipStatusAdapter';
import { getMzLoveScene } from '../lib/mz-love-fact/sceneManifest';
import { buildPartnerSpecificityProfile } from '../lib/mz-love-fact/partnerSpecificity';
import { getPremiumLoveAnswers } from '../lib/mz-love-fact/premiumLove';
import type { MzLoveChapterId, SceneArtwork } from '../lib/mz-love-fact/types';
import { buildSajuReport } from '../lib/saju/reportBuilder';
import { getMotionSafeScrollBehavior } from '../shared/ui';
import '../styles/mz-love-intake.css';

type PreviewLocationState = {
  formData?: Partial<IntakeFormData>;
  tabOrigin?: string;
  draftOwnerId?: string;
  recoveredEntitlement?: {
    orderId: string;
    reportAccessToken: string;
  };
};

const DRAFT_KEY_PREFIX = 'unwoldang.love-intake.v3';
const GUEST_DRAFT_KEY = `${DRAFT_KEY_PREFIX}.guest`;

const FOCUS_CHAPTERS: Record<LoveFocus, MzLoveChapterId> = {
  'partner-type': 'lasting-partner',
  'next-love-timing': 'twelve-month-timing',
  'my-attraction': 'love-self',
  'repeated-pattern': 'repeated-attraction'
};

const FOCUS_LABELS: Record<LoveFocus, string> = {
  'partner-type': '내게 맞는 사람의 특징',
  'next-love-timing': '다음 연애를 하는 시기',
  'my-attraction': '이성들이 보는 내 진짜 매력',
  'repeated-pattern': '내가 반복하는 사랑의 패턴'
};

const PILLARS = [
  { key: 'hour', label: '시주' },
  { key: 'day', label: '일주' },
  { key: 'month', label: '월주' },
  { key: 'year', label: '년주' }
] as const;

function readStoredFormData(draftKey: string | null) {
  if (typeof window === 'undefined' || !draftKey) return null;
  const raw = window.sessionStorage.getItem(draftKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Partial<IntakeFormData>;
  } catch {
    window.sessionStorage.removeItem(draftKey);
    return null;
  }
}

function isLoveFocus(value: unknown): value is LoveFocus {
  return typeof value === 'string' && value in FOCUS_CHAPTERS;
}

function ScenePicture({
  scene,
  className = '',
  eager = false
}: {
  scene: SceneArtwork;
  className?: string;
  eager?: boolean;
}) {
  const avifSource = scene.src.replace(/\.webp$/i, '.avif');

  return (
    <picture className={className}>
      <source srcSet={avifSource} type="image/avif" />
      <img
        src={scene.src}
        alt={scene.alt}
        width={scene.width}
        height={scene.height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        style={{ objectPosition: `${scene.focalPoint.x * 100}% ${scene.focalPoint.y * 100}%` }}
      />
    </picture>
  );
}

function scrollToStoryScene(sceneId: string) {
  document.getElementById(sceneId)?.scrollIntoView({ behavior: getMotionSafeScrollBehavior(), block: 'start' });
}

function SpeechBalloon({
  speaker,
  side = 'left',
  tone = 'character',
  children
}: {
  speaker: string;
  side?: 'left' | 'right';
  tone?: 'character' | 'customer' | 'fact';
  children: ReactNode;
}) {
  return (
    <div className={['mz-love-speech', 'is-' + side, 'is-' + tone].join(' ')}>
      <small>{speaker}</small>
      <div>{children}</div>
    </div>
  );
}

function WebtoonScene({
  id,
  episode,
  scene,
  nextId,
  nextLabel = '다음 장면',
  className = '',
  eager = false,
  children
}: {
  id: string;
  episode: string;
  scene: SceneArtwork;
  nextId?: string;
  nextLabel?: string;
  className?: string;
  eager?: boolean;
  children: ReactNode;
}) {
  return (
    <article id={id} className={['mz-love-story-panel', className].filter(Boolean).join(' ')}>
      <ScenePicture scene={scene} eager={eager} />
      <span className="mz-love-story-shade" aria-hidden="true" />
      <span className="mz-love-story-episode">{episode}</span>
      <div className="mz-love-story-content">{children}</div>
      {nextId ? (
        <button
          type="button"
          className="mz-love-story-next"
          onClick={() => scrollToStoryScene(nextId)}
          aria-label={nextLabel + '으로 이동'}
        >
          <span>{nextLabel}</span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
}

export default function LoveReadingPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const previewRef = useRef<HTMLElement>(null);
  const locationState = (location.state as PreviewLocationState | null) ?? null;
  const tabOrigin = locationState?.tabOrigin || '/detail/love-reading';
  const draftKey = useMemo(
    () => user?.id ? `${DRAFT_KEY_PREFIX}.${user.id}` : GUEST_DRAFT_KEY,
    [user?.id]
  );
  const locationFormData = !locationState?.draftOwnerId || locationState.draftOwnerId === user?.id
    ? locationState?.formData
    : undefined;
  const formData = useMemo(
    () => locationFormData ?? readStoredFormData(draftKey) ?? readStoredFormData(GUEST_DRAFT_KEY),
    [draftKey, locationFormData]
  );
  const validation = useMemo(
    () => validateBirthInput(formData || {}, { subjectLabel: '본인' }),
    [formData]
  );
  const intakeComplete = Boolean(
    validation.valid &&
    formData?.relationshipStatus &&
    isLoveFocus(formData?.loveFocus) &&
    formData?.q1?.trim().length && formData.q1.trim().length >= 4 &&
    formData?.q2?.trim().length && formData.q2.trim().length >= 4
  );
  const result = useMemo(() => {
    if (!formData || !intakeComplete) return null;

    try {
      const report = buildSajuReport('love-reading', formData);
      const viewModel = buildMzLoveViewModel(report, {
        relationshipStatus: mapIntakeRelationshipStatus(formData.relationshipStatus),
        birthTimeKnown: !formData.isUnknownTime && Boolean(formData.birthTime),
        interestedIn: formData.interestedIn
      });

      return { report, viewModel, error: '' };
    } catch (error) {
      return {
        report: null,
        viewModel: null,
        error: error instanceof Error ? error.message : '사주 원국을 계산하지 못했습니다.'
      };
    }
  }, [formData, intakeComplete]);

  useEffect(() => {
    if (typeof window !== 'undefined' && formData && draftKey && isAuthenticated) {
      window.sessionStorage.setItem(draftKey, JSON.stringify(formData));
    }
  }, [draftKey, formData, isAuthenticated]);

  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      target?.scrollIntoView({ block: 'start' });
      return;
    }

    previewRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.hash, result?.report]);

  const editForm = () => {
    navigate('/form/love-reading', {
      state: {
        formData,
        tabOrigin,
        draftOwnerId: user?.id,
        recoveredEntitlement: locationState?.recoveredEntitlement
      }
    });
  };

  if (!formData || !intakeComplete || !result?.report || !result.viewModel) {
    const errorMessage = result?.error || validation.errors[0]?.message || '연애 상황과 관심 주제, 추가 질문 두 가지를 모두 입력해 주세요.';

    return (
      <main ref={previewRef} className="mz-love-preview-page mz-love-preview-error">
        <section>
          <span>원국 확인이 필요해요</span>
          <h1>한 가지만 다시 볼게</h1>
          <p>{errorMessage}</p>
          <button type="button" onClick={editForm}>
            입력 정보 확인하기
            <ArrowRight size={19} aria-hidden="true" />
          </button>
        </section>
      </main>
    );
  }

  const { report, viewModel } = result;
  const focus = isLoveFocus(formData.loveFocus) ? formData.loveFocus : 'my-attraction';
  const focusChapter = viewModel.chapters.find((chapter) => chapter.id === FOCUS_CHAPTERS[focus]);
  const openingScene = getMzLoveScene('hero-fan-closed');
  const roomScene = getMzLoveScene('room-consultation');
  const whisperScene = getMzLoveScene('whisper-fact');
  const futurePartnerScene = getMzLoveScene('future-partner-fan');
  const timingScene = getMzLoveScene('timing-rising-moon');
  const finalScene = getMzLoveScene('final-fact-bomb');
  const loveSelfChapter = viewModel.chapters.find((chapter) => chapter.id === 'love-self');
  const specificity = buildPartnerSpecificityProfile(report, formData.interestedIn);
  const heightTeaser = specificity.height.numericReference
    ? `${specificity.height.representativeCm}cm 전후`
    : specificity.height.label;
  const premiumAnswers = getPremiumLoveAnswers(report, formData.interestedIn);
  const premiumAnswerById = new Map(premiumAnswers.map((answer) => [answer.id, answer]));
  const meetingScene = getMzLoveScene(specificity.meeting.sceneKey);
  const elementTotal = Math.max(1, report.fiveElements.reduce((sum, item) => sum + item.value, 0));
  const displayName = formData.name?.trim() || report.customerName;
  const helpful = report.helpfulElements.join('·') || '균형 기운';
  const cautious = report.cautiousElements.join('·') || '과한 기운';
  const precisionLabel = formData.isUnknownTime
    ? `${report.engineMeta?.scenarioCount || 12}개 출생시간 가능성 비교`
    : '입력한 분 단위 출생시각 반영';

  const continueToCheckout = () => {
    if (!isAuthenticated) {
      window.sessionStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(formData));
      navigate('/login', {
        state: {
          returnTo: '/preview/love-reading',
          tabOrigin
        }
      });
      return;
    }
    if (locationState?.recoveredEntitlement) {
      navigate('/loading', {
        state: {
          product: 'love-reading',
          formData,
          paymentMethod: 'portone',
          orderId: locationState.recoveredEntitlement.orderId,
          reportAccessToken: locationState.recoveredEntitlement.reportAccessToken,
          tabOrigin
        }
      });
      return;
    }

    navigate('/checkout', {
      state: {
        product: 'love-reading',
        formData,
        tabOrigin,
        draftOwnerId: user?.id
      }
    });
  };

  return (
    <main ref={previewRef} className="mz-love-preview-page">
      <header className="mz-love-preview-header">
        <button type="button" onClick={editForm} aria-label="입력 정보 수정하기">
          <ArrowLeft size={25} aria-hidden="true" />
        </button>
        <div>
          <span>무료 사주 미리보기</span>
          <strong>MZ무당 팩폭 연애운</strong>
        </div>
        <i aria-hidden="true" />
      </header>

      <section className="mz-love-webtoon-story" aria-label={displayName + '님의 연애 사주 웹툰 미리보기'}>
        <WebtoonScene
          id="love-story-opening"
          episode="PROLOGUE · 00"
          scene={openingScene}
          nextId="love-story-chart"
          nextLabel="내 원국 펼쳐보기"
          eager
        >
          <div className="mz-love-dialogue-stack">
            <SpeechBalloon speaker="MZ무당">
              <p>왔네, <b>{displayName}</b>.</p>
              <p>네가 만날 사람부터 묻고 싶겠지만, 먼저 그 사람을 끌어당기는 <b>네 원국</b>부터 정확히 펼쳐볼게.</p>
            </SpeechBalloon>
            <SpeechBalloon speaker={displayName} side="right" tone="customer">
              <p>“{formData.q1?.trim()}”</p>
            </SpeechBalloon>
          </div>
        </WebtoonScene>

        <WebtoonScene
          id="love-story-chart"
          episode="CHAPTER · 01"
          scene={roomScene}
          nextId="love-story-pattern"
          nextLabel="연애 속 내 모습 보기"
          className="is-chart"
        >
          <div className="mz-love-dialogue-stack is-chart-dialogue">
            <SpeechBalloon speaker="MZ무당">
              <p>네 중심은 <b>{report.dayMaster} {report.dayMasterElement} 일간</b>, 지금 원국의 힘은 <b>{report.strengthLabel}</b>으로 읽혀.</p>
            </SpeechBalloon>

            <article className="mz-love-wonguk-board is-story" aria-label={displayName + '님의 사주 원국'}>
              <header>
                <span>{report.birthLabel}</span>
                <strong>{report.zodiac}띠 · {precisionLabel}</strong>
              </header>
              <div className="mz-love-wonguk-pillars">
                {PILLARS.map((pillar) => {
                  const value = report.pillars[pillar.key];
                  const characters = value ? Array.from(value) : [];

                  return (
                    <section key={pillar.key} className={!value ? 'is-unknown' : undefined}>
                      <span>{pillar.label}</span>
                      {value ? (
                        <strong aria-label={pillar.label + ' ' + value}>
                          <b>{characters[0]}</b>
                          <em>{characters.slice(1).join('')}</em>
                        </strong>
                      ) : (
                        <strong><b>미</b><em>상</em></strong>
                      )}
                    </section>
                  );
                })}
              </div>
              <footer>
                <span><Check size={14} aria-hidden="true" /> 만세력 계산 완료</span>
                <button type="button" onClick={editForm}>입력 수정</button>
              </footer>
            </article>

            <div className="mz-love-comic-facts" aria-label="원국 핵심 요약">
              <span><small>일간</small><strong>{report.dayMasterElement}</strong></span>
              <span><small>격국</small><strong>{report.gyeokguk}</strong></span>
              <span><small>도움</small><strong>{helpful}</strong></span>
              <span><small>주의</small><strong>{cautious}</strong></span>
            </div>

            <SpeechBalloon speaker="MZ무당 · 근거" side="right" tone="fact">
              <p>오행 분포는 {report.fiveElements.map((item) => item.label + ' ' + Math.round((item.value / elementTotal) * 100) + '%').join(' · ')}.</p>
              <p>이 균형을 배우자궁·십성과 함께 봐야 연애 습관이 보여.</p>
            </SpeechBalloon>
          </div>
        </WebtoonScene>

        <WebtoonScene
          id="love-story-pattern"
          episode="CHAPTER · 02"
          scene={whisperScene}
          nextId="love-story-focus"
          nextLabel="내 질문의 답 보기"
        >
          <div className="mz-love-dialogue-stack">
            <SpeechBalloon speaker="MZ무당 · 첫 팩폭">
              <p>{loveSelfChapter?.factBomb || '네가 사랑에 빠지는 방식부터 먼저 짚어볼게.'}</p>
            </SpeechBalloon>
            <SpeechBalloon speaker={displayName} side="right" tone="customer">
              <p>“{formData.q2?.trim()}”</p>
            </SpeechBalloon>
            <SpeechBalloon speaker="MZ무당">
              <p>{loveSelfChapter?.interpretation || '말보다 반복되는 행동을 봐야 네 연애의 답이 선명해져.'}</p>
            </SpeechBalloon>
            <aside className="mz-love-story-caption">
              <small>현실에서 나타나는 장면</small>
              <p>{loveSelfChapter?.realLifeScene}</p>
              <strong>{loveSelfChapter?.checkSignal}</strong>
            </aside>
          </div>
        </WebtoonScene>

        <WebtoonScene
          id="love-story-focus"
          episode="CHAPTER · 03"
          scene={focusChapter?.scene || whisperScene}
          nextId="love-story-partner"
          nextLabel="미래 인연 단서 보기"
          className="is-focus"
        >
          <div className="mz-love-dialogue-stack">
            <SpeechBalloon speaker={'선택한 질문 · ' + FOCUS_LABELS[focus]}>
              <h2>{focusChapter?.title || FOCUS_LABELS[focus]}</h2>
              <p>{focusChapter?.factBomb || premiumAnswerById.get('who')?.answer}</p>
            </SpeechBalloon>
            <SpeechBalloon speaker="MZ무당 · 더 구체적으로" side="right" tone="fact">
              <p>{focusChapter?.interpretation}</p>
            </SpeechBalloon>
            <SpeechBalloon speaker="이번 주 행동">
              <p>{focusChapter?.action}</p>
            </SpeechBalloon>
          </div>
        </WebtoonScene>

        <WebtoonScene
          id="love-story-partner"
          episode="CHAPTER · 04"
          scene={futurePartnerScene}
          nextId="love-story-meeting"
          nextLabel="어디서 만나는지 보기"
          className="is-partner-vault"
        >
          <div className="mz-love-dialogue-stack is-vault-dialogue">
            <SpeechBalloon speaker="MZ무당">
              <p>상징 프로필 1순위로는 <b>{heightTeaser}</b>, 얼굴은 <b>{specificity.face.label}</b> 쪽이 가장 강해.</p>
              <em>배우자궁·십성·오행으로 만든 대표 인연상이며 실제 인물을 확정한 말은 아니야.</em>
            </SpeechBalloon>

            <section className="mz-love-portrait-vault" aria-label="잠긴 미래 인연 초상">
              <div className="mz-love-vault-lock" aria-hidden="true">
                <LockKeyhole size={30} />
              </div>
              <div className="mz-love-vault-portrait" aria-hidden="true">
                <ScenePicture scene={futurePartnerScene} />
                <span className="mz-love-vault-portrait__seal"><LockKeyhole size={36} /></span>
              </div>
              <span>FUTURE FACE · LOCKED</span>
              <h2>네 인연 얼굴은 아직 봉인했어</h2>
              <dl>
                <div><dt>대표 키감</dt><dd>{heightTeaser}</dd></div>
                <div><dt>얼굴 1순위</dt><dd>{specificity.face.primary}</dd></div>
                <div className="is-locked"><dt>직업 Top 3</dt><dd><LockKeyhole size={11} /> 본편 공개</dd></div>
                <div className="is-locked"><dt>정확한 만남 장소</dt><dd><LockKeyhole size={11} /> 본편 공개</dd></div>
              </dl>
              <button type="button" onClick={continueToCheckout}>
                <LockKeyhole size={17} aria-hidden="true" />
                잠금 풀고 인연 얼굴 보기
              </button>
            </section>

            <SpeechBalloon speaker="MZ무당" side="right" tone="customer">
              <p>궁금하지? <b>빨리 잠금 풀어봐.</b> 눈매·코선·스타일, 직업명 세 가지와 어디서 만나는지까지 이어서 보여줄게.</p>
            </SpeechBalloon>
          </div>
        </WebtoonScene>

        <WebtoonScene
          id="love-story-meeting"
          episode="CHAPTER · 05"
          scene={meetingScene}
          nextId="love-story-locked"
          nextLabel="잠긴 본편 목차 보기"
          className="is-meeting"
        >
          <div className="mz-love-dialogue-stack">
            <SpeechBalloon speaker="MZ무당 · 만남 1순위">
              <h2>{specificity.meeting.primaryContext}</h2>
              <p>도움 오행 {report.helpfulElements[0] || specificity.meeting.evidence[0]}이 가리키는 만남의 결이야. 정확한 장소 한 곳은 본편에 봉인해뒀어.</p>
            </SpeechBalloon>

            <div className="mz-love-preview-sealed-grid" aria-label="본편에서 공개되는 미래 인연 상세 항목">
              <article>
                <LockKeyhole size={17} aria-hidden="true" />
                <span>정확한 1순위 장소</span>
                <strong>본편에서 공개</strong>
              </article>
              <article>
                <LockKeyhole size={17} aria-hidden="true" />
                <span>직업명 Top 3</span>
                <strong>힌트 · {specificity.professions[0].fieldLabel}</strong>
              </article>
              <article>
                <LockKeyhole size={17} aria-hidden="true" />
                <span>첫 만남 뒤 확인 신호</span>
                <strong>본편에서 공개</strong>
              </article>
            </div>

            <SpeechBalloon speaker="MZ무당 · 계산 근거" side="right" tone="fact">
              <p>배우자궁·상위 십성·도움 오행을 교차 계산했어.</p>
              <em>{specificity.evidenceSummary}</em>
            </SpeechBalloon>
          </div>
        </WebtoonScene>

        <WebtoonScene
          id="love-story-locked"
          episode="CHAPTER · 06"
          scene={timingScene}
          nextId="love-story-final"
          nextLabel="마지막 팩폭 보기"
          className="is-locked-chapters"
        >
          <div className="mz-love-dialogue-stack">
            <SpeechBalloon speaker="MZ무당 · 시기 미리보기">
              <p>절기 기준 12개월을 모두 계산했고, 움직임이 큰 세 구간까지 좁혔어.</p>
              <p>정확한 년·월과 그때 해야 할 행동은 본편에서 공개할게.</p>
            </SpeechBalloon>
            <div className="mz-love-locked-clues">
              {[
                '미래 인연 얼굴 전체와 이목구비 9항목',
                '직업 Top 3별 성향·수입 리듬·연락 방식',
                '첫 만남 장면·12개월 타이밍·결혼 흐름'
              ].map((label) => (
                <span key={label}><LockKeyhole size={16} aria-hidden="true" /> {label}</span>
              ))}
            </div>
            <SpeechBalloon speaker="MZ무당" side="right">
              <p>여기서 끝내면 얼굴의 절반만 본 거야. 본편에는 <b>13개 웹툰 장</b>으로 왜 그런지까지 풀어뒀어.</p>
            </SpeechBalloon>
          </div>
        </WebtoonScene>

        <WebtoonScene
          id="love-story-final"
          episode="EPILOGUE · 07"
          scene={finalScene}
          className="is-final"
        >
          <div className="mz-love-dialogue-stack">
            <SpeechBalloon speaker="MZ무당 · 마지막 팩폭">
              <h2>네 인연, 모호하게 말하지 않을게.</h2>
              <p>얼굴·키감·직업·만남 장소를 1순위부터 짚고, 실제 관계에서 확인할 행동까지 이어서 보여줄게.</p>
            </SpeechBalloon>

            <aside className="mz-love-specificity-note">
              <Sparkles size={17} aria-hidden="true" />
              <p>{specificity.disclosure}</p>
            </aside>

            {report.engineMeta?.uncertainty?.length ? (
              <aside className="mz-love-specificity-note is-uncertainty">
                <strong>계산 정확도 안내</strong>
                <p>{report.engineMeta.uncertainty[0]}</p>
              </aside>
            ) : null}

            <button type="button" className="mz-love-story-unlock" onClick={continueToCheckout}>
              <LockKeyhole size={19} aria-hidden="true" />
              <span>
                <small>미래 인연 얼굴부터 13개 본편까지</small>
                <strong>이 원국으로 팩폭 연애운 잠금 풀기</strong>
              </span>
              <ArrowRight size={21} aria-hidden="true" />
            </button>
            <button type="button" className="mz-love-story-edit" onClick={editForm}>입력 정보 다시 보기</button>
          </div>
        </WebtoonScene>
      </section>
    </main>
  );
}
