import { ArrowLeft, ArrowRight, Check, LockKeyhole, Sparkles } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IntakeFormData, LoveFocus } from '../api/mockData';
import { useAuth } from '../context/AuthContext';
import { validateBirthInput } from '../lib/birthInputValidation';
import { buildMzLoveViewModel } from '../lib/mz-love-fact/viewModel';
import { mapIntakeRelationshipStatus } from '../lib/mz-love-fact/relationshipStatusAdapter';
import { getMzLoveScene } from '../lib/mz-love-fact/sceneManifest';
import { buildPartnerAppearanceProfile } from '../lib/mz-love-fact/partnerAppearance';
import {
  getPartnerInterestLabel,
  getPartnerPortraits,
  getPremiumLoveAnswers,
  SYMBOLIC_PARTNER_DISCLOSURE
} from '../lib/mz-love-fact/premiumLove';
import type { MzLoveChapterId, SceneArtwork } from '../lib/mz-love-fact/types';
import { buildSajuReport } from '../lib/saju/reportBuilder';
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

export default function LoveReadingPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
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

    window.scrollTo({ top: 0, behavior: 'instant' });
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
      <main className="mz-love-preview-page mz-love-preview-error">
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
  const whisperScene = getMzLoveScene('whisper-fact');
  const lockedScenes = [
    getMzLoveScene('first-meeting-scene'),
    getMzLoveScene('waiting-for-message'),
    getMzLoveScene('timing-rising-moon')
  ];
  const appearanceProfile = buildPartnerAppearanceProfile(report);
  const partnerPortraits = getPartnerPortraits(formData.interestedIn, appearanceProfile);
  const partnerInterestLabel = getPartnerInterestLabel(formData.interestedIn);
  const premiumAnswers = getPremiumLoveAnswers(report);
  const portraitEvidence = appearanceProfile.evidence
    .map((item) => `${item.label} ${item.value}`)
    .join(' · ');
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
    <main className="mz-love-preview-page">
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

      <section className="mz-love-preview-opening">
        <ScenePicture scene={openingScene} eager />
        <span className="mz-love-preview-opening-shade" aria-hidden="true" />
        <div className="mz-love-webtoon-bubble is-opening">
          <small>MZ무당</small>
          <p>왔네, {displayName}.<br />먼저 네 사주 원국부터 정확히 펼쳐볼게.</p>
        </div>
        <span className="mz-love-preview-scroll">아래로 내려서 원국 확인하기</span>
      </section>

      <section id="love-wonguk-preview" className="mz-love-wonguk-section">
        <div className="mz-love-section-heading">
          <span>命理 PREVIEW</span>
          <h1>{displayName}님의 사주 원국</h1>
          <p>생년월일과 출생시각을 만세력 엔진으로 계산한 기본 원국이에요.</p>
        </div>

        <article className="mz-love-wonguk-board" aria-label={`${displayName}님의 사주 원국`}>
          <header>
            <span>{report.birthLabel}</span>
            <strong>{report.zodiac}띠 · {report.dayMaster} 일간</strong>
          </header>
          <div className="mz-love-wonguk-pillars">
            {PILLARS.map((pillar) => {
              const value = report.pillars[pillar.key];
              const characters = value ? Array.from(value) : [];

              return (
                <section key={pillar.key} className={!value ? 'is-unknown' : undefined}>
                  <span>{pillar.label}</span>
                  {value ? (
                    <strong aria-label={`${pillar.label} ${value}`}>
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
            <span><Check size={14} aria-hidden="true" /> {precisionLabel}</span>
            <button type="button" onClick={editForm}>입력 수정</button>
          </footer>
        </article>

        <div className="mz-love-wonguk-tags">
          <span><small>나의 중심</small><strong>{report.dayMaster} · {report.dayMasterElement}</strong></span>
          <span><small>일간 세력</small><strong>{report.strengthLabel}</strong></span>
          <span><small>격국 참고</small><strong>{report.gyeokguk}</strong></span>
        </div>

        <article className="mz-love-element-card">
          <header>
            <span>오행 분포</span>
            <strong>목 · 화 · 토 · 금 · 수</strong>
          </header>
          <div>
            {report.fiveElements.map((item) => {
              const percentage = Math.round((item.value / elementTotal) * 100);
              return (
                <section key={item.label}>
                  <span>{item.label}</span>
                  <i><em style={{ width: `${Math.max(item.value ? 7 : 0, percentage)}%`, background: item.color }} /></i>
                  <strong>{percentage}%</strong>
                </section>
              );
            })}
          </div>
          <p>도움이 되는 기운 <b>{helpful}</b> · 과하면 조심할 기운 <b>{cautious}</b></p>
        </article>
      </section>

      <section id="love-webtoon-preview" className="mz-love-webtoon-section">
        <div className="mz-love-section-heading">
          <span>WEBTOON READING</span>
          <h2>이 원국, 연애에서는 어떻게 보일까?</h2>
          <p>계산값을 사람 말로 바꿔서, MZ무당이 먼저 두 장면만 보여줄게요.</p>
        </div>

        <article className="mz-love-webtoon-panel">
          <ScenePicture scene={whisperScene} />
          <span className="mz-love-webtoon-panel-shade" aria-hidden="true" />
          <div className="mz-love-webtoon-bubble">
            <small>MZ무당 · 원국 풀이</small>
            <p>{displayName}, 네 중심은 <b>{report.dayMaster} {report.dayMasterElement} 일간</b>이야. 지금 원국은 <b>{report.strengthLabel}</b> 흐름으로 읽혀.</p>
            <em>연애운은 한 글자만 보지 않고 오행 균형과 관계 상태를 함께 판단해.</em>
          </div>
        </article>

        {focusChapter?.scene ? (
          <article className="mz-love-webtoon-panel is-focus">
            <ScenePicture scene={focusChapter.scene} />
            <span className="mz-love-webtoon-panel-shade" aria-hidden="true" />
            <div className="mz-love-webtoon-bubble">
              <small>네가 고른 주제 · {FOCUS_LABELS[focus]}</small>
              <h3>{focusChapter.title}</h3>
              <p>{focusChapter.factBomb}</p>
              {focusChapter.characterLine !== focusChapter.factBomb ? (
                <em>{focusChapter.characterLine}</em>
              ) : focusChapter.interpretation !== focusChapter.factBomb ? (
                <em>{focusChapter.interpretation}</em>
              ) : null}
            </div>
          </article>
        ) : null}

        <section className="mz-love-partner-reveal" aria-labelledby="love-partner-reveal-title">
          <header>
            <span>SYMBOLIC PARTNER PORTRAIT</span>
            <h2 id="love-partner-reveal-title">{displayName}의 다음 인연상,<br />얼굴부터 먼저 보여줄게</h2>
            <p>{partnerInterestLabel}으로 표현한 명리 기반 창작 초상이에요.</p>
          </header>

          <div className={`mz-love-partner-portraits ${partnerPortraits.length > 1 ? 'is-pair' : ''}`}>
            {partnerPortraits.map((portrait) => (
              <article key={portrait.id}>
                <picture>
                  <source srcSet={portrait.avifSrc} type="image/avif" />
                  <img
                    src={portrait.src}
                    alt={portrait.alt}
                    width={portrait.width}
                    height={portrait.height}
                    loading="lazy"
                    decoding="async"
                  />
                </picture>
                <div>
                  <small>{portrait.label}</small>
                  <strong>{appearanceProfile.primaryArchetype.label}에 {appearanceProfile.secondaryArchetype.label}이 겹친 얼굴</strong>
                </div>
              </article>
            ))}
          </div>

          <article className="mz-love-appearance-signature">
            <span>FIRST IMPRESSION MIX</span>
            <h3>{appearanceProfile.primaryArchetype.label}<i>+</i>{appearanceProfile.secondaryArchetype.label}</h3>
            <p>{appearanceProfile.headline}</p>
          </article>

          <dl className="mz-love-appearance-traits" aria-label="다음 인연상 외모 세부 특징">
            {[
              ['키감', appearanceProfile.height],
              ['체형', appearanceProfile.build],
              ['얼굴형', appearanceProfile.faceShape],
              ['눈매', appearanceProfile.eyes],
              ['코선', appearanceProfile.nose],
              ['스타일', appearanceProfile.style]
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mz-love-partner-proof">
            <span>왜 이런 얼굴로 읽었을까?</span>
            <strong>{portraitEvidence}</strong>
            <p>배우자궁은 얼굴의 주 인상, 일간과 도움 오행은 키감·체형·피부·헤어, 상위 십성은 눈썹·표정·스타일의 보조 결로 번역했어요.</p>
          </div>
          <p className="mz-love-partner-disclosure">{SYMBOLIC_PARTNER_DISCLOSURE}</p>
        </section>

        <section className="mz-love-preview-answer-deck" aria-labelledby="love-answer-deck-title">
          <header>
            <span>PREMIUM ANSWER DECK</span>
            <h2 id="love-answer-deck-title">사람들이 진짜 궁금한 것부터<br />9개 질문으로 답할게</h2>
            <p>첫 세 가지는 지금 공개하고, 나머지는 13개 웹툰 본편에서 원국 근거와 함께 이어져요.</p>
          </header>
          <div>
            {premiumAnswers.map((answer, index) => (
              <article key={answer.id} className={index > 2 ? 'is-locked' : ''}>
                <small>{answer.eyebrow}</small>
                <h3>{answer.question}</h3>
                {index <= 2 ? <p>{answer.answer}</p> : (
                  <span><LockKeyhole size={15} aria-hidden="true" /> 본편에서 구체적으로 공개</span>
                )}
              </article>
            ))}
          </div>
        </section>

        <article className="mz-love-preview-boundary">
          <Sparkles size={19} aria-hidden="true" />
          <div>
            <strong>여기까지가 무료 원국 미리보기예요</strong>
            <p>본편에서는 원국·대운·세운, 현재 관계와 두 질문을 교차해 9개 핵심 답과 13개 웹툰 챕터로 이어집니다.</p>
          </div>
        </article>
      </section>

      <section className="mz-love-locked-preview">
        <div className="mz-love-section-heading">
          <span>FULL STORY</span>
          <h2>아직 잠겨 있는 다음 장면</h2>
        </div>
        <div>
          {lockedScenes.map((scene, index) => (
            <article key={scene.key}>
              <ScenePicture scene={scene} />
              <span aria-hidden="true" />
              <LockKeyhole size={20} aria-hidden="true" />
              <small>{['첫 만남이 열리는 장면', '연락과 밀당 패턴', '12개월 연애 타이밍'][index]}</small>
            </article>
          ))}
        </div>
      </section>

      {report.engineMeta?.uncertainty?.length ? (
        <aside className="mz-love-preview-uncertainty">
          <strong>계산 정확도 안내</strong>
          <p>{report.engineMeta.uncertainty[0]}</p>
        </aside>
      ) : null}

      <section className="mz-love-preview-cta">
        <span>사주 원국 확인 완료</span>
        <h2>이제 네 연애의 본편을 열어볼까?</h2>
        <p>입력한 정보와 두 질문은 다음 화면에 그대로 이어집니다.</p>
        <button type="button" onClick={continueToCheckout}>
          <Sparkles size={18} aria-hidden="true" />
          <strong>이 원국으로 팩폭 연애운 보기</strong>
          <ArrowRight size={21} aria-hidden="true" />
        </button>
        <button type="button" className="mz-love-preview-edit" onClick={editForm}>입력 정보 다시 보기</button>
      </section>
    </main>
  );
}
