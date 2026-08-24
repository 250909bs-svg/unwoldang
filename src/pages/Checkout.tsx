import { Check, MessageCircle, WalletCards, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { type IntakeFormData, findServiceById } from '../api/mockData';
import MobileTopBar from '../components/MobileTopBar';
import { legalPages, type LegalPageKey } from '../content/legal';
import { useAuth } from '../context/AuthContext';
import { buildAnalysisRequestPayload } from '../lib/analysisPayload';
import { getAiReportEndpoint } from '../lib/aiReport';
import { validateIntakeBirthInputs } from '../lib/birthInputValidation';
import { normalizeIntakeFormData } from '../lib/intakeDataContract';
import {
  buildPortOneRedirectUrl,
  confirmAuthenticatedPortOnePayment,
  createCustomerKey,
  createOrderId,
  readPendingPayment,
  requestPaymentOrderIntent,
  savePendingPayment
} from '../lib/auth';
import { requestPortOnePayment } from '../lib/portonePayments';
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
  const restoredPayment = readPendingPayment();
  const locationState = (location.state as CheckoutState | null) ?? null;
  const requestedProductId = locationState?.product || restoredPayment?.productId;
  const product = getProductById(requestedProductId)!;
  const ownsLocationDraft = !locationState?.draftOwnerId || locationState.draftOwnerId === user?.id;
  const formData = normalizeIntakeFormData(
    (ownsLocationDraft ? locationState?.formData : undefined) || restoredPayment?.formData
  );
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

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { returnTo: '/checkout' } });
    }
  }, [isAuthenticated, navigate]);

  const orderId = useMemo(() => createOrderId(), []);
  const amount = product.price;
  const customerKey = createCustomerKey(user?.id);
  const analysisPayload = useMemo(
    () => buildAnalysisRequestPayload(product.id, formData || {}),
    [formData, product.id]
  );
  const portOneStoreId = import.meta.env.VITE_PORTONE_STORE_ID?.trim();
  const portOneChannelKey = import.meta.env.VITE_PORTONE_CHANNEL_KEY?.trim();
  const confirmEndpoint = getPortOneConfirmEndpoint();
  const customerPhone = import.meta.env.VITE_PORTONE_DEFAULT_PHONE_NUMBER?.trim() || '01000000000';
  const customerEmail = user?.email || import.meta.env.VITE_PORTONE_DEFAULT_EMAIL?.trim() || 'customer@unwoldang.com';
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

  const handleEasyPayPreview = (label: string) => {
    setError(`${label}는 간편결제 심사 후 연결 예정입니다. 지금은 아래 일반 결제로 진행해 주세요.`);
  };

  const handlePayment = async () => {
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

    const pendingPayment = {
      orderId,
      productId: service.id,
      paymentMethod: 'portone',
      amount,
      customerKey,
      formData,
      analysisPayload,
      tabOrigin,
      createdAt: new Date().toISOString()
    } as const;

    setIsSubmitting(true);
    setError(null);

    if (isDemoPayment) {
      savePendingPayment(pendingPayment);
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
      const orderIntent = await requestPaymentOrderIntent({
        confirmEndpoint,
        authToken: user.authToken,
        orderId,
        productId: service.id,
        amount
      });
      const authenticatedPendingPayment = {
        ...pendingPayment,
        orderId: orderIntent.orderId,
        orderClaim: orderIntent.orderClaim
      };
      savePendingPayment(authenticatedPendingPayment);

      const paymentResponse = await requestPortOnePayment({
        storeId: portOneStoreId,
        channelKey: portOneChannelKey,
        paymentId: orderIntent.orderId,
        orderName: service.label,
        totalAmount: amount,
        customerId: customerKey,
        customerName: formData?.name || user?.nickname || '운월당 고객',
        customerEmail,
        customerPhone,
        redirectUrl: buildPortOneRedirectUrl(),
        customData: {
          productId: service.id,
          paymentMethod: 'portone',
          orderClaim: orderIntent.orderClaim
        }
      });

      if (!paymentResponse) {
        setError('결제창이 닫혔습니다. 결제를 다시 시도해 주세요.');
        setIsSubmitting(false);
        return;
      }

      const confirmed = await confirmAuthenticatedPortOnePayment({
        confirmEndpoint,
        authToken: user.authToken,
        paymentId: paymentResponse.paymentId || orderIntent.orderId,
        txId: paymentResponse.txId,
        orderId: orderIntent.orderId,
        amount,
        productId: service.id,
        orderClaim: orderIntent.orderClaim
      });

      savePendingPayment({
        ...authenticatedPendingPayment,
        paymentKey: confirmed.paymentId,
        txId: confirmed.txId,
        reportAccessToken: confirmed.reportAccessToken
      });

      navigate(product.routes.loading, {
        replace: true,
        state: {
          product: service.id,
          formData,
          paymentMethod: 'portone',
          orderId: confirmed.orderId,
          tabOrigin,
          reportAccessToken: confirmed.reportAccessToken
        }
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '결제창을 열지 못했습니다.');
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
            >
              <WalletCards size={17} />
              <strong>{isSubmitting ? '처리 중' : isDemoPayment ? '일반 결제 데모' : '일반 결제'}</strong>
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
            {isDemoPayment
              ? '현재는 결제사 연동 전 데모 결제로 진행되며, 실제 결제 승인 없이 입력한 사주정보 기준 리포트를 확인할 수 있습니다.'
              : '결제 진행 시 이용약관 및 개인정보처리방침에 동의한 것으로 처리되며, 결제 완료 후 입력한 사주정보 기준으로 결과가 생성됩니다.'}
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
