const TOSS_SDK_URL = 'https://js.tosspayments.com/v2/standard';

export type TossPaymentMethod = 'CARD' | 'TRANSFER';

type TossRequestPaymentInput = {
  clientKey: string;
  customerKey: string;
  method: TossPaymentMethod;
  orderId: string;
  orderName: string;
  amount: number;
  successUrl: string;
  failUrl: string;
  customerName?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
};

type TossPaymentsFactory = (clientKey: string) => {
  payment: (options: { customerKey: string }) => {
    requestPayment: (request: Record<string, unknown>) => Promise<unknown>;
  };
};

declare global {
  interface Window {
    TossPayments?: TossPaymentsFactory;
  }
}

let sdkPromise: Promise<TossPaymentsFactory> | null = null;

export function loadTossPaymentsSdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('브라우저 환경에서만 토스 SDK를 불러올 수 있습니다.'));
  }

  if (window.TossPayments) {
    return Promise.resolve(window.TossPayments);
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise<TossPaymentsFactory>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TOSS_SDK_URL}"]`);

    if (existing) {
      existing.addEventListener('load', () => {
        if (window.TossPayments) {
          resolve(window.TossPayments);
        } else {
          reject(new Error('토스 SDK가 로드되었지만 사용할 수 없습니다.'));
        }
      });
      existing.addEventListener('error', () => reject(new Error('토스 SDK 로드에 실패했습니다.')));
      return;
    }

    const script = document.createElement('script');
    script.src = TOSS_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.TossPayments) {
        resolve(window.TossPayments);
      } else {
        reject(new Error('토스 SDK가 로드되었지만 사용할 수 없습니다.'));
      }
    };
    script.onerror = () => reject(new Error('토스 SDK 로드에 실패했습니다.'));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export async function requestTossPayment(input: TossRequestPaymentInput) {
  const TossPayments = await loadTossPaymentsSdk();
  const tossPayments = TossPayments(input.clientKey);
  const payment = tossPayments.payment({ customerKey: input.customerKey });

  const request: Record<string, unknown> = {
    method: input.method,
    amount: {
      currency: 'KRW',
      value: input.amount
    },
    orderId: input.orderId,
    orderName: input.orderName,
    successUrl: input.successUrl,
    failUrl: input.failUrl,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    metadata: input.metadata
  };

  if (input.method === 'CARD') {
    request.card = {
      useEscrow: false,
      flowMode: 'DEFAULT'
    };
  }

  if (input.method === 'TRANSFER') {
    request.transfer = {};
  }

  return payment.requestPayment(request);
}
