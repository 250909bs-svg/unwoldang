import { CreditCard, Landmark, WalletCards } from 'lucide-react';
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
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="결제" backTo={`/form/${service.id}`} backLabel="이전" backState={{ tabOrigin }} />

        <section className="mobile-page-content with-floating-actions">
          <div className="mobile-hero-card intake-hero-card">
            <span className="mobile-chip">CHECKOUT</span>
            <h1>{service.label}</h1>
          </div>

          <div className="mobile-section-card mobile-order-summary">
            <article>
              <span>상품</span>
              <strong>{service.label}</strong>
            </article>
            <article>
              <span>결제금액</span>
              <strong>{service.price}</strong>
            </article>
          </div>

          <div className="mobile-section-card">
            <strong className="mobile-section-title">결제수단</strong>
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
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="mobile-check-row">
            <input type="checkbox" checked={agreeService} onChange={(event) => setAgreeService(event.target.checked)} />
            <span>
              <Link to="/terms" className="inline-text-link">
                이용약관
              </Link>
              에 동의합니다.
            </span>
          </label>

          <label className="mobile-check-row">
            <input type="checkbox" checked={agreePrivacy} onChange={(event) => setAgreePrivacy(event.target.checked)} />
            <span>
              <Link to="/privacy" className="inline-text-link">
                개인정보처리방침
              </Link>
              에 동의합니다.
            </span>
          </label>

          {error ? <div className="mobile-notice-box">{error}</div> : null}
        </section>

        <footer className="mobile-bottom-actions">
          <button type="button" className="app-black-button" onClick={handlePayment} disabled={!canSubmit}>
            {isSubmitting ? '처리 중' : isDemoPayment ? '결제하기' : '결제하기'}
          </button>
        </footer>
      </div>
    </main>
  );
}
