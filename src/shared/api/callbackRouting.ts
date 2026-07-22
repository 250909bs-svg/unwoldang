export const buildHashCallbackLocation = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const { hash, search, pathname } = window.location;
  const params = new URLSearchParams(search);

  if (
    hash.startsWith('#/auth/kakao/callback') ||
    hash.startsWith('#/payment/portone/callback') ||
    pathname.startsWith('/auth/kakao/callback') ||
    pathname.startsWith('/payment/portone/callback')
  ) {
    return null;
  }

  if (
    params.has('paymentId') ||
    params.has('payment_id') ||
    params.has('txId') ||
    params.has('transactionId') ||
    params.get('payment')?.startsWith('portone-')
  ) {
    return `/payment/portone/callback${search}`;
  }

  if (params.has('code')) {
    return `/auth/kakao/callback${search}`;
  }

  return null;
};
