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
import { validateLoveReadingIntakeContext } from '../products/love-reading/intakeContract';
import { getLoveReactionProfile } from '../products/love-reading/reactionProfiles';
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
const GUEST_HANDOFF_KEY = `${DRAFT_KEY_PREFIX}.guest-handoff`;
const GUEST_HANDOFF_MAX_AGE_MS = 15 * 60 * 1000;

type GuestDraftHandoff = {
  nonce: string;
  issuedAt: number;
};

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

function createGuestDraftHandoff(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const nonce = window.crypto?.randomUUID?.()
      ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const handoff: GuestDraftHandoff = {
      nonce,
      issuedAt: Date.now()
    };
    window.sessionStorage.setItem(GUEST_HANDOFF_KEY, JSON.stringify(handoff));
    return nonce;
  } catch {
    return null;
  }
}

function hasValidGuestDraftHandoff(nonce: string | null): boolean {
  if (typeof window === 'undefined' || !nonce) return false;

  try {
    const raw = window.sessionStorage.getItem(GUEST_HANDOFF_KEY);
    if (!raw) return false;

    const handoff = JSON.parse(raw) as Partial<GuestDraftHandoff>;
    const ageMs = typeof handoff.issuedAt === 'number'
      ? Date.now() - handoff.issuedAt
      : Number.POSITIVE_INFINITY;

    return handoff.nonce === nonce
      && ageMs >= 0
      && ageMs <= GUEST_HANDOFF_MAX_AGE_MS;
  } catch {
    window.sessionStorage.removeItem(GUEST_HANDOFF_KEY);
    return false;
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
  document.getElementById(sceneId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const handoffNonce = useMemo(
    () => new URLSearchParams(location.search).get('loveHandoff'),
    [location.search]
  );
  const hasGuestHandoff = useMemo(
    () => Boolean(user?.id && hasValidGuestDraftHandoff(handoffNonce)),
    [handoffNonce, user?.id]
  );
  const draftKey = useMemo(
    () => user?.id ? `${DRAFT_KEY_PREFIX}.${user.id}` : GUEST_DRAFT_KEY,
    [user?.id]
  );
  const canUseLocationDraft = locationState?.draftOwnerId
    ? locationState.draftOwnerId === user?.id
    : !user?.id || hasGuestHandoff;
  const locationFormData = canUseLocationDraft ? locationState?.formData : undefined;
  const formData = useMemo(
    () => locationFormData ?? readStoredFormData(draftKey) ?? (
      hasGuestHandoff ? readStoredFormData(GUEST_DRAFT_KEY) : null
    ),
    [draftKey, hasGuestHandoff, locationFormData]
  );
  const birthValidation = useMemo(
    () => validateBirthInput(formData || {}, { subjectLabel: '본인' }),
    [formData]
  );
  const contextValidation = useMemo(
    () => validateLoveReadingIntakeContext(formData || {}),
    [formData]
  );
  const reactionProfile = getLoveReactionProfile(formData?.loveReaction);
  const intakeComplete = birthValidation.valid && contextValidation.valid;
  const result = useMemo(() => {
    if (!formData || !intakeComplete) return null;

    try {
      const report = buildSajuReport('love-reading', formData);
      const viewModel = buildMzLoveViewModel(report, {
        relationshipStatus: mapIntakeRelationshipStatus(formData.relationshipStatus),
        relationshipDuration: formData.relationshipDuration,
        birthTimeKnown: !formData.isUnknownTime && Boolean(formData.birthTime),
        interestedIn: formData.interestedIn,
        loveReaction: formData.loveReaction,
        loveFocus: formData.loveFocus,
        primaryQuestion: formData.q1?.trim()
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
      if (hasGuestHandoff) {
        window.sessionStorage.removeItem(GUEST_DRAFT_KEY);
        window.sessionStorage.removeItem(GUEST_HANDOFF_KEY);
      }
    }
  }, [draftKey, formData, hasGuestHandoff, isAuthenticated]);

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

  if (!formData || !intakeComplete || !reactionProfile || !result?.report || !result.viewModel) {
    const errorMessage = result?.error
      || birthValidation.errors[0]?.message
      || contextValidation.errors[0]?.message
      || '관계 상태, 연애 반응, 관심 주제와 질문 두 가지를 모두 입력해 주세요.';

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
      const guestHandoffNonce = createGuestDraftHandoff();
      const returnTo = guestHandoffNonce
        ? `/preview/love-reading?loveHandoff=${encodeURIComponent(guestHandoffNonce)}`
        : '/preview/love-reading';
      navigate('/login', {
        state: {
          returnTo,
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
            <SpeechBalloon speaker={`연애 반응 ${reactionProfile.id} · ${reactionProfile.profileTitle}`} tone="fact">
              <p>{reactionProfile.response}</p>
            </SpeechBalloon>
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
          nextLabel="관계 패턴 단서 보기"
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
          nextLabel="만남 조건 후보 보기"
          className="is-partner-vault"
        >
          <div className="mz-love-dialogue-stack is-vault-dialogue">
            <SpeechBalloon speaker="MZ무당">
              <p>배우자궁·십성·오행에서는 <b>{specificity.face.label}</b> 같은 인상이 여러 상징 후보 중 하나로 읽혀.</p>
              <em>상징 후보는 관계 신호를 살펴보는 참고이며 실제 사람의 얼굴·키·직업을 예측하거나 확정하지 않아.</em>
            </SpeechBalloon>

            <section className="mz-love-portrait-vault" aria-label="잠긴 관계 상징 후보">
              <div className="mz-love-vault-lock" aria-hidden="true">
                <LockKeyhole size={30} />
              </div>
              <div className="mz-love-vault-portrait" aria-hidden="true">
                <ScenePicture scene={futurePartnerScene} />
                <span className="mz-love-vault-portrait__seal"><LockKeyhole size={36} /></span>
              </div>
              <span>SYMBOLIC CLUES · LOCKED</span>
              <h2>관계에서 알아볼 상징 후보</h2>
              <dl>
                <div><dt>인상 후보</dt><dd>{specificity.face.primary}</dd></div>
                <div><dt>해석 방식</dt><dd>상징·조건 비교</dd></div>
                <div className="is-locked"><dt>생활 환경 후보</dt><dd><LockKeyhole size={11} /> 본편 공개</dd></div>
                <div className="is-locked"><dt>만남 조건 후보</dt><dd><LockKeyhole size={11} /> 본편 공개</dd></div>
              </dl>
              <button type="button" onClick={continueToCheckout}>
                <LockKeyhole size={17} aria-hidden="true" />
                상징 후보와 확인 조건 보기
              </button>
            </section>

            <SpeechBalloon speaker="MZ무당" side="right" tone="customer">
              <p>본편에서는 후보가 나온 명리 근거와, 현실 관계에서 직접 확인할 행동 신호를 함께 보여줄게.</p>
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
            <SpeechBalloon speaker="MZ무당 · 만남 조건 후보">
              <h2>{specificity.meeting.primaryContext}</h2>
              <p>도움 오행 {report.helpfulElements[0] || specificity.meeting.evidence[0]}에서 읽은 접점 환경 후보야. 실제 만남을 보장하거나 특정 장소를 예언하는 뜻은 아니야.</p>
            </SpeechBalloon>

            <div className="mz-love-preview-sealed-grid" aria-label="본편에서 설명하는 관계 조건 후보">
              <article>
                <LockKeyhole size={17} aria-hidden="true" />
                <span>접점 환경 후보</span>
                <strong>조건과 근거 공개</strong>
              </article>
              <article>
                <LockKeyhole size={17} aria-hidden="true" />
                <span>활동 분야 후보</span>
                <strong>상징 · {specificity.professions[0].fieldLabel}</strong>
              </article>
              <article>
                <LockKeyhole size={17} aria-hidden="true" />
                <span>관계에서 확인할 신호</span>
                <strong>행동 기준 공개</strong>
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
            <SpeechBalloon speaker="MZ무당 · 12개월 흐름 미리보기">
              <p>절기 기준 다음 12개월을 비교해 대화·조율·거리두기에 상대적으로 유리한 조건을 나눴어.</p>
              <p>특정 년·월에 사건이 생긴다고 단정하지 않고, 각 구간에서 선택할 행동을 본편에 담았어.</p>
            </SpeechBalloon>
            <div className="mz-love-locked-clues">
              {[
                '인상 상징 후보와 실제 확인할 관계 신호',
                '생활·활동 분야 후보와 연락 리듬',
                '12개월 조건별 흐름과 30일 행동 계획'
              ].map((label) => (
                <span key={label}><LockKeyhole size={16} aria-hidden="true" /> {label}</span>
              ))}
            </div>
            <SpeechBalloon speaker="MZ무당" side="right">
              <p>미리보기 한 장면만으로 단정하지 마. 본편에는 <b>13개 웹툰 장</b>으로 근거와 반대 가능성까지 풀어뒀어.</p>
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
              <h2>상대의 속마음이나 미래를 단정하지 않을게.</h2>
              <p>인상·활동 환경·만남 장면은 상징 후보로, 12개월은 조건별 흐름으로 읽고 현실에서 확인할 행동까지 이어서 보여줄게.</p>
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
                <small>관계 상징 후보와 13개 본편까지</small>
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
