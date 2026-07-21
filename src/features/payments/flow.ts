export type PortOneCallbackResult =
  | { kind: 'submitted'; paymentId: string; txId?: string }
  | { kind: 'cancelled'; message: string }
  | { kind: 'failed'; message: string };

function firstParam(params: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function isCancellationMessage(value: string) {
  return /cancel|cancelled|canceled|취소|닫았|중단/i.test(value);
}

export function parsePortOneCallback(search: string): PortOneCallbackResult {
  const params = new URLSearchParams(search);
  const paymentId = firstParam(params, ['paymentId', 'payment_id', 'orderId']);
  const txId = firstParam(params, ['txId', 'tx_id', 'transactionId']);
  const paymentFlag = params.get('payment') || '';
  const errorCode = params.get('code') || params.get('errorCode') || '';
  const errorMessage = params.get('message') || params.get('errorMessage') || '';
  const failureContext = `${paymentFlag} ${errorCode} ${errorMessage}`;

  if (paymentFlag === 'portone-cancel' || isCancellationMessage(failureContext)) {
    return {
      kind: 'cancelled',
      message: errorMessage || '결제가 취소되었습니다. 승인된 금액은 없습니다.'
    };
  }

  if (paymentFlag === 'portone-fail' || errorCode) {
    return {
      kind: 'failed',
      message: errorMessage || '결제 승인에 실패했습니다. 결제 정보를 확인한 뒤 다시 시도해 주세요.'
    };
  }

  if (!paymentId) {
    return {
      kind: 'failed',
      message: 'PortOne 결제 ID가 전달되지 않아 결제 결과를 확인할 수 없습니다.'
    };
  }

  return { kind: 'submitted', paymentId, txId };
}
