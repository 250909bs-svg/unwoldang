import { Check, CreditCard, Landmark, WalletCards, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { type IntakeFormData, findServiceById } from '../api/mockData';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import { buildAnalysisRequestPayload } from '../lib/analysisPayload';
import { getAiReportEndpoint } from '../lib/aiReport';
import {
  buildTossRedirectUrls,
  createCustomerKey,
  createOrderId,
  getPriceValue,
  readPendingPayment,
  savePendingPayment,
  type PaymentMethodType
} from '../lib/auth';
import { requestTossPayment, type TossPaymentMethod } from '../lib/tossPayments';

type CheckoutState = {
  product?: string;
  formData?: Partial<IntakeFormData>;
  tabOrigin?: string;
};

const paymentOptions: Array<{
  id: PaymentMethodType;
  label: string;
  icon: typeof WalletCards;
  tossMethod: TossPaymentMethod;
}> = [
  {
    id: 'toss',
    label: '토스페이먼츠',
    icon: WalletCards,
    tossMethod: 'CARD'
  },
  {
    id: 'card',
    label: '카드 결제',
    icon: CreditCard,
    tossMethod: 'CARD'
  },
  {
    id: 'bank',
    label: '계좌이체',
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
  const paymentMode = import.meta.env.VITE_PAYMENT_MODE ?? 'demo';
  const tossClientKey = import.meta.env.VITE_TOSSPAYMENTS_CLIENT_KEY?.trim();
  const confirmEndpoint = import.meta.env.VITE_TOSSPAYMENTS_CONFIRM_ENDPOINT?.trim();
  const isLiveHost = typeof window !== 'undefined' && /(^|\.)unwoldang\.com$/i.test(window.location.hostname);
  const isLiveMisconfigured = isLiveHost && paymentMode === 'demo';
  const isDemoPayment = paymentMode === 'demo' && !isLiveHost;
  const canUseTossRuntime = Boolean(tossClientKey && confirmEndpoint && !isDemoPayment);
  const hasRequiredBirthInfo = Boolean(formData?.name && formData?.birthDate && (formData?.birthTime || formData?.isUnknownTime));
  const hasTwoQuestions = analysisPayload.questions.length === 2;
  const reportReady = isDemoPayment || Boolean(getAiReportEndpoint());
  const paymentReady = !isLiveMisconfigured && (isDemoPayment || canUseTossRuntime);
  const canSubmit = Boolean(
    agreeService &&
      agreePrivacy &&
      !isSubmitting &&
      service &&
      amount > 0 &&
      hasRequiredBirthInfo &&
      hasTwoQuestions &&
      reportReady &&
      paymentReady
  );
  const activeOption = paymentOptions.find((option) => option.id === paymentMethod) ?? paymentOptions[0];
  const formattedAmount = amount.toLocaleString('ko-KR');
  const selectedTime = formData?.isUnknownTime ? '시간 미상' : formData?.birthTime || '시간 미입력';
  const birthSummary = `${formData?.birthDate || '생년월일 미입력'} · ${selectedTime}`;
  const calendarSummary =
    formData?.calendar === 'lunar' ? (formData?.isLeapMonth ? '음력 윤달' : '음력') : '양력';

  const handlePayment = async () => {
    if (!service) {
      setError('주문할 상품을 찾을 수 없습니다.');
      return;
    }

    if (!canSubmit) {
      setError(
        isLiveMisconfigured
          ? '운영 도메인에서는 데모 결제를 사용할 수 없습니다.'
          : !hasRequiredBirthInfo
            ? '사주 정보를 먼저 입력해 주세요.'
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
      setError('결제 설정을 확인해 주세요.');
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
      setError(caughtError instanceof Error ? caughtError.message : '결제창을 열지 못했습니다.');
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated || !service) {
    return null;
  }

  return (
    <main className="mobile-page-shell checkout-luxe-page">
      <div className="mobile-page-card checkout-luxe-card">
        <MobileTopBar title="운월당" backTo={`/form/${service.id}`} backLabel="이전" backState={{ tabOrigin }} />

        <section className="checkout-luxe-stage" aria-label="결제 상품 미리보기">
          <div className="checkout-luxe-copy">
            <span>잠들어 있던 내 운의 흐름</span>
            <strong>{formData?.name || '고객'}님의 사주 리포트</strong>
          </div>
          <div className="checkout-luxe-preview-row">
            <article className="checkout-luxe-preview-card slim">
              <img src="/intake-beauty-red.png" alt="" />
              <div>
                <span>질문 2개</span>
                <strong>맞춤 분석</strong>
              </div>
            </article>
            <article className="checkout-luxe-preview-card featured">
              <img src="/intake-night-blue.png" alt="" />
              <div>
                <span>운월당</span>
                <strong>{service.label}</strong>
                <p>내 사주 속 흐름을 정밀하게 읽는 프리미엄 감정서</p>
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
            <Link to={`/form/${service.id}`} state={{ formData, tabOrigin }} className="checkout-luxe-close" aria-label="입력 화면으로 돌아가기">
              <X size={18} />
            </Link>
          </div>

          <div className="checkout-luxe-benefit-pill">
            <span>혜택 적용</span>
            <strong>결제 후 결과를 바로 확인할 수 있어요</strong>
          </div>

          <div className="checkout-luxe-package-stack">
            <span className="checkout-luxe-label">선택 상품</span>
            <article className="checkout-luxe-package active">
              <span className="checkout-luxe-radio">
                <Check size={13} />
              </span>
              <div>
                <strong>{service.label}</strong>
                <p>성향, 재물, 직업, 연애·결혼, 대운·세운, 질문 2개 분석</p>
              </div>
              <b>{service.price}</b>
            </article>
            <article className="checkout-luxe-package disabled">
              <span className="checkout-luxe-radio" />
              <div>
                <strong>운월당 보관 패키지</strong>
                <p>결과 보관, 다시보기, 추가 질문 확장 기능 준비 중</p>
              </div>
              <b>준비중</b>
            </article>
          </div>

          <div className="checkout-luxe-price-box">
            <div>
              <span>상품 판매가</span>
              <strong>{service.price}</strong>
            </div>
            <div>
              <span>질문 맞춤 분석</span>
              <strong>포함</strong>
            </div>
            <div className="total">
              <span>최종 구매가</span>
              <strong>{formattedAmount}원</strong>
            </div>
          </div>

          <div className="checkout-luxe-payments">
            <span className="checkout-luxe-label">결제수단</span>
            {paymentOptions.map((option) => {
              const Icon = option.icon;

              return (
                <button
                  key={option.id}
                  type="button"
                  className={paymentMethod === option.id ? 'checkout-luxe-payment active' : 'checkout-luxe-payment'}
                  onClick={() => setPaymentMethod(option.id)}
                >
                  <Icon size={16} />
                  <strong>{option.label}</strong>
                </button>
              );
            })}
          </div>

          <label className="checkout-luxe-check">
            <input type="checkbox" checked={agreeService} onChange={(event) => setAgreeService(event.target.checked)} />
            <span>
              <Link to="/terms">이용약관</Link>에 동의합니다.
            </span>
          </label>

          <label className="checkout-luxe-check">
            <input type="checkbox" checked={agreePrivacy} onChange={(event) => setAgreePrivacy(event.target.checked)} />
            <span>
              <Link to="/privacy">개인정보처리방침</Link>에 동의합니다.
            </span>
          </label>

          {error ? <div className="checkout-luxe-error">{error}</div> : null}

          <button type="button" className="checkout-luxe-submit" onClick={handlePayment} disabled={!canSubmit}>
            {isSubmitting ? '처리 중' : `${activeOption.label} 결제`}
          </button>

          <p className="checkout-luxe-safe-copy">
            결제 진행 시 이용약관 및 개인정보처리방침에 동의한 것으로 처리되며, 결제 완료 후 입력한 사주정보 기준으로 결과가 생성됩니다.
          </p>
        </section>
      </div>
    </main>
  );
}
