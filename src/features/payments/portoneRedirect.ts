export const buildPortOneRedirectUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return `${window.location.origin}/payment/portone/callback`;
};
