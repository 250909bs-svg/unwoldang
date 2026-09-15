import { ArrowLeft, ArrowRight, Check, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { readReunionContext, type ReunionContext } from '../../lib/reunion';
import '../../styles/reunion.css';
import { readReunionDraft, writeReunionDraft } from './intakeStorage';
import ReunionPicture from './ReunionPicture';
import {
  REUNION_PATHS,
  REUNION_PRICE,
  breakupDurationLabels,
  buildReunionCheckoutState,
  contactStatusLabels,
  createReunionFormData,
  desiredOutcomeLabels,
  type ReunionRouteState
} from './reunionFlow';

const lockedSections = [
  '연락해도 되는 조건과 지금의 금지 행동',
  '명리 흐름에서 보는 관계 조율 구간',
  '오늘·7일·30일 행동 가이드',
  '재회 후 같은 이별을 막는 지속 조건'
] as const;

export default function ReunionPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const routeState = (location.state as ReunionRouteState | null) || null;
  const storedDraft = useMemo(
    () => readReunionDraft(user?.id) || readReunionDraft(),
    [user?.id]
  );
  const formData = useMemo(() => {
    if (routeState?.formData) return routeState.formData;
    if (!storedDraft?.draft) return null;

    try {
      return createReunionFormData(storedDraft.draft);
    } catch {
      return null;
    }
  }, [routeState?.formData, storedDraft]);
  const reunionContext = useMemo<ReunionContext | null>(
    () => routeState?.reunionContext || storedDraft?.context || readReunionContext(user?.id) || readReunionContext(),
    [routeState?.reunionContext, storedDraft?.context, user?.id]
  );

  useEffect(() => {
    if (!formData || !reunionContext) {
      navigate(REUNION_PATHS.intake, { replace: true, state: { tabOrigin: REUNION_PATHS.detail } });
    }
  }, [formData, navigate, reunionContext]);

  if (!formData || !reunionContext) return null;

  const continueToCheckout = () => {
    if (storedDraft?.draft) {
      writeReunionDraft(storedDraft.draft, user?.id, reunionContext);
    }

    const checkoutState = buildReunionCheckoutState(
      formData,
      reunionContext,
      user?.id,
      routeState?.tabOrigin || REUNION_PATHS.detail
    );

    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          returnTo: REUNION_PATHS.preview,
          ...checkoutState
        }
      });
      return;
    }

    if (routeState?.recoveredEntitlement) {
      navigate(REUNION_PATHS.loading, {
        state: {
          ...checkoutState,
          paymentMethod: 'portone',
          orderId: routeState.recoveredEntitlement.orderId,
          reportAccessToken: routeState.recoveredEntitlement.reportAccessToken
        }
      });
      return;
    }

    navigate(REUNION_PATHS.checkout, { state: checkoutState });
  };

  const editAnswers = () => {
    navigate(REUNION_PATHS.intake, {
      state: {
        ...routeState,
        formData,
        reunionContext
      } satisfies ReunionRouteState
    });
  };

  return (
    <main className="reunion-page reunion-preview-page">
      <header className="reunion-intake-header is-overlay">
        <button type="button" onClick={editAnswers} aria-label="입력 정보 수정하기">
          <ArrowLeft size={23} aria-hidden="true" />
        </button>
        <strong>무료 미리보기</strong>
        <span aria-hidden="true" />
      </header>

      <section className="reunion-preview-hero" aria-labelledby="reunion-preview-title">
        <ReunionPicture
          image="reflection"
          className="reunion-preview-picture"
          alt="관계를 돌아보며 다음 선택을 고민하는 사람"
          eager
        />
        <div className="reunion-preview-shade" aria-hidden="true" />
        <div className="reunion-preview-heading">
          <span>{formData.name}님과 {formData.partner?.name || '상대방'}님의 재회운</span>
          <h1 id="reunion-preview-title">다시 잇기 전에<br />먼저 확인할 두 가지</h1>
        </div>
      </section>

      <section className="reunion-preview-body">
        <article className="reunion-preview-facts" aria-labelledby="reunion-preview-facts-title">
          <span>입력한 현재 상황</span>
          <h2 id="reunion-preview-facts-title">추측하지 않고 여기서 시작해요</h2>
          <dl>
            <div>
              <dt>이별 후 기간</dt>
              <dd>{breakupDurationLabels[reunionContext.breakupDuration]}</dd>
            </div>
            <div>
              <dt>현재 연락</dt>
              <dd>{contactStatusLabels[reunionContext.contactStatus]}</dd>
            </div>
            <div>
              <dt>원하는 방향</dt>
              <dd>{desiredOutcomeLabels[reunionContext.desiredOutcome]}</dd>
            </div>
          </dl>
        </article>

        <article className="reunion-teaser-card">
          <div className="reunion-teaser-readable">
            <small>PREVIEW · 01</small>
            <h2>재회의 답은 감정의 크기보다<br />다음 행동의 조건에 있어요</h2>
            <p>
              지금 연락 상태가 <strong>{contactStatusLabels[reunionContext.contactStatus]}</strong>인 만큼,
              먼저 상대의 경계와 실제 응답을 확인하는 기준이 필요합니다.
            </p>
          </div>
          <div className="reunion-teaser-blur" aria-hidden="true">
            <p>두 사람의 명식에서 확인되는 관계 리듬과 현재 운의 흐름을 대조합니다.</p>
            <p>연락 시점은 특정 날짜의 보장이 아니라 실제 신호가 충족되는 조건으로 안내합니다.</p>
            <p>같은 이별을 반복하지 않기 위한 대화와 경계 기준을 정리합니다.</p>
          </div>
          <div className="reunion-teaser-lock">
            <LockKeyhole size={24} aria-hidden="true" />
            <strong>명리 근거와 행동 가이드는 본편에서 열려요</strong>
          </div>
        </article>

        <section className="reunion-unlock-card" aria-labelledby="reunion-unlock-title">
          <span>본편에서 확인할 내용</span>
          <h2 id="reunion-unlock-title">답을 기다리는 시간까지<br />내 편으로 만드는 리포트</h2>
          <ul>
            {lockedSections.map((item) => (
              <li key={item}>
                <Check size={17} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="reunion-primary-cta" onClick={continueToCheckout}>
            <span>
              <small>첫 공개가 · 1회 결제</small>
              <strong>{REUNION_PRICE.toLocaleString('ko-KR')}원으로 전체 리포트 보기</strong>
            </span>
            <ArrowRight size={20} aria-hidden="true" />
          </button>
          <div className="reunion-payment-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>{isAuthenticated ? '결제 전 주문 정보를 다시 확인할 수 있어요.' : '카카오 로그인 뒤 이 화면으로 돌아와 결제를 이어갑니다.'}</span>
          </div>
          <button type="button" className="reunion-text-button" onClick={editAnswers}>입력 정보 수정하기</button>
        </section>
      </section>
    </main>
  );
}
