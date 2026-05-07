import { CreditCard, Landmark, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { type IntakeFormData, findServiceById } from '../api/mockData';
import MobileTopBar from '../components/MobileTopBar';
import { siteBusinessInfo } from '../content/legal';
import { useAuth } from '../context/AuthContext';
import { buildAnalysisRequestPayload } from '../lib/analysisPayload';
import {
  buildTossRedirectUrls,
  createCustomerKey,
  createOrderId,
  getPriceValue,
  readPendingPayment,
  savePendingPayment,
  type PaymentMethodType
} from '../lib/auth';
import { getAiReportEndpoint } from '../lib/aiReport';
import { requestTossPayment, type TossPaymentMethod } from '../lib/tossPayments';

type CheckoutState = {
  product?: string;
  formData?: Partial<IntakeFormData>;
  tabOrigin?: string;
};

const paymentOptions: Array<{
  id: PaymentMethodType;
  label: string;
  summary: string;
  icon: typeof WalletCards;
  tossMethod: TossPaymentMethod;
}> = [
  {
    id: 'toss',
    label: '토스페이먼츠 기본 결제',
    summary: '카드, 간편결제 중심으로 가장 빠르게 오픈하기 좋은 기본 결제 흐름입니다.',
    icon: WalletCards,
    tossMethod: 'CARD'
  },
  {
    id: 'card',
    label: '카드 결제',
    summary: '카드 전용 결제로 집중해서 테스트하거나 노출할 때 사용하기 좋습니다.',
    icon: CreditCard,
    tossMethod: 'CARD'
  },
  {
    id: 'bank',
    label: '계좌이체',
    summary: '즉시 이체 중심 결제를 열고 싶을 때 사용하는 흐름입니다.',
    icon: Landmark,
    tossMethod: 'TRANSFER'
  }
];

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const restoredPayment = readPendingPayment();
  const locationState = (location.state as CheckoutState | null) ?? null;
  const product = locationState?.product || restoredPayment?.productId;
  const formData = locationState?.formData || restoredPayment?.formData;
  const tabOrigin = locationState?.tabOrigin || restoredPayment?.tabOrigin || '/';
  const service = findServiceById(product);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('toss');
  const [agreeService, setAgreeService] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { returnTo: '/checkout' } });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!product && isAuthenticated) {
      navigate('/menu', { replace: true });
    }
  }, [isAuthenticated, navigate, product]);

  const orderId = useMemo(() => createOrderId(), []);
  const amount = getPriceValue(service?.price || '0');
  const customerKey = createCustomerKey(user?.id);
  const analysisPayload = useMemo(
    () => buildAnalysisRequestPayload(service?.id || 'general-signature', formData || {}),
    [formData, service?.id]
  );
  const calendarLabel =
    formData?.calendar === 'lunar' ? (formData?.isLeapMonth ? '음력(윤달)' : '음력') : '양력';
  const timeLabel = formData?.isUnknownTime ? '시간 모름' : formData?.birthTime || '미선택';
  const reportEndpoint = getAiReportEndpoint();
  const hasAiEndpoint = Boolean(reportEndpoint);
  const paymentMode = import.meta.env.VITE_PAYMENT_MODE ?? 'demo';
  const tossClientKey = import.meta.env.VITE_TOSSPAYMENTS_CLIENT_KEY?.trim();
  const confirmEndpoint = import.meta.env.VITE_TOSSPAYMENTS_CONFIRM_ENDPOINT?.trim();
  const isLiveHost = typeof window !== 'undefined' && /(^|\.)unwoldang\.com$/i.test(window.location.hostname);
  const isLiveMisconfigured = isLiveHost && paymentMode === 'demo';
  const isDemoPayment = paymentMode === 'demo' && !isLiveHost;
  const canUseTossRuntime = Boolean(tossClientKey && confirmEndpoint && !isDemoPayment);
  const hasRequiredBirthInfo = Boolean(formData?.name && formData?.birthDate && (formData?.birthTime || formData?.isUnknownTime));
  const hasTwoQuestions = analysisPayload.questions.length === 2;
  const paymentReady = !isLiveMisconfigured && (isDemoPayment || canUseTossRuntime);
  const canSubmit = Boolean(
    agreeService &&
      agreePrivacy &&
      !isSubmitting &&
      service &&
      amount > 0 &&
      hasRequiredBirthInfo &&
      hasTwoQuestions &&
      hasAiEndpoint &&
      paymentReady
  );
  const activeOption = paymentOptions.find((option) => option.id === paymentMethod) ?? paymentOptions[0];

  const readinessItems = [
    {
      label: '기본 사주 정보 확인',
      done: hasRequiredBirthInfo
    },
    { label: '질문 2개 입력 완료', done: hasTwoQuestions },
    { label: 'AI 결과 API 준비', done: hasAiEndpoint },
    {
      label: isLiveMisconfigured ? '실서비스 결제 설정 필요' : isDemoPayment ? '결제 데모 모드' : '토스 실결제 설정',
      done: paymentReady
    }
  ];

  const handlePayment = async () => {
    if (!service) {
      setError('주문할 상품 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
      return;
    }

    if (!canSubmit) {
      setError(
        isLiveMisconfigured
          ? '실서비스 도메인에서는 결제 데모 모드를 사용할 수 없습니다. 토스 실결제 환경변수를 먼저 연결해 주세요.'
          : !hasRequiredBirthInfo
            ? '이름, 생년월일, 태어난 시간을 먼저 입력해 주세요.'
            : !hasTwoQuestions
              ? '질문 2개를 모두 입력해야 프리미엄 리포트를 생성할 수 있습니다.'
              : !hasAiEndpoint
                ? 'AI 결과 API가 연결되지 않았습니다. 운영 설정을 먼저 확인해 주세요.'
                : !paymentReady
                  ? '토스 결제 설정이 아직 완성되지 않았습니다. 클라이언트 키와 승인 API를 연결해 주세요.'
                  : '이용약관과 개인정보처리방침에 동의해야 결제를 진행할 수 있습니다.'
      );
      return;
    }

    const pendingPayment = {
      orderId,
      productId: service.id,
      paymentMethod,
      amount,
      customerKey,
      formData,
      analysisPayload,
      tabOrigin,
      createdAt: new Date().toISOString()
    } as const;

    savePendingPayment(pendingPayment);
    setIsSubmitting(true);
    setError(null);

    if (isDemoPayment) {
      navigate('/payment/toss/callback?payment=toss-success&mock=1', {
        replace: false
      });
      return;
    }

    if (!canUseTossRuntime || !tossClientKey || !confirmEndpoint) {
      setError('토스 결제 설정이 아직 완성되지 않았습니다. 클라이언트 키와 승인 API를 먼저 연결해 주세요.');
      setIsSubmitting(false);
      return;
    }

    const redirectUrls = buildTossRedirectUrls();

    try {
      await requestTossPayment({
        clientKey: tossClientKey,
        customerKey,
        method: activeOption.tossMethod,
        orderId,
        orderName: service.label,
        amount,
        successUrl: redirectUrls.successUrl,
        failUrl: redirectUrls.failUrl,
        customerName: formData?.name || user?.nickname || '운월당 고객',
        customerEmail: user?.email,
        metadata: {
          productId: service.id,
          paymentMethod
        }
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '토스 결제창을 열지 못했습니다.');
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated || !service) {
    return null;
  }

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="결제 준비" backTo={`/form/${service.id}`} backLabel="입력" backState={{ tabOrigin }} />

        <section className="mobile-page-content with-floating-actions">
          <div className="mobile-hero-card intake-hero-card">
            <span className="mobile-chip">{isDemoPayment ? 'PAYMENT DEMO' : 'TOSS PAYMENTS READY'}</span>
            <h1>{service.label}</h1>
            <p>
              결제 직전에 주문 정보, 사주 입력값, 질문 2개를 마지막으로 확인하는 단계입니다. 결제가 끝나면 로딩 화면을 거쳐
              결과 리포트가 생성됩니다.
            </p>

            <div className="checkout-hero-chips">
              <span>주문번호 자동 생성</span>
              <span>질문 2개 반영</span>
              <span>{hasAiEndpoint ? 'AI 분석 API 연결' : 'AI API 연결 대기'}</span>
            </div>
          </div>

          <div className="mobile-section-card mobile-order-summary">
            <article>
              <span>주문자</span>
              <strong>{user?.nickname || '운월당 회원'}</strong>
            </article>
            <article>
              <span>주문번호</span>
              <strong>{orderId}</strong>
            </article>
            <article>
              <span>결제금액</span>
              <strong>{service.price}</strong>
            </article>
          </div>

          <div className="mobile-section-card checkout-readiness-card">
            <strong className="mobile-section-title">오픈 체크 포인트</strong>
            <div className="checkout-readiness-list">
              {readinessItems.map((item) => (
                <article key={item.label} className={item.done ? 'checkout-readiness-item done' : 'checkout-readiness-item'}>
                  <span>{item.done ? '완료' : '대기'}</span>
                  <strong>{item.label}</strong>
                </article>
              ))}
            </div>
          </div>

          <div className="mobile-section-card">
            <strong className="mobile-section-title">결제 수단 선택</strong>
            <div className="mobile-option-list">
              {paymentOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={paymentMethod === option.id ? 'mobile-option-card active' : 'mobile-option-card'}
                    onClick={() => setPaymentMethod(option.id)}
                  >
                    <span className="mobile-option-icon">
                      <Icon size={16} />
                    </span>
                    <div>
                      <strong>{option.label}</strong>
                      <p>{option.summary}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="intake-summary-card">
            <div className="intake-section-head">
              <span className="mobile-inline-label">
                <Sparkles size={14} />
                입력 정보 요약
              </span>
              <p>결제 전에 고객이 입력한 사주 정보와 질문 2개를 한 번 더 정리해서 보여줍니다.</p>
            </div>

            <div className="intake-keyvalue-list">
              <article>
                <span>이름</span>
                <strong>{formData?.name || '미입력'}</strong>
              </article>
              <article>
                <span>생년월일</span>
                <strong>
                  {formData?.birthDate || '미입력'} / {calendarLabel}
                </strong>
              </article>
              <article>
                <span>태어난 시간</span>
                <strong>{timeLabel}</strong>
              </article>
              <article>
                <span>질문 1</span>
                <strong>{formData?.q1 || '미입력'}</strong>
              </article>
              <article>
                <span>질문 2</span>
                <strong>{formData?.q2 || '미입력'}</strong>
              </article>
            </div>
          </div>

          <div className="intake-summary-card checkout-analysis-card">
            <div className="intake-section-head">
              <span className="mobile-inline-label">
                <ShieldCheck size={14} />
                결제 후 제공 안내
              </span>
              <p>결제가 완료되면 입력한 사주 정보와 질문 2개를 기준으로 프리미엄 리포트가 생성됩니다.</p>
            </div>

            <div className="intake-keyvalue-list">
              <article>
                <span>결제 승인</span>
                <strong>{isDemoPayment ? '데모 결제 확인' : '토스페이먼츠 서버 승인'}</strong>
              </article>
              <article>
                <span>분석 방식</span>
                <strong>만세력 검증 + AI 맞춤 해석</strong>
              </article>
              <article>
                <span>결과 보관</span>
                <strong>마이페이지 다시보기 저장</strong>
              </article>
              <article>
                <span>주문 확인</span>
                <strong>주문번호 기준 고객센터 확인 가능</strong>
              </article>
            </div>

            <div className="intake-preview-pills">
              <span className="intake-preview-pill">주문 상태 저장</span>
              <span className="intake-preview-pill">토스 성공/실패 콜백</span>
              <span className="intake-preview-pill">{hasAiEndpoint ? 'AI 결과 생성 준비' : 'AI API 연결 필요'}</span>
            </div>
          </div>

          <label className="mobile-check-row">
            <input type="checkbox" checked={agreeService} onChange={(event) => setAgreeService(event.target.checked)} />
            <span>
              <Link to="/terms" className="inline-text-link">
                이용약관
              </Link>{' '}
              및 주문 진행에 동의합니다. (필수)
            </span>
          </label>

          <label className="mobile-check-row">
            <input type="checkbox" checked={agreePrivacy} onChange={(event) => setAgreePrivacy(event.target.checked)} />
            <span>
              <Link to="/privacy" className="inline-text-link">
                개인정보처리방침
              </Link>{' '}
              에 따른 개인정보 이용에 동의합니다. (필수)
            </span>
          </label>

          <div className="mobile-notice-box with-icon-row">
            <ShieldCheck size={16} />
            <span>
              {isDemoPayment
                ? '현재는 데모 결제 모드입니다. 실제 토스 결제를 붙이려면 클라이언트 키와 승인 API를 함께 넣어 주세요.'
                : '현재 설정으로는 토스 결제창 호출과 성공/실패 콜백 처리가 가능합니다. 승인 API 응답까지 정상이어야 결과 생성으로 넘어갑니다.'}
            </span>
          </div>

          <div className="mobile-notice-box legal-inline-box">
            <strong>오픈 전 마지막 확인</strong>
            <span>
              환불 기준은{' '}
              <Link to="/refund" className="inline-text-link">
                환불정책
              </Link>
              에서 확인할 수 있고, footer의 사업자 정보와 정책 문구가 실제 운영 정보와 일치하는지 꼭 확인해 주세요.
            </span>
            <span>
              현재 설정값은 대표 {siteBusinessInfo.representative} / 사업자등록번호 {siteBusinessInfo.businessRegistrationNumber}
              입니다.
            </span>
          </div>

          {error ? <div className="mobile-notice-box">{error}</div> : null}
        </section>

        <footer className="mobile-bottom-actions">
          <button type="button" className="app-black-button" onClick={handlePayment} disabled={!canSubmit}>
            {isDemoPayment ? '데모 결제로 결과 보기' : '토스 결제 진행하기'}
          </button>
        </footer>
      </div>
    </main>
  );
}
