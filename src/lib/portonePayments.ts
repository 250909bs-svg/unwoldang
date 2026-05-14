const PORTONE_SDK_URL = 'https://cdn.portone.io/v2/browser-sdk.js';

type PortOnePaymentResponse = {
  code?: string;
  message?: string;
  paymentId?: string;
  txId?: string;
};

type PortOneRequestPaymentInput = {
  storeId: string;
  channelKey: string;
  paymentId: string;
  orderName: string;
  totalAmount: number;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  redirectUrl: string;
  customData?: Record<string, unknown>;
};

type PortOneBrowserSdk = {
  requestPayment: (request: Record<string, unknown>) => Promise<PortOnePaymentResponse | undefined>;
};

declare global {
  interface Window {
    PortOne?: PortOneBrowserSdk;
  }
}

let sdkPromise: Promise<PortOneBrowserSdk> | null = null;

export function loadPortOneSdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('브라우저 환경에서만 PortOne 결제를 사용할 수 있습니다.'));
  }

  if (window.PortOne) {
    return Promise.resolve(window.PortOne);
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise<PortOneBrowserSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PORTONE_SDK_URL}"]`);

    const resolveLoadedSdk = () => {
      if (window.PortOne) {
        resolve(window.PortOne);
      } else {
        reject(new Error('PortOne SDK가 로드되었지만 사용할 수 없습니다.'));
      }
    };

    if (existing) {
      existing.addEventListener('load', resolveLoadedSdk);
      existing.addEventListener('error', () => reject(new Error('PortOne SDK 로드에 실패했습니다.')));
      return;
    }

    const script = document.createElement('script');
    script.src = PORTONE_SDK_URL;
    script.async = true;
    script.onload = resolveLoadedSdk;
    script.onerror = () => reject(new Error('PortOne SDK 로드에 실패했습니다.'));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export async function requestPortOnePayment(input: PortOneRequestPaymentInput) {
  const PortOne = await loadPortOneSdk();
  const response = await PortOne.requestPayment({
    storeId: input.storeId,
    channelKey: input.channelKey,
    paymentId: input.paymentId,
    orderName: input.orderName,
    totalAmount: input.totalAmount,
    currency: 'CURRENCY_KRW',
    payMethod: 'CARD',
    customer: {
      customerId: input.customerId,
      fullName: input.customerName,
      email: input.customerEmail,
      phoneNumber: input.customerPhone
    },
    windowType: {
      pc: 'IFRAME',
      mobile: 'REDIRECTION'
    },
    redirectUrl: input.redirectUrl,
    locale: 'KO_KR',
    products: [
      {
        id: input.paymentId,
        name: input.orderName,
        amount: input.totalAmount,
        quantity: 1,
        tag: 'DIGITAL'
      }
    ],
    customData: input.customData
  });

  if (response?.code) {
    throw new Error(response.message || 'PortOne 결제가 취소되었거나 실패했습니다.');
  }

  return response;
}
