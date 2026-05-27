import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { readPendingPayment, savePendingPayment, type PendingPayment } from '../lib/auth';
import { getPortOneConfirmEndpoint, shouldUseDemoPayment } from '../lib/runtimeConfig';

type CallbackView = 'loading' | 'fail' | 'error';

function moveToResult(navigate: ReturnType<typeof useNavigate>, payment: PendingPayment) {
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

function getFirstParam(params: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = params.get(key);

    if (value) {
      return value;
    }
  }

  return null;
}

export default function PaymentCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<CallbackView>('loading');
  const [message, setMessage] = useState('PortOne KG이니시스 결제 결과를 확인하고 있습니다.');

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    const pendingPayment = readPendingPayment();
    const paymentFlag = params.get('payment');
    const isMock = params.get('mock') === '1';
    const allowMockPayment = shouldUseDemoPayment();
    const paymentId = getFirstParam(params, ['paymentId', 'payment_id', 'orderId']);
    const txId = getFirstParam(params, ['txId', 'tx_id', 'transactionId']);
    const errorCode = params.get('code') || params.get('errorCode');
    const errorMessage = params.get('message') || params.get('errorMessage');

    if (!pendingPayment) {
      setView('error');
      setMessage('진행 중인 주문 정보가 없습니다. 다시 주문 화면에서 결제를 시도해 주세요.');
      return;
    }

    if (paymentFlag === 'portone-fail' || errorCode) {
      setView('fail');
      setMessage(errorMessage || '결제가 취소되었거나 실패했습니다. 다시 결제해 주세요.');
      return;
    }

    if (isMock) {
      if (!allowMockPayment) {
        setView('error');
        setMessage('실결제 모드에서는 데모 결제 결과를 사용할 수 없습니다. 실제 결제로 다시 진행해 주세요.');
        return;
      }

      savePendingPayment({
        ...pendingPayment,
        paymentMethod: 'portone',
        paymentKey: pendingPayment.orderId
      });
      moveToResult(navigate, { ...pendingPayment, paymentMethod: 'portone' });
      return;
    }

    if (!paymentId) {
      setView('error');
      setMessage('PortOne 결제 ID가 전달되지 않았습니다. 다시 결제를 시도해 주세요.');
      return;
    }

    if (paymentId !== pendingPayment.orderId) {
      setView('error');
      setMessage('주문번호가 일치하지 않아 결제를 중단했습니다. 고객센터 확인이 필요합니다.');
      return;
    }

    const confirmEndpoint = getPortOneConfirmEndpoint();

    if (!confirmEndpoint) {
      setView('error');
      setMessage('PortOne 결제 검증 API가 연결되지 않았습니다. 서버 설정을 먼저 확인해 주세요.');
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
            paymentId,
            txId,
            orderId: pendingPayment.orderId,
            amount: pendingPayment.amount,
            productId: pendingPayment.productId
          })
        });

        const parsed = (await response.json().catch(() => null)) as
          | { message?: string; paymentId?: string; txId?: string; reportAccessToken?: string }
          | null;

        if (!response.ok) {
          throw new Error(parsed?.message || 'PortOne KG이니시스 결제 검증에 실패했습니다.');
        }

        const confirmedPayment = {
          ...pendingPayment,
          paymentMethod: 'portone',
          paymentKey: parsed?.paymentId || paymentId,
          txId: parsed?.txId || txId || undefined,
          reportAccessToken: parsed?.reportAccessToken
        } satisfies PendingPayment;
        savePendingPayment(confirmedPayment);
        moveToResult(navigate, confirmedPayment);
      } catch (caughtError) {
        setView('error');
        setMessage(caughtError instanceof Error ? caughtError.message : '결제 검증 처리 중 문제가 발생했습니다.');
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
            <span className="mobile-chip">PORTONE KG이니시스</span>
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
