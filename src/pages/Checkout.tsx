import { Check, MessageCircle, WalletCards, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { type IntakeFormData, findServiceById } from '../api/mockData';
import MobileTopBar from '../components/MobileTopBar';
import { legalPages, type LegalPageKey } from '../content/legal';
import { useAuth } from '../context/AuthContext';
import {
  PaymentApiError,
  canRetryPaymentConfirmation,
  confirmPaymentSession,
  createPaymentOrder,
  isCancellationMessage,
  openPortOnePayment,
  readPaymentSession,
  updatePaymentSession,
  writePaymentSession
} from '../features/payments';
import type {
  PaymentOrderIntent,
  PaymentSession,
  PaymentUiPhase
} from '../features/payments/contracts';
import { buildAnalysisRequestPayload } from '../lib/analysisPayload';
import { getAiReportEndpoint } from '../lib/aiReport';
import { validateIntakeBirthInputs } from '../lib/birthInputValidation';
import { buildPortOneRedirectUrl, createOrderId } from '../lib/auth';
import {
  getPaymentMode,
  getPortOneConfirmEndpoint,
  hasPortOneRuntimeConfig,
  shouldUseDemoPayment
} from '../lib/runtimeConfig';
import { getProductById } from '../products/registry';

type CheckoutState = {
  product?: string;
  formData?: Partial<IntakeFormData>;
  tabOrigin?: string;
  draftOwnerId?: string;
};

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const restoredPayment = readPaymentSession(user?.id);
  const locationState = (location.state as CheckoutState | null) ?? null;
  const requestedProductId = locationState?.product || restoredPayment?.productId;
  const product = getProductById(requestedProductId)!;
  const ownsLocationDraft = !locationState?.draftOwnerId || locationState.draftOwnerId === user?.id;
  const formData = (ownsLocationDraft ? locationState?.formData : undefined) || restoredPayment?.formData;
  const tabOrigin = locationState?.tabOrigin || restoredPayment?.tabOrigin || '/';
  const draftOwnerId = user?.id;
  const service = findServiceById(product.id);
  const isPastLifeProduct = product.flow.intakeVariant === 'past-life';
  const isLoveReadingProduct = product.flow.intakeVariant === 'love-reading';
  const [agreeService, setAgreeService] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [legalModal, setLegalModal] = useState<Extract<LegalPageKey, 'terms' | 'privacy'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentPhase, setPaymentPhase] = useState<PaymentUiPhase>(
    canRetryPaymentConfirmation(restoredPayment) ? 'retryable' : 'idle'
  );
  const [serverAmount, setServerAmount] = useState<number | null>(
    restoredPayment?.status === 'created' || restoredPayment?.status === 'pending'
      ? restoredPayment.amount
      : null
  );
  const [nextOrderId, setNextOrderId] = useState(() => createOrderId());

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { returnTo: '/checkout' } });
    }
  }, [isAuthenticated, navigate]);

  const recoverableAmount =
    restoredPayment?.status === 'created' || restoredPayment?.status === 'pending'
      ? restoredPayment.amount
      : null;
  const amount = serverAmount ?? recoverableAmount ?? product.price;
  const analysisPayload = useMemo(
    () => buildAnalysisRequestPayload(product.id, formData || {}),
    [formData, product.id]
  );
  const portOneStoreId = import.meta.env.VITE_PORTONE_STORE_ID?.trim();
  const portOneChannelKey = import.meta.env.VITE_PORTONE_CHANNEL_KEY?.trim();
  const confirmEndpoint = getPortOneConfirmEndpoint();
  const customerPhone = import.meta.env.VITE_PORTONE_DEFAULT_PHONE_NUMBER?.trim() || undefined;
  const customerEmail = user?.email?.trim() || undefined;
  const paymentMode = getPaymentMode();
  const isDemoPayment = shouldUseDemoPayment();
  const canUsePortOneRuntime = Boolean(paymentMode === 'live' && hasPortOneRuntimeConfig());
  const requiresPartnerBirth = product.flow.requiresPartnerBirth;
  const birthInputValidation = useMemo(
    () => validateIntakeBirthInputs(formData || {}, { requirePartner: requiresPartnerBirth }),
    [formData, requiresPartnerBirth]
  );
  const hasRequiredBirthInfo = birthInputValidation.self.valid;
  const hasRequiredPartnerBirth = !requiresPartnerBirth || Boolean(birthInputValidation.partner?.valid);
  const hasTwoQuestions = analysisPayload.questions.length === 2;
  const reportReady = isDemoPayment || Boolean(getAiReportEndpoint());
  const paymentReady = isDemoPayment || (canUsePortOneRuntime && Boolean(user?.authToken));
  const canSubmit = Boolean(
    agreeService &&
      agreePrivacy &&
      !isSubmitting &&
      service &&
      amount > 0 &&
      hasRequiredBirthInfo &&
      hasRequiredPartnerBirth &&
      hasTwoQuestions &&
      reportReady &&
      paymentReady
  );
  const formattedAmount = amount.toLocaleString('ko-KR');
  const selectedTime = formData?.isUnknownTime ? '시간 미상' : formData?.birthTime || '시간 미입력';
  const birthSummary = `${formData?.birthDate || '생년월일 미입력'} · ${selectedTime}`;
  const calendarSummary =
    formData?.calendar === 'lunar' ? (formData?.isLeapMonth ? '음력 윤달' : '음력') : '양력';
  const activeLegalContent = legalModal ? legalPages[legalModal] : null;
  const activeLegalTitle =
    legalModal === 'terms' ? '운월당 서비스 이용약관' : legalModal === 'privacy' ? '운월당 개인정보처리방침' : '';
  const hasRetryableConfirmation = canRetryPaymentConfirmation(restoredPayment);
  const paymentStatusMessage =
    paymentPhase === 'creating-order'
      ? '서버 상품표에서 주문 금액과 판매 상태를 확인하고 있습니다.'
      : paymentPhase === 'opening-payment'
        ? 'PortOne 결제창을 열고 있습니다.'
        : paymentPhase === 'confirming'
          ? '승인된 결제를 서버에서 확인하고 있습니다. 창을 닫지 마세요.'
          : paymentPhase === 'success'
            ? '결제 확인이 완료되었습니다. 리포트로 이동합니다.'
            : paymentPhase === 'cancelled'
              ? '결제가 취소되었습니다. 승인된 금액은 없습니다.'
              : paymentPhase === 'retryable'
                ? '결제창을 다시 열지 않고 같은 결제의 승인 상태만 다시 확인할 수 있습니다.'
                : paymentPhase === 'failed'
                  ? '결제 또는 승인 확인에 실패했습니다. 안내를 확인해 주세요.'
                  : null;

  const handleEasyPayPreview = (label: string) => {
    setError(`${label}는 간편결제 심사 후 연결 예정입니다. 지금은 아래 일반 결제로 진행해 주세요.`);
  };

  const moveToPaidReport = (session: PaymentSession, confirmed: Awaited<ReturnType<typeof confirmPaymentSession>>) => {
    const paidSession = updatePaymentSession(session, 'paid', {
      paymentId: confirmed.paymentId,
      paymentKey: confirmed.paymentId,
      txId: confirmed.txId,
      orderClaim: undefined,
      entitlementId: confirmed.entitlement.id,
      entitlementStatus: confirmed.entitlement.status,
      reportAccessToken: confirmed.reportAccessToken,
      reportAccessTokenExpiresAt: confirmed.reportAccessTokenExpiresAt
    });

    setPaymentPhase('success');
    setError(null);
    navigate(product.routes.loading, {
      replace: true,
      state: {
        product: paidSession.productId,
        formData: paidSession.formData,
        paymentMethod: 'portone',
        orderId: paidSession.orderId,
        tabOrigin: paidSession.tabOrigin,
        reportAccessToken: paidSession.reportAccessToken
      }
    });
  };

  const confirmExistingPayment = async (session: PaymentSession) => {
    if (!confirmEndpoint || !user?.authToken) {
      setPaymentPhase('retryable');
      setError('결제창을 다시 열지 마세요. 로그인한 뒤 같은 결제의 승인 상태를 다시 확인해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setPaymentPhase('confirming');
    setError(null);

    try {
      const confirmed = await confirmPaymentSession({
        confirmEndpoint,
        authToken: user.authToken,
        session
      });
      moveToPaidReport(session, confirmed);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : '결제 승인 상태를 확인하지 못했습니다.';
      const isRetryable =
        caughtError instanceof PaymentApiError &&
        caughtError.retryable &&
        canRetryPaymentConfirmation(session);
      const retryHint =
        caughtError instanceof PaymentApiError && !caughtError.retryable
          ? ' 주문 정보가 일치하지 않으면 고객센터 확인이 필요합니다.'
          : '';

      if (isRetryable) {
        setPaymentPhase('retryable');
      } else {
        const terminalStatus = isCancellationMessage(message) ? 'cancelled' : 'failed';
        updatePaymentSession(session, terminalStatus);
        setPaymentPhase(terminalStatus);
      }
      setError(`결제창을 다시 열지 마세요. ${message}${retryHint}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (hasRetryableConfirmation && restoredPayment) {
      await confirmExistingPayment(restoredPayment);
      return;
    }

    if (!service) {
      setError('주문할 상품을 찾을 수 없습니다.');
      return;
    }

    if (!canSubmit) {
      setError(
        !hasRequiredBirthInfo
            ? birthInputValidation.self.errors[0]?.message || '사주 정보를 먼저 입력해 주세요.'
            : !hasRequiredPartnerBirth
              ? birthInputValidation.partner?.errors[0]?.message || '정밀 궁합을 위해 상대방의 생년월일과 출생 시각을 입력해 주세요.'
            : !hasTwoQuestions
              ? '질문 2개를 모두 입력해 주세요.'
              : !reportReady
                ? '분석 API 연결을 확인해 주세요.'
                : !paymentReady
                  ? '결제 설정을 확인해 주세요.'
                  : '필수 약관에 동의해 주세요.'
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    if (isDemoPayment) {
      const now = new Date().toISOString();
      writePaymentSession({
        schemaVersion: 1,
        ownerId: user?.id || 'development-demo',
        orderId: nextOrderId,
        productId: service.id,
        paymentMethod: 'portone',
        amount,
        currency: 'KRW',
        status: 'paid',
        customerKey: `uw.${nextOrderId.replace(/^UW-/, '').slice(-40)}`,
        formData,
        analysisPayload,
        tabOrigin,
        paymentId: nextOrderId,
        paymentKey: nextOrderId,
        createdAt: now,
        updatedAt: now,
        isDemo: true
      });
      navigate('/payment/portone/callback?payment=portone-success&mock=1', {
        replace: false
      });
      return;
    }

    if (!canUsePortOneRuntime || !portOneStoreId || !portOneChannelKey || !confirmEndpoint) {
      setError('결제 설정을 확인해 주세요.');
      setIsSubmitting(false);
      return;
    }

    if (!user?.authToken) {
      setError('안전한 결제 확인을 위해 카카오 로그인을 다시 진행해 주세요.');
      setIsSubmitting(false);
      return;
    }

    try {
      const reusableCreatedSession =
        restoredPayment?.status === 'created' &&
        restoredPayment.productId === service.id &&
        restoredPayment.orderClaim &&
        restoredPayment.orderClaimExpiresAt &&
        Date.parse(restoredPayment.orderClaimExpiresAt) > Date.now()
          ? restoredPayment
          : null;
      let orderIntent: PaymentOrderIntent;
      let createdSession: PaymentSession;

      if (reusableCreatedSession) {
        orderIntent = {
          orderId: reusableCreatedSession.orderId,
          productId: reusableCreatedSession.productId,
          amount: reusableCreatedSession.amount,
          currency: 'KRW',
          orderStatus: 'created',
          orderClaim: reusableCreatedSession.orderClaim!,
          orderClaimExpiresAt: reusableCreatedSession.orderClaimExpiresAt!
        };
        createdSession = reusableCreatedSession;
      } else {
        setPaymentPhase('creating-order');
        orderIntent = await createPaymentOrder({
          confirmEndpoint,
          authToken: user.authToken,
          orderId: nextOrderId,
          productId: service.id
        });
        const now = new Date().toISOString();
        createdSession = {
          schemaVersion: 1,
          ownerId: user.id,
          orderId: orderIntent.orderId,
          productId: orderIntent.productId,
          paymentMethod: 'portone',
          amount: orderIntent.amount,
          currency: orderIntent.currency,
          status: orderIntent.orderStatus,
          customerKey: `uw.${orderIntent.orderId.replace(/^UW-/, '').slice(-40)}`,
          formData,
          analysisPayload,
          tabOrigin,
          orderClaim: orderIntent.orderClaim,
          orderClaimExpiresAt: orderIntent.orderClaimExpiresAt,
          createdAt: now,
          updatedAt: now
        };
        writePaymentSession(createdSession);
        setServerAmount(orderIntent.amount);

        if (orderIntent.amount !== product.price) {
          setPaymentPhase('idle');
          setError(
            `서버 최종 가격은 ${orderIntent.amount.toLocaleString('ko-KR')}원입니다. 금액을 확인한 뒤 결제 버튼을 다시 눌러 주세요.`
          );
          setIsSubmitting(false);
          return;
        }
      }

      const pendingSession = updatePaymentSession(createdSession, 'pending', {
        paymentId: orderIntent.orderId
      });
      setPaymentPhase('opening-payment');

      const paymentResult = await openPortOnePayment({
        intent: orderIntent,
        storeId: portOneStoreId,
        channelKey: portOneChannelKey,
        orderName: service.label,
        customerId:
          createdSession.customerKey ||
          `uw.${orderIntent.orderId.replace(/^UW-/, '').slice(-40)}`,
        customerName: formData?.name || user?.nickname || '운월당 고객',
        customerEmail,
        customerPhone,
        redirectUrl: buildPortOneRedirectUrl()
      });

      if (paymentResult.kind === 'cancelled') {
        setError(`${paymentResult.message} 서버 결제 상태를 한 번 더 확인합니다.`);
        await confirmExistingPayment(pendingSession);
        return;
      }

      if (paymentResult.kind === 'failed') {
        setError(`${paymentResult.message} 중복 결제를 막기 위해 서버 상태를 확인합니다.`);
        await confirmExistingPayment(pendingSession);
        return;
      }

      if (paymentResult.paymentId !== orderIntent.orderId) {
        updatePaymentSession(pendingSession, 'failed');
        setPaymentPhase('failed');
        setError('PortOne 결제 ID가 서버 주문번호와 일치하지 않습니다. 고객센터 확인이 필요합니다.');
        setNextOrderId(createOrderId());
        setIsSubmitting(false);
        return;
      }

      const submittedSession = updatePaymentSession(pendingSession, 'pending', {
        paymentId: paymentResult.paymentId,
        txId: paymentResult.txId
      });
      await confirmExistingPayment(submittedSession);
    } catch (caughtError) {
      setPaymentPhase('failed');
      setError(caughtError instanceof Error ? caughtError.message : '서버 주문을 만들지 못했습니다.');
      setNextOrderId(createOrderId());
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main
      className={
        isPastLifeProduct
          ? 'mobile-page-shell checkout-luxe-page past-life-checkout-page'
          : isLoveReadingProduct
            ? 'mobile-page-shell checkout-luxe-page love-reading-checkout-page'
            : 'mobile-page-shell checkout-luxe-page'
      }
    >
      <div className="mobile-page-card checkout-luxe-card">
        <MobileTopBar title="운월당" backTo={product.routes.intake} backLabel="이전" backState={{ formData, tabOrigin, draftOwnerId }} />

        <section className="checkout-luxe-stage" aria-label="결제 상품 미리보기">
          <div className="checkout-luxe-copy">
            <span>
              {isPastLifeProduct
                ? '흑장부에 이름을 새기기 전'
                : isLoveReadingProduct
                  ? '붉은 실의 결말을 열기 전'
                  : '잠들어 있던 내 운의 흐름'}
            </span>
            <strong>
              {formData?.name || '고객'}님의 {isPastLifeProduct
                ? '전생장부'
                : isLoveReadingProduct
                  ? '연애 패턴 리포트'
                  : '사주 리포트'}
            </strong>
          </div>
          <div className="checkout-luxe-preview-row">
            <article className="checkout-luxe-preview-card slim">
              <img
                src={isPastLifeProduct
                  ? '/media/dokkaebi-poster.webp'
                  : isLoveReadingProduct
                    ? '/images/mz-love-fact/generated/hero-fan-closed.webp'
                    : '/intake-beauty-red.png'}
                alt={isLoveReadingProduct ? '접힌 부채를 들고 연애운 장부를 여는 MZ무당' : ''}
              />
              <div>
                <span>{isPastLifeProduct ? '다섯 권' : isLoveReadingProduct ? '13개 챕터' : '질문 2개'}</span>
                <strong>{isPastLifeProduct ? '26개 주제' : isLoveReadingProduct ? '맞춤 연애 분석' : '맞춤 분석'}</strong>
              </div>
            </article>
            <article className="checkout-luxe-preview-card featured">
              <img
                src={isPastLifeProduct
                  ? '/media/dokkaebi-poster.webp'
                  : isLoveReadingProduct
                    ? '/images/mz-love-fact/generated/room-consultation.webp'
                    : '/intake-night-blue.png'}
                alt={isLoveReadingProduct ? '붉은 촛불과 부채가 놓인 MZ무당 연애 상담실' : ''}
              />
              <div>
                <span>운월당</span>
                <strong>{service.label}</strong>
                <p>
                  {isPastLifeProduct
                    ? '전생의 상징을 현생의 행동으로 연결하는 개인 장부'
                    : isLoveReadingProduct
                      ? '끌림·관계 신호·12개월 흐름·30일 행동을 잇는 웹툰형 리포트'
                      : '내 사주 속 흐름을 정밀하게 읽는 프리미엄 감정서'}
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="checkout-luxe-sheet" aria-label="결제 안내">
          <div className="checkout-luxe-sheet-head">
            <div>
              <h1>{service.label} 결제 안내</h1>
              <p>{birthSummary} · {calendarSummary}</p>
            </div>
            <Link to={product.routes.intake} state={{ formData, tabOrigin, draftOwnerId }} className="checkout-luxe-close" aria-label="입력 화면으로 돌아가기">
              <X size={18} />
            </Link>
          </div>

          <div className="checkout-luxe-benefit-pill">
            <span>{isPastLifeProduct ? '개인 장부 구성' : isLoveReadingProduct ? '개인 리포트 구성' : '혜택 적용'}</span>
            <strong>
              {isPastLifeProduct
                ? '한 번 결제로 다섯 권 전체를 받아요'
                : isLoveReadingProduct
                  ? '결제 후 13개 연애 챕터 전체를 바로 열어요'
                  : '결제 후 결과를 바로 확인할 수 있어요'}
            </strong>
          </div>

          <div className="checkout-luxe-package-stack">
            <span className="checkout-luxe-label">선택 상품</span>
            <article className="checkout-luxe-package active">
              <span className="checkout-luxe-radio">
                <Check size={13} />
              </span>
              <div>
                <strong>{service.label}</strong>
                <p>
                  {isPastLifeProduct
                    ? '봉인록·인연록·업록·현생록·해원록, 30일 봉인 해제'
                    : isLoveReadingProduct
                      ? '연애 패턴, 끌림·장기 인연 비교, 관계 신호, 12개월 흐름, 30일 행동 플랜'
                      : '성향, 재물, 직업, 연애·결혼, 대운·세운, 질문 2개 분석'}
                </p>
              </div>
              <b>{service.price}</b>
            </article>
            {!isPastLifeProduct ? (
              <article className="checkout-luxe-package disabled">
                <span className="checkout-luxe-radio" />
                <div>
                  <strong>운월당 보관 패키지</strong>
                  <p>결과 보관, 다시보기, 추가 질문 확장 기능 준비 중</p>
                </div>
                <b>준비중</b>
              </article>
            ) : null}
          </div>

          <div className="checkout-luxe-price-box">
            <div>
              <span>상품 판매가</span>
              <strong>{service.price}</strong>
            </div>
            <div>
              <span>{isPastLifeProduct ? '다섯 권 26개 맞춤 해석' : isLoveReadingProduct ? '13개 맞춤 연애 챕터' : '질문 맞춤 분석'}</span>
              <strong>포함</strong>
            </div>
            <div className="total">
              <span>최종 구매가</span>
              <strong>{formattedAmount}원</strong>
            </div>
          </div>

          <div className="checkout-luxe-payments">
            <div className="checkout-luxe-pay-row">
              <button type="button" className="checkout-luxe-easy-pay kakao" onClick={() => handleEasyPayPreview('카카오페이')}>
                <MessageCircle size={16} fill="currentColor" />
                <strong>pay 결제</strong>
              </button>
              <button type="button" className="checkout-luxe-easy-pay naver" onClick={() => handleEasyPayPreview('네이버페이')}>
                <span>N</span>
                <strong>pay 결제</strong>
              </button>
            </div>
            <button
              type="button"
              className="checkout-luxe-general-pay"
              onClick={handlePayment}
              disabled={isSubmitting}
              aria-disabled={!canSubmit && !isSubmitting}
              aria-describedby='checkout-payment-status'
            >
              <WalletCards size={17} />
              <strong id='checkout-payment-status'>
                {isSubmitting
                  ? paymentPhase === 'confirming'
                    ? '결제 확인 중'
                    : '처리 중'
                  : hasRetryableConfirmation
                    ? '결제 확인 다시 시도'
                    : isDemoPayment
                      ? '일반 결제 데모'
                      : '일반 결제'}
              </strong>
            </button>
          </div>

          <label className="checkout-luxe-check">
            <input type="checkbox" checked={agreeService} onChange={(event) => setAgreeService(event.target.checked)} />
            <span>
              <button
                type="button"
                className="checkout-luxe-text-link"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setLegalModal('terms');
                }}
              >
                이용약관
              </button>
              에 동의합니다.
            </span>
          </label>

          <label className="checkout-luxe-check">
            <input type="checkbox" checked={agreePrivacy} onChange={(event) => setAgreePrivacy(event.target.checked)} />
            <span>
              <button
                type="button"
                className="checkout-luxe-text-link"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setLegalModal('privacy');
                }}
              >
                개인정보처리방침
              </button>
              에 동의합니다.
            </span>
          </label>

          <label className="checkout-luxe-check checkout-luxe-check-muted">
            <input type="checkbox" checked={agreeMarketing} onChange={(event) => setAgreeMarketing(event.target.checked)} />
            <span>마케팅 수신 동의 (선택)</span>
          </label>

          {error ? <div className="checkout-luxe-error">{error}</div> : null}

          <p className="checkout-luxe-safe-copy">
            {paymentStatusMessage ||
              (isDemoPayment
                ? '현재는 개발 전용 데모이며 실제 결제·실제 entitlement 없이 입력값 기준 리포트를 확인합니다.'
                : '서버가 현재 판매 상태와 최종 금액을 확인하고, 결제 완료 후에만 리포트 권한을 발급합니다.')}
          </p>
        </section>

        {activeLegalContent ? (
          <div className="checkout-legal-backdrop" role="presentation" onMouseDown={() => setLegalModal(null)}>
            <section
              className="checkout-legal-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkout-legal-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="checkout-legal-head">
                <div>
                  <h2 id="checkout-legal-title">{activeLegalTitle}</h2>
                  <p>{activeLegalContent.subtitle}</p>
                </div>
                <button type="button" className="checkout-legal-close" aria-label="닫기" onClick={() => setLegalModal(null)}>
                  <X size={18} />
                </button>
              </header>

              <div className="checkout-legal-body">
                {activeLegalContent.sections.map((section) => (
                  <article key={section.title} className="checkout-legal-section">
                    <h3>{section.title}</h3>
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </article>
                ))}
              </div>

              <footer className="checkout-legal-actions">
                <button type="button" onClick={() => setLegalModal(null)}>
                  확인
                </button>
              </footer>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
