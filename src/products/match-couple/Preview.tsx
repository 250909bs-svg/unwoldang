import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  LockKeyhole,
  MoonStar,
  Sparkles,
  UsersRound
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { buildMatchCoupleReportModel } from './analysis';
import coupleCoverAvif from './assets/couple-cover.avif';
import coupleCoverWebp from './assets/couple-cover.webp';
import coupleFrictionAvif from './assets/couple-friction.avif';
import coupleFrictionWebp from './assets/couple-friction.webp';
import coupleRitualAvif from './assets/couple-ritual.avif';
import coupleRitualWebp from './assets/couple-ritual.webp';
import {
  promoteMatchCoupleGuestDraft,
  resolveMatchCoupleDraft,
  saveMatchCoupleDraft
} from './draftStorage';
import { matchCoupleProduct } from './index';
import {
  hydrateMatchCoupleIntake,
  serializeMatchCoupleIntake,
  validateMatchCoupleIntake
} from './intakeModel';
import type {
  MatchCouplePersonFacts,
  MatchCoupleRelationGroupId,
  MatchCoupleStoredFormData
} from './types';

type PreviewLocationState = {
  formData?: Partial<MatchCoupleStoredFormData>;
  tabOrigin?: string;
  draftOwnerId?: string;
  recoveredEntitlement?: {
    orderId: string;
    reportAccessToken: string;
  };
};

type PreviewPerson = {
  name: string;
  dayMaster: string;
  dayMasterElement: string;
  hourStatus: string;
  hourUnknown: boolean;
};

export type MatchCouplePreviewTeaser = {
  names: [string, string];
  relationshipLabel: string;
  overviewLine: string;
  people: [PreviewPerson, PreviewPerson];
  relationPresence: Array<{
    id: MatchCoupleRelationGroupId;
    label: '합' | '충' | '형' | '파' | '해';
    present: boolean;
  }>;
  firstGuidance: {
    label: string;
    statement: string;
  };
};

export type MatchCouplePreviewResolution =
  | {
      ok: true;
      formData: MatchCoupleStoredFormData;
      teaser: MatchCouplePreviewTeaser;
    }
  | {
      ok: false;
      message: string;
    };

const LOCKED_DIMENSIONS = [
  '감정 표현',
  '연락·대화',
  '갈등 회복',
  '생활 습관',
  '소비·재물',
  '장기 관계 역할'
] as const;

const LOCKED_CHAPTERS = [
  '질문 2개 맞춤 답변',
  '조심할 말과 행동',
  '관계 유지 규칙',
  '30일 관계 실험'
] as const;

const DEFAULT_OVERVIEW = '두 사람의 공통점과 긴장 지점을 한쪽 결론으로 단정하지 않고 함께 읽었습니다.';
const DEFAULT_GUIDANCE = '두 명식의 안정적인 범위가 확인되면 끌림의 작동 방식을 전편에서 공개합니다.';

export const MATCH_COUPLE_GUEST_DRAFT_RETURN_TO = `${matchCoupleProduct.routes.preview}?draft=guest`;

export function isMatchCoupleGuestDraftReturn(search: string) {
  return new URLSearchParams(search).get('draft') === 'guest';
}

function firstValidationMessage(
  stepErrors: ReturnType<typeof validateMatchCoupleIntake>['stepErrors']
) {
  return ([1, 2, 3, 4] as const)
    .flatMap((step) => stepErrors[step])[0] || '두 사람의 입력 정보를 다시 확인해 주세요.';
}

function personTeaser(
  name: string,
  isUnknownTime: boolean,
  facts: MatchCouplePersonFacts | null
): PreviewPerson {
  const hourUnknown = isUnknownTime || !facts?.pillars.hour;
  return {
    name,
    dayMaster: facts?.dayMaster || '계산 유보',
    dayMasterElement: facts?.dayMasterElement ? `${facts.dayMasterElement} 기운` : '안정 범위 확인 필요',
    hourStatus: isUnknownTime
      ? '시주 미상 · 시간 의존 항목 제외'
      : facts?.pillars.hour
        ? '시주 확인됨'
        : '시주 계산 유보',
    hourUnknown
  };
}

/**
 * Builds a deliberately small presentation model. Raw questions, conflict
 * notes, detailed rules and the 30-day actions never cross this boundary.
 */
export function buildMatchCouplePreview(
  source?: Partial<MatchCoupleStoredFormData>
): MatchCouplePreviewResolution {
  if (!source) {
    return { ok: false, message: '저장된 궁합 입력을 찾지 못했습니다.' };
  }

  const intake = hydrateMatchCoupleIntake(source);
  const validation = validateMatchCoupleIntake(intake);
  if (!validation.valid) {
    return { ok: false, message: firstValidationMessage(validation.stepErrors) };
  }

  try {
    const formData = serializeMatchCoupleIntake(intake);
    const model = buildMatchCoupleReportModel(formData);
    const attraction = model.guidance?.attraction;

    return {
      ok: true,
      formData,
      teaser: {
        names: model.names,
        relationshipLabel: model.relationshipSummary,
        overviewLine: model.overview?.statement || DEFAULT_OVERVIEW,
        people: [
          personTeaser(model.names[0], intake.self.isUnknownTime, model.people[0]),
          personTeaser(model.names[1], intake.partner.isUnknownTime, model.people[1])
        ],
        relationPresence: model.relations.map((group) => ({
          id: group.id,
          label: group.label,
          present: group.items.length > 0
        })),
        firstGuidance: {
          label: attraction?.label || '끌림',
          statement: attraction?.statement || DEFAULT_GUIDANCE
        }
      }
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error
        ? error.message
        : '두 사람의 궁합 미리보기를 계산하지 못했습니다.'
    };
  }
}

export function getMatchCouplePreviewNextPath(
  isAuthenticated: boolean,
  hasRecoveredEntitlement: boolean
) {
  if (!isAuthenticated) return '/login';
  return hasRecoveredEntitlement ? matchCoupleProduct.routes.loading : matchCoupleProduct.routes.checkout;
}

function PreviewPicture({
  avif,
  webp,
  alt,
  eager = false,
  className = ''
}: {
  avif: string;
  webp: string;
  alt: string;
  eager?: boolean;
  className?: string;
}) {
  return (
    <picture className={`match-couple-preview-picture ${className}`.trim()}>
      <source srcSet={avif} type="image/avif" />
      <source srcSet={webp} type="image/webp" />
      <img
        src={webp}
        alt={alt}
        width={941}
        height={1672}
        loading={eager ? 'eager' : 'lazy'}
        {...(eager ? { fetchpriority: 'high' as const } : {})}
        decoding="async"
      />
    </picture>
  );
}

function StoryDivider({ label }: { label: string }) {
  return (
    <div className="match-couple-preview-divider" aria-hidden="true">
      <span>{label}</span>
      <ArrowDown size={17} />
    </div>
  );
}

export function MatchCouplePreviewStory({
  teaser,
  onEdit,
  onContinue
}: {
  teaser: MatchCouplePreviewTeaser;
  onEdit: () => void;
  onContinue: () => void;
}) {
  return (
    <main className="match-couple-preview-page">
      <nav className="match-couple-preview-topbar" aria-label="궁합 미리보기 메뉴">
        <button type="button" onClick={onEdit} aria-label="궁합 입력 수정하기">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <small>FREE WEBTOON PREVIEW</small>
          <strong>월연도령 사주궁합</strong>
        </div>
        <span aria-hidden="true"><MoonStar size={20} /></span>
      </nav>

      <section className="match-couple-preview-webtoon" aria-label={`${teaser.names.join('님과 ')}님의 궁합 웹툰 미리보기`}>
        <article className="match-couple-preview-panel match-couple-preview-panel--cover">
          <PreviewPicture
            avif={coupleCoverAvif}
            webp={coupleCoverWebp}
            alt="달빛 아래 서로를 바라보는 두 사람의 궁합 상담 장면"
            eager
            className="match-couple-preview-cover-art"
          />
          <span className="match-couple-preview-image-shade" aria-hidden="true" />
          <div className="match-couple-preview-cover-copy">
            <span className="match-couple-preview-kicker">PROLOGUE · 두 명식, 한 관계</span>
            <h1><b>{teaser.names[0]}</b><i>×</i><b>{teaser.names[1]}</b></h1>
            <p>{teaser.relationshipLabel}</p>
            <div className="match-couple-preview-scroll-cue" aria-hidden="true">
              <span>첫 장면 열기</span>
              <ArrowDown size={18} />
            </div>
          </div>
        </article>

        <StoryDivider label="CHAPTER 01" />

        <article className="match-couple-preview-panel match-couple-preview-panel--charts">
          <header className="match-couple-preview-panel-heading">
            <span>둘을 섞기 전에, 각자를 먼저 본다</span>
            <h2>두 사람의 중심 기운</h2>
          </header>
          <div className="match-couple-preview-person-grid">
            {teaser.people.map((person, index) => (
              <section key={`${person.name}-${index}`} className="match-couple-preview-person-card">
                <small>{index === 0 ? 'ME' : 'YOU'}</small>
                <h3>{person.name}</h3>
                <div className="match-couple-preview-day-master">
                  <span>{person.dayMaster}</span>
                  <strong>일간</strong>
                </div>
                <p>{person.dayMasterElement}</p>
                <div className={person.hourUnknown ? 'match-couple-preview-time is-unknown' : 'match-couple-preview-time'}>
                  <Clock3 size={15} aria-hidden="true" />
                  <span>{person.hourStatus}</span>
                </div>
              </section>
            ))}
          </div>
          <p className="match-couple-preview-method-note">
            <Check size={15} aria-hidden="true" />
            시간 미상일 때는 계산할 수 없는 시주 의존 항목을 억지로 채우지 않습니다.
          </p>
        </article>

        <StoryDivider label="CHAPTER 02" />

        <article className="match-couple-preview-panel match-couple-preview-panel--relations">
          <header className="match-couple-preview-panel-heading">
            <span>관계의 접점과 마찰</span>
            <h2>합·충·형·파·해 흔적</h2>
          </header>
          <div className="match-couple-preview-relation-orbit" aria-label="합충형파해 존재 여부">
            {teaser.relationPresence.map((relation) => (
              <div
                key={relation.id}
                className={relation.present ? 'match-couple-preview-relation is-present' : 'match-couple-preview-relation is-quiet'}
              >
                <strong>{relation.label}</strong>
                <span>{relation.present ? '존재' : '뚜렷하지 않음'}</span>
              </div>
            ))}
          </div>
          <p>존재 여부만 먼저 보여드립니다. 어떤 기둥이 만나고 어떻게 작동하는지는 전편에서 근거와 함께 풀이합니다.</p>
        </article>

        <StoryDivider label="CHAPTER 03" />

        <article className="match-couple-preview-panel match-couple-preview-panel--friction">
          <PreviewPicture
            avif={coupleFrictionAvif}
            webp={coupleFrictionWebp}
            alt="엇갈린 감정을 사이에 두고 대화를 고민하는 연인의 장면"
            className="match-couple-preview-friction-art"
          />
          <span className="match-couple-preview-image-shade" aria-hidden="true" />
          <div className="match-couple-preview-dialogue">
            <small>월연도령의 첫 관찰</small>
            <p>{teaser.overviewLine}</p>
          </div>
        </article>

        <StoryDivider label="CHAPTER 04" />

        <article className="match-couple-preview-panel match-couple-preview-panel--first-reading">
          <header className="match-couple-preview-panel-heading">
            <span>무료 공개 · 일곱 갈래 중 첫 번째</span>
            <h2>{teaser.firstGuidance.label}</h2>
          </header>
          <div className="match-couple-preview-first-guidance">
            <Sparkles size={24} aria-hidden="true" />
            <p>{teaser.firstGuidance.statement}</p>
          </div>
          <p className="match-couple-preview-method-note">
            확률 점수나 무작위 수치가 아닌, 두 명식에서 확인된 정성 근거로 읽습니다.
          </p>
        </article>

        <StoryDivider label="LOCKED CHAPTERS" />

        <article className="match-couple-preview-panel match-couple-preview-panel--vault">
          <PreviewPicture
            avif={coupleRitualAvif}
            webp={coupleRitualWebp}
            alt="두 사람의 관계 규칙을 달빛 아래 기록하는 의식 장면"
            className="match-couple-preview-ritual-art"
          />
          <span className="match-couple-preview-image-shade" aria-hidden="true" />
          <div className="match-couple-preview-vault-content">
            <LockKeyhole size={32} aria-hidden="true" />
            <span>PREMIUM RELATION MAP</span>
            <h2>관계를 실제로 움직이는 여섯 장</h2>
            <ol className="match-couple-preview-locked-dimensions">
              {LOCKED_DIMENSIONS.map((dimension, index) => (
                <li key={dimension}>
                  <span>{String(index + 2).padStart(2, '0')}</span>
                  <strong>{dimension}</strong>
                  <LockKeyhole size={15} aria-label="잠김" />
                </li>
              ))}
            </ol>
          </div>
        </article>

        <article className="match-couple-preview-panel match-couple-preview-panel--locked-toc">
          <header className="match-couple-preview-panel-heading">
            <span>전편 잠금 목차</span>
            <h2>읽고 끝나지 않는 관계 설계</h2>
          </header>
          <div className="match-couple-preview-locked-grid">
            {LOCKED_CHAPTERS.map((chapter, index) => (
              <section key={chapter}>
                <span>0{index + 1}</span>
                <LockKeyhole size={18} aria-hidden="true" />
                <h3>{chapter}</h3>
                <p>결제 후 개인 리포트에서 공개</p>
              </section>
            ))}
          </div>
        </article>

        <article className="match-couple-preview-panel match-couple-preview-panel--cta">
          <UsersRound size={34} aria-hidden="true" />
          <span>두 사람의 다음 장면은 선택할 수 있습니다</span>
          <h2>{teaser.names[0]}님과 {teaser.names[1]}님의<br />관계 지도를 끝까지 펼쳐볼까요?</h2>
          <p>결제 후 로딩을 거쳐 두 사람 비교형 독립 리포트가 생성됩니다.</p>
          <button type="button" className="match-couple-preview-primary-cta" onClick={onContinue}>
            <LockKeyhole size={18} aria-hidden="true" />
            {matchCoupleProduct.price.toLocaleString('ko-KR')}원 · 전편 열기
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="match-couple-preview-edit-cta" onClick={onEdit}>
            두 사람 입력 수정하기
          </button>
        </article>
      </section>
    </main>
  );
}

export default function MatchCouplePreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const locationState = (location.state as PreviewLocationState | null) ?? null;
  const tabOrigin = locationState?.tabOrigin || matchCoupleProduct.routes.detail;
  const preferGuestDraft = isMatchCoupleGuestDraftReturn(location.search);
  const source = useMemo(
    () => resolveMatchCoupleDraft({
      routeFormData: locationState?.formData,
      routeDraftOwnerId: locationState?.draftOwnerId,
      currentUserId: user?.id,
      preferGuest: preferGuestDraft
    }),
    [locationState?.draftOwnerId, locationState?.formData, preferGuestDraft, user?.id]
  );
  const preview = useMemo(() => buildMatchCouplePreview(source), [source]);

  useEffect(() => {
    document.title = '무료 웹툰 미리보기 | 월연도령 사주궁합';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.id && preview.ok) {
      if (preferGuestDraft) {
        promoteMatchCoupleGuestDraft(preview.formData, user.id);
      } else {
        saveMatchCoupleDraft(preview.formData, user.id);
      }
    }
  }, [isAuthenticated, preferGuestDraft, preview, user?.id]);

  const editForm = () => {
    navigate(matchCoupleProduct.routes.intake, {
      state: {
        formData: preview.ok ? preview.formData : source,
        tabOrigin,
        draftOwnerId: user?.id,
        recoveredEntitlement: locationState?.recoveredEntitlement
      }
    });
  };

  const continueFlow = () => {
    if (!preview.ok) return;

    if (!isAuthenticated) {
      saveMatchCoupleDraft(preview.formData);
      navigate('/login', {
        state: {
          returnTo: MATCH_COUPLE_GUEST_DRAFT_RETURN_TO,
          tabOrigin
        }
      });
      return;
    }

    if (locationState?.recoveredEntitlement) {
      navigate(matchCoupleProduct.routes.loading, {
        state: {
          product: matchCoupleProduct.id,
          formData: preview.formData,
          paymentMethod: 'portone',
          orderId: locationState.recoveredEntitlement.orderId,
          reportAccessToken: locationState.recoveredEntitlement.reportAccessToken,
          tabOrigin
        }
      });
      return;
    }

    navigate(matchCoupleProduct.routes.checkout, {
      state: {
        product: matchCoupleProduct.id,
        formData: preview.formData,
        tabOrigin,
        draftOwnerId: user?.id
      }
    });
  };

  if (!preview.ok) {
    return (
      <main className="match-couple-preview-page match-couple-preview-error" role="alert">
        <section className="match-couple-preview-error-card">
          <MoonStar size={34} aria-hidden="true" />
          <span>미리보기를 열기 전에</span>
          <h1>두 사람의 입력을 확인해 주세요</h1>
          <p>{preview.message}</p>
          <button type="button" onClick={editForm}>
            입력 화면으로 돌아가기
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </section>
      </main>
    );
  }

  return (
    <MatchCouplePreviewStory
      teaser={preview.teaser}
      onEdit={editForm}
      onContinue={continueFlow}
    />
  );
}
