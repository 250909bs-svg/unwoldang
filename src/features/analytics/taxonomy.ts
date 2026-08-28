import type { ProductId } from '../../products/types';

/**
 * Public analytics contract. Keep this list explicit: downstream providers and
 * warehouse models must never receive an event name that is not reviewed here.
 */
export const ANALYTICS_EVENT_NAMES = [
  'home_view',
  'product_impression',
  'product_click',
  'detail_view',
  'form_start',
  'form_step',
  'form_complete',
  'login_start',
  'login_success',
  'login_fail',
  'checkout_view',
  'payment_start',
  'payment_success',
  'payment_fail',
  'payment_cancel',
  'report_start',
  'report_success',
  'report_fail',
  'report_view',
  'report_share'
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const PRODUCT_ANALYTICS_EVENT_NAMES = [
  'product_impression',
  'product_click',
  'detail_view',
  'form_start',
  'form_step',
  'form_complete',
  'checkout_view',
  'payment_start',
  'payment_success',
  'payment_fail',
  'payment_cancel',
  'report_start',
  'report_success',
  'report_fail',
  'report_view',
  'report_share'
] as const satisfies readonly AnalyticsEventName[];

export type ProductAnalyticsEventName = (typeof PRODUCT_ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_PLACEMENTS = [
  'home',
  'menu',
  'search',
  'recommendation',
  'report',
  'navigation',
  'unknown'
] as const;
export type AnalyticsPlacement = (typeof ANALYTICS_PLACEMENTS)[number];

export const LOGIN_METHODS = ['email', 'kakao', 'google', 'naver', 'unknown'] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

export const PAYMENT_METHODS = ['card', 'easy_pay', 'transfer', 'virtual_account', 'unknown'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const REPORT_SHARE_TARGETS = ['native', 'clipboard', 'download', 'unknown'] as const;
export type ReportShareTarget = (typeof REPORT_SHARE_TARGETS)[number];

export interface EmptyAnalyticsPayload {}

export interface ProductAnalyticsPayload {
  productId: ProductId;
}

export interface ProductDiscoveryPayload extends ProductAnalyticsPayload {
  placement?: AnalyticsPlacement;
  position?: number;
}

export interface FormStepPayload extends ProductAnalyticsPayload {
  step: number;
  totalSteps?: number;
}

export interface LoginPayload {
  method?: LoginMethod;
}

export interface LoginFailPayload extends LoginPayload {
  reasonCode?: string;
}

export interface PaymentPayload extends ProductAnalyticsPayload {
  method?: PaymentMethod;
}

export interface PaymentFailurePayload extends PaymentPayload {
  reasonCode?: string;
}

export interface ReportFailurePayload extends ProductAnalyticsPayload {
  reasonCode?: string;
}

export interface ReportSharePayload extends ProductAnalyticsPayload {
  target?: ReportShareTarget;
}

export interface AnalyticsEventPayloadMap {
  home_view: EmptyAnalyticsPayload;
  product_impression: ProductDiscoveryPayload;
  product_click: ProductDiscoveryPayload;
  detail_view: ProductAnalyticsPayload;
  form_start: ProductAnalyticsPayload;
  form_step: FormStepPayload;
  form_complete: ProductAnalyticsPayload;
  login_start: LoginPayload;
  login_success: LoginPayload;
  login_fail: LoginFailPayload;
  checkout_view: ProductAnalyticsPayload;
  payment_start: PaymentPayload;
  payment_success: PaymentPayload;
  payment_fail: PaymentFailurePayload;
  payment_cancel: PaymentFailurePayload;
  report_start: ProductAnalyticsPayload;
  report_success: ProductAnalyticsPayload;
  report_fail: ReportFailurePayload;
  report_view: ProductAnalyticsPayload;
  report_share: ReportSharePayload;
}

export type AnalyticsEventPayload<EventName extends AnalyticsEventName> =
  AnalyticsEventPayloadMap[EventName];

const analyticsEventNameSet = new Set<string>(ANALYTICS_EVENT_NAMES);
const productAnalyticsEventNameSet = new Set<string>(PRODUCT_ANALYTICS_EVENT_NAMES);

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === 'string' && analyticsEventNameSet.has(value);
}

export function isProductAnalyticsEventName(
  value: AnalyticsEventName
): value is ProductAnalyticsEventName {
  return productAnalyticsEventNameSet.has(value);
}
