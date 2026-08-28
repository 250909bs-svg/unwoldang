import { getProductById } from '../../products/registry';
import type { ProductId, ProductStatus } from '../../products/types';
import { readSessionAttribution, type SessionAttribution } from './attribution';
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_PLACEMENTS,
  LOGIN_METHODS,
  PAYMENT_METHODS,
  REPORT_SHARE_TARGETS,
  isAnalyticsEventName,
  isProductAnalyticsEventName,
  type AnalyticsEventName,
  type AnalyticsEventPayload,
  type AnalyticsEventPayloadMap,
  type AnalyticsPlacement,
  type LoginMethod,
  type PaymentMethod,
  type ProductAnalyticsEventName,
  type ReportShareTarget
} from './taxonomy';

export interface AnalyticsProductContext {
  productId: ProductId;
  name: string;
  price: number;
  currency: 'KRW';
  status: ProductStatus;
}

type EventSpecificProviderPayload<EventName extends AnalyticsEventName> = Omit<
  AnalyticsEventPayloadMap[EventName],
  'productId'
> &
  (EventName extends ProductAnalyticsEventName ? AnalyticsProductContext : Record<never, never>);

export type AnalyticsProviderPayload<EventName extends AnalyticsEventName = AnalyticsEventName> =
  Readonly<
    EventSpecificProviderPayload<EventName> & {
      attribution?: Readonly<SessionAttribution>;
    }
  >;

export type AnalyticsTrack = (
  eventName: AnalyticsEventName,
  payload: AnalyticsProviderPayload
) => void | Promise<void>;

export interface AnalyticsProvider {
  track: AnalyticsTrack;
}

export interface AnalyticsConfiguration {
  provider?: AnalyticsProvider | AnalyticsTrack | null;
}

export interface AnalyticsLifecycleOptions {
  /** Internal lifecycle identity. This value is never copied to provider payloads. */
  dedupeKey?: string;
}

export const NOOP_ANALYTICS_PROVIDER: Readonly<AnalyticsProvider> = Object.freeze({
  track: () => undefined
});

export const ANALYTICS_EVENT_FIELD_WHITELISTS = Object.freeze({
  home_view: [],
  product_impression: ['productId', 'placement', 'position'],
  product_click: ['productId', 'placement', 'position'],
  detail_view: ['productId'],
  form_start: ['productId'],
  form_step: ['productId', 'step', 'totalSteps'],
  form_complete: ['productId'],
  login_start: ['method'],
  login_success: ['method'],
  login_fail: ['method', 'reasonCode'],
  checkout_view: ['productId'],
  payment_start: ['productId', 'method'],
  payment_success: ['productId', 'method'],
  payment_fail: ['productId', 'method', 'reasonCode'],
  payment_cancel: ['productId', 'method', 'reasonCode'],
  report_start: ['productId'],
  report_success: ['productId'],
  report_fail: ['productId', 'reasonCode'],
  report_view: ['productId'],
  report_share: ['productId', 'target']
} as const satisfies Record<AnalyticsEventName, readonly string[]>);

const placementSet = new Set<string>(ANALYTICS_PLACEMENTS);
const loginMethodSet = new Set<string>(LOGIN_METHODS);
const paymentMethodSet = new Set<string>(PAYMENT_METHODS);
const reportShareTargetSet = new Set<string>(REPORT_SHARE_TARGETS);
const emittedLifecycleKeys = new Set<string>();
const lifecycleKeyQueue: string[] = [];
const MAX_LIFECYCLE_KEYS = 2_000;
const historicalProductEventNames = new Set<AnalyticsEventName>(['report_view', 'report_share']);

let activeProvider: AnalyticsProvider = NOOP_ANALYTICS_PROVIDER;

function isProvider(value: unknown): value is AnalyticsProvider {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'track' in value &&
      typeof (value as { track?: unknown }).track === 'function'
  );
}

function resolveProvider(
  configuration: AnalyticsConfiguration | AnalyticsProvider | AnalyticsTrack | null | undefined
): AnalyticsProvider {
  if (typeof configuration === 'function') {
    return { track: configuration };
  }
  if (isProvider(configuration)) {
    return configuration;
  }
  if (configuration && typeof configuration === 'object' && 'provider' in configuration) {
    const provider = configuration.provider;
    if (typeof provider === 'function') {
      return { track: provider };
    }
    if (isProvider(provider)) {
      return provider;
    }
  }
  return NOOP_ANALYTICS_PROVIDER;
}

/** Configure a provider and return a function that restores the previous one. */
export function configureAnalytics(
  configuration: AnalyticsConfiguration | AnalyticsProvider | AnalyticsTrack | null = null
): () => void {
  const previousProvider = activeProvider;
  activeProvider = resolveProvider(configuration);

  return () => {
    activeProvider = previousProvider;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function pickEnum<Value extends string>(
  value: unknown,
  values: ReadonlySet<string>
): Value | undefined {
  return typeof value === 'string' && values.has(value) ? (value as Value) : undefined;
}

function pickPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function pickReasonCode(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return /^[a-z0-9][a-z0-9_.-]{0,63}$/iu.test(normalized) ? normalized : undefined;
}

function addProductContext(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  eventName: ProductAnalyticsEventName
): boolean {
  const product = getProductById(
    typeof source.productId === 'string' ? source.productId : undefined
  );
  const isHistoricalAccess =
    product?.status === 'archived' && historicalProductEventNames.has(eventName);

  if (!product || (product.status !== 'active' && !isHistoricalAccess)) {
    return false;
  }

  // These fields intentionally come from the registry, never the caller.
  target.productId = product.id;
  target.name = product.displayName;
  target.price = product.price;
  target.currency = product.currency;
  target.status = product.status;
  return true;
}

function addPlacement(source: Record<string, unknown>, target: Record<string, unknown>): void {
  const placement = pickEnum<AnalyticsPlacement>(source.placement, placementSet);
  const position = pickPositiveInteger(source.position);
  if (placement) {
    target.placement = placement;
  }
  if (position) {
    target.position = position;
  }
}

function addLoginMethod(source: Record<string, unknown>, target: Record<string, unknown>): void {
  const method = pickEnum<LoginMethod>(source.method, loginMethodSet);
  if (method) {
    target.method = method;
  }
}

function addPaymentMethod(source: Record<string, unknown>, target: Record<string, unknown>): void {
  const method = pickEnum<PaymentMethod>(source.method, paymentMethodSet);
  if (method) {
    target.method = method;
  }
}

function addReasonCode(source: Record<string, unknown>, target: Record<string, unknown>): void {
  const reasonCode = pickReasonCode(source.reasonCode);
  if (reasonCode) {
    target.reasonCode = reasonCode;
  }
}

function addAttribution(target: Record<string, unknown>): void {
  const attribution = readSessionAttribution();
  if (attribution) {
    target.attribution = Object.freeze({
      firstTouch: Object.freeze({ ...attribution.firstTouch }),
      lastTouch: Object.freeze({ ...attribution.lastTouch })
    });
  }
}

function buildProviderPayload(
  eventName: AnalyticsEventName,
  input: unknown
): AnalyticsProviderPayload | undefined {
  const source = isRecord(input) ? input : {};
  const target: Record<string, unknown> = {};

  if (
    isProductAnalyticsEventName(eventName) &&
    !addProductContext(source, target, eventName)
  ) {
    return undefined;
  }

  switch (eventName) {
    case 'product_impression':
    case 'product_click':
      addPlacement(source, target);
      break;
    case 'form_step': {
      const step = pickPositiveInteger(source.step);
      const totalSteps = pickPositiveInteger(source.totalSteps);
      if (!step) {
        return undefined;
      }
      target.step = step;
      if (totalSteps && totalSteps >= step) {
        target.totalSteps = totalSteps;
      }
      break;
    }
    case 'login_start':
    case 'login_success':
      addLoginMethod(source, target);
      break;
    case 'login_fail':
      addLoginMethod(source, target);
      addReasonCode(source, target);
      break;
    case 'payment_start':
    case 'payment_success':
      addPaymentMethod(source, target);
      break;
    case 'payment_fail':
    case 'payment_cancel':
      addPaymentMethod(source, target);
      addReasonCode(source, target);
      break;
    case 'report_fail':
      addReasonCode(source, target);
      break;
    case 'report_share': {
      const shareTarget = pickEnum<ReportShareTarget>(source.target, reportShareTargetSet);
      if (shareTarget) {
        target.target = shareTarget;
      }
      break;
    }
    case 'home_view':
    case 'detail_view':
    case 'form_start':
    case 'form_complete':
    case 'checkout_view':
    case 'report_start':
    case 'report_success':
    case 'report_view':
      break;
  }

  addAttribution(target);
  return Object.freeze(target) as AnalyticsProviderPayload;
}

function reserveLifecycleKey(eventName: AnalyticsEventName, dedupeKey?: string): boolean {
  if (typeof dedupeKey !== 'string') {
    return true;
  }

  const internalKey = `${eventName}\u0000${dedupeKey.slice(0, 256)}`;
  if (emittedLifecycleKeys.has(internalKey)) {
    return false;
  }

  emittedLifecycleKeys.add(internalKey);
  lifecycleKeyQueue.push(internalKey);
  if (lifecycleKeyQueue.length > MAX_LIFECYCLE_KEYS) {
    const expiredKey = lifecycleKeyQueue.shift();
    if (expiredKey) {
      emittedLifecycleKeys.delete(expiredKey);
    }
  }
  return true;
}

function safelyDispatch(eventName: AnalyticsEventName, payload: AnalyticsProviderPayload): void {
  try {
    const result = activeProvider.track(eventName, payload);
    if (result && typeof result.then === 'function') {
      void Promise.resolve(result).catch(() => undefined);
    }
  } catch {
    // Analytics must never break the product, auth, payment, or report flow.
  }
}

export function trackAnalyticsEvent<EventName extends AnalyticsEventName>(
  eventName: EventName,
  payload: AnalyticsEventPayload<EventName>,
  lifecycle: AnalyticsLifecycleOptions = {}
): boolean {
  if (!isAnalyticsEventName(eventName)) {
    return false;
  }

  const providerPayload = buildProviderPayload(eventName, payload);
  if (!providerPayload || !reserveLifecycleKey(eventName, lifecycle.dedupeKey)) {
    return false;
  }

  safelyDispatch(eventName, providerPayload);
  return true;
}

export const trackEvent = trackAnalyticsEvent;

/** Test/runtime reset for provider hot reloads; does not touch attribution storage. */
export function resetAnalytics(): void {
  activeProvider = NOOP_ANALYTICS_PROVIDER;
  emittedLifecycleKeys.clear();
  lifecycleKeyQueue.length = 0;
}

// Compile-time exhaustiveness: changing the taxonomy requires updating the
// event-specific whitelist above.
const _allWhitelistsDefined: readonly AnalyticsEventName[] = ANALYTICS_EVENT_NAMES.filter(
  (eventName) => eventName in ANALYTICS_EVENT_FIELD_WHITELISTS
);
void _allWhitelistsDefined;
