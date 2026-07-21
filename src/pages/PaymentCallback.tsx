import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import {
  PaymentApiError,
  canRetryPaymentConfirmation,
  confirmPaymentSession,
  isCancellationMessage,
  parsePortOneCallback,
  readPaymentSession,
  updatePaymentSession,
  type PortOneCallbackResult
} from '../features/payments';
import type { PaymentSession, PaymentUiPhase } from '../features/payments/contracts';
import { getPortOneConfirmEndpoint, shouldUseDemoPayment } from '../lib/runtimeConfig';

function moveToResult(navigate: ReturnType<typeof useNavigate>, payment: PaymentSession) {
  navigate('/loading', {
    replace: true,
    state: {
      product: payment.productId,
      formData: payment.formData,
      paymentMethod: payment.paymentMethod,
      orderId: payment.orderId,
      tabOrigin: payment.tabOrigin,
      reportAccessToken: payment.reportAccessToken
    }
  });
}

export default function PaymentCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirmationInFlightRef = useRef(false);
  const navigationTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<PaymentUiPhase>('confirming');
  const [message, setMessage] = useState('PortOne 결제 결과를 서버에서 확인하고 있습니다.');
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    const scheduleResult = (payment: PaymentSession) => {
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
      navigationTimerRef.current = window.setTimeout(() => moveToResult(navigate, payment), 600);
    };
    const pendingPayment = readPaymentSession(user?.id);
    const isMock = new URLSearchParams(location.search).get('mock') === '1';

    if (!user) {
      setPhase('retryable');
      setMessage('결제 확인을 계속하려면 로그인 상태를 복구한 뒤 다시 시도해 주세요.');
      return;
    }

    if (!pendingPayment) {
      setPhase('failed');
      setMessage(
        '이 로그인 계정에 결합된 진행 중 주문이 없습니다. 재결제하지 말고 결제 내역을 먼저 확인해 주세요.'
      );
      return;
    }

    if (pendingPayment.status === 'paid' && pendingPayment.reportAccessToken) {
      setPhase('success');
      setMessage('이미 확인된 결제입니다. 같은 리포트 권한으로 이동합니다.');
      scheduleResult(pendingPayment);
      return;
    }

    if (isMock) {
      if (!shouldUseDemoPayment() || !pendingPayment.isDemo) {
        setPhase('failed');
        setMessage('실결제 모드에서는 개발 전용 데모 결제 결과를 사용할 수 없습니다.');
        return;
      }

      setPhase('success');
      setMessage('개발 전용 데모 흐름을 확인했습니다. 실제 결제나 entitlement는 생성되지 않았습니다.');
      scheduleResult(pendingPayment);
      return;
    }

    let callbackResult: PortOneCallbackResult = parsePortOneCallback(location.search);

    if (
      callbackResult.kind === 'failed' &&
      pendingPayment.paymentId &&
      /결제 ID가 전달되지 않아/.test(callbackResult.message)
    ) {
      callbackResult = {
        kind: 'submitted',
        paymentId: pendingPayment.paymentId,
        txId: pendingPayment.txId
      };
    }

    if (callbackResult.kind !== 'submitted') {
      callbackResult = {
        kind: 'submitted',
        paymentId: pendingPayment.paymentId || pendingPayment.orderId,
        txId: pendingPayment.txId
      };
    }

    if (callbackResult.paymentId !== pendingPayment.orderId) {
      setPhase('failed');
      setMessage('주문번호가 일치하지 않아 결제를 중단했습니다. 재결제하지 말고 고객센터에 확인해 주세요.');
      return;
    }

    const confirmEndpoint = getPortOneConfirmEndpoint();

    if (!confirmEndpoint || !user.authToken || !pendingPayment.orderClaim) {
      setPhase('retryable');
      setMessage('결제창을 다시 열지 마세요. 로그인과 서버 설정을 복구한 뒤 같은 결제를 다시 확인해 주세요.');
      return;
    }

    const confirmingPayment = updatePaymentSession(pendingPayment, 'pending', {
      paymentId: callbackResult.paymentId,
      txId: callbackResult.txId || pendingPayment.txId
    });

    if (confirmationInFlightRef.current) {
      return;
    }

    confirmationInFlightRef.current = true;
    setPhase('confirming');
    setMessage('PortOne 승인 내역과 서버 주문 금액을 대조하고 있습니다.');

    const confirm = async () => {
      try {
        const confirmed = await confirmPaymentSession({
          confirmEndpoint,
          authToken: user.authToken as string,
          session: confirmingPayment
        });
        const paidPayment = updatePaymentSession(confirmingPayment, 'paid', {
          paymentId: confirmed.paymentId,
          paymentKey: confirmed.paymentId,
          txId: confirmed.txId,
          orderClaim: undefined,
          entitlementId: confirmed.entitlement.id,
          entitlementStatus: confirmed.entitlement.status,
          reportAccessToken: confirmed.reportAccessToken,
          reportAccessTokenExpiresAt: confirmed.reportAccessTokenExpiresAt
        });

        setPhase('success');
        setMessage('결제 확인이 완료되었습니다. 같은 entitlement로 리포트를 엽니다.');
        scheduleResult(paidPayment);
      } catch (caughtError) {
        const detail =
          caughtError instanceof Error ? caughtError.message : '결제 승인 상태를 확인하지 못했습니다.';
        const isRetryable =
          caughtError instanceof PaymentApiError &&
          caughtError.retryable &&
          canRetryPaymentConfirmation(confirmingPayment);
        const retryCopy =
          caughtError instanceof PaymentApiError && !caughtError.retryable
            ? ' 주문 정보가 일치하지 않으면 고객센터 확인이 필요합니다.'
            : '';

        if (isRetryable) {
          setPhase('retryable');
        } else {
          const terminalStatus = isCancellationMessage(detail) ? 'cancelled' : 'failed';
          updatePaymentSession(confirmingPayment, terminalStatus);
          setPhase(terminalStatus);
        }
        setMessage(`결제창을 다시 열지 마세요. ${detail}${retryCopy}`);
      } finally {
        confirmationInFlightRef.current = false;
      }
    };

    void confirm();

    return () => {
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
        navigationTimerRef.current = null;
      }
    };
  }, [location.search, navigate, retryAttempt, user?.authToken, user?.id]);

  const isWorking = phase === 'confirming' || phase === 'success';

  return (
    <main className='mobile-page-shell'>
      <div className='mobile-page-card'>
        <MobileTopBar title='결제 결과 확인' backTo='/checkout' backLabel='결제' />
        <section className='mobile-page-content centered'>
          <div className='mobile-loading-card'>
            <span className='mobile-chip'>PORTONE KG이니시스</span>
            <h1 role='status' aria-live='polite'>
              {message}
            </h1>
            {isWorking ? (
              <div className='progress-track'>
                <span style={{ width: phase === 'success' ? '100%' : '82%' }} />
              </div>
            ) : (
              <div className='mobile-action-stack'>
                {phase === 'retryable' ? (
                  <button
                    type='button'
                    className='app-black-button'
                    disabled={confirmationInFlightRef.current}
                    onClick={() => setRetryAttempt((attempt) => attempt + 1)}
                  >
                    같은 결제 확인 다시 시도
                  </button>
                ) : (
                  <Link to='/checkout' className='app-black-button'>
                    {phase === 'cancelled' ? '주문 화면으로 돌아가기' : '결제 상태 다시 확인하기'}
                  </Link>
                )}
                <Link to='/menu' className='app-muted-button'>
                  카테고리 다시 보기
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
