export type AccessTokenPurpose = 'order' | 'report' | 'user' | 'admin';

export type ReportAccessClaims = {
  orderId: string;
  paymentId: string;
  productId: string;
  amount: number;
  userBinding: string;
  entitlementId: string;
};

export type PaymentOrderClaims = {
  orderId: string;
  productId: string;
  amount: number;
  userBinding: string;
  version: 1;
  nonce: string;
};

export type AuthenticatedUser = {
  userId: string;
  nickname?: string;
  email?: string;
};
