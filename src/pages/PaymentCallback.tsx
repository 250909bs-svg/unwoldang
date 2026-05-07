import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { readPendingPayment, type PendingPayment } from '../lib/auth';

type CallbackView = 'loading' | 'fail' | 'error';

function moveToResult(navigate: ReturnType<typeof useNavigate>, payment: PendingPayment) {
  navigate('/loading', {
    replace: true,
    state: {
      product: payment.productId,
      formData: payment.formData,
      paymentMethod: payment.paymentMethod,
      orderId: payment.orderId,
      tabOrigin: payment.tabOrigin
    }
  });
}

export default function PaymentCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<CallbackView>('loading');
  const [message, setMessage] = useState('토스 결제 결과를 확인하고 있습니다.');

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    const pendingPayment = readPendingPayment();
    const paymentFlag = params.get('payment');
    const isMock = params.get('mock') === '1';
    const isLiveHost = typeof window !== 'undefined' && /(^|\.)unwoldang\.com$/i.test(window.location.hostname);
    const paymentKey = params.get('paymentKey');
    const orderId = params.get('orderId');
    const amount = params.get('amount');
    const errorCode = params.get('code');
    const errorMessage = params.get('message');

    if (!pendingPayment) {
      setView('error');
      setMessage('진행 중인 주문 정보가 없습니다. 다시 주문 화면으로 이동해 주세요.');
      return;
    }

    if (paymentFlag === 'toss-fail' || errorCode) {
      setView('fail');
      setMessage(errorMessage || '토스 결제가 취소되었거나 실패했습니다.');
      return;
    }

    if (isMock) {
      if (isLiveHost) {
        setView('error');
        setMessage('실서비스 도메인에서는 데모 결제 결과를 사용할 수 없습니다. 토스 실결제 승인으로 다시 진행해 주세요.');
        return;
      }

      moveToResult(navigate, pendingPayment);
      return;
    }

    if (!paymentKey || !orderId || !amount) {
      setView('error');
      setMessage('토스 결제 승인 정보가 누락되었습니다. 다시 결제를 시도해 주세요.');
      return;
    }

    if (orderId !== pendingPayment.orderId) {
      setView('error');
      setMessage('주문번호가 일치하지 않습니다. 안전을 위해 결제를 중단했습니다.');
      return;
    }

    if (Number(amount) !== pendingPayment.amount) {
      setView('error');
      setMessage('결제 금액이 주문 정보와 다릅니다. 안전을 위해 결제를 중단했습니다.');
      return;
    }

    const confirmEndpoint = import.meta.env.VITE_TOSSPAYMENTS_CONFIRM_ENDPOINT?.trim();

    if (!confirmEndpoint) {
      setView('error');
      setMessage('토스 승인 API가 연결되지 않았습니다. 서버 설정을 먼저 확인해 주세요.');
      return;
    }

    const confirmPayment = async () => {
      try {
        const response = await fetch(confirmEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount)
          })
        });

        const parsed = (await response.json().catch(() => null)) as
          | { message?: string; paymentKey?: string }
          | null;

        if (!response.ok) {
          throw new Error(parsed?.message || '토스 결제 승인 요청이 실패했습니다.');
        }

        moveToResult(navigate, {
          ...pendingPayment,
          paymentKey: parsed?.paymentKey || paymentKey
        });
      } catch (caughtError) {
        setView('error');
        setMessage(caughtError instanceof Error ? caughtError.message : '결제 승인 처리 중 문제가 발생했습니다.');
      }
    };

    void confirmPayment();
  }, [navigate, params]);

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="결제 결과 확인" backTo="/checkout" backLabel="결제" />
        <section className="mobile-page-content centered">
          <div className="mobile-loading-card">
            <span className="mobile-chip">TOSS CALLBACK</span>
            <h1>{message}</h1>
            {view === 'loading' ? (
              <div className="progress-track">
                <span style={{ width: '82%' }} />
              </div>
            ) : (
              <div className="mobile-action-stack">
                <Link to="/checkout" className="app-muted-button">
                  주문 화면으로 돌아가기
                </Link>
                <Link to="/menu" className="app-black-button">
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
