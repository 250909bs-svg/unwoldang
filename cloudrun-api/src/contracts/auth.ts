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
  /** 상품 정가. 쿠폰과 무관하게 서버 상품 원장에서 온 값이다. */
  amount: number;
  /**
   * 실제로 청구할 금액. 쿠폰이 없으면 `amount` 와 같다.
   *
   * 이 값이 서명된 클레임에 들어가므로, 결제 확인 때 클라이언트를 믿지 않고도 "이 주문은
   * 얼마를 받기로 했는가" 를 알 수 있다. 쿠폰 도입 전에 발급된 클레임에는 없어서 선택 필드다.
   */
  payableAmount?: number;
  /** 선물 주문인가. 확정되면 리포트 대신 선물 코드가 나간다. */
  gift?: boolean;
  /** 적용된 쿠폰 코드. 결제가 확정되면 이 코드를 한 번 소모한다. */
  couponCode?: string;
  userBinding: string;
  version: 1;
  nonce: string;
};

export type AuthenticatedUser = {
  userId: string;
  nickname?: string;
  email?: string;
};
