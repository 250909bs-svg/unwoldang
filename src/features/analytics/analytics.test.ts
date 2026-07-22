import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProductById } from '../../products/registry';
import {
  ANALYTICS_ATTRIBUTION_STORAGE_KEY,
  ANALYTICS_EVENT_NAMES,
  configureAnalytics,
  installBrowserAnalytics,
  resetAnalytics,
  trackAnalyticsEvent,
  type AnalyticsProviderPayload
} from './index';

afterEach(() => {
  resetAnalytics();
  vi.unstubAllGlobals();
});

describe('analytics taxonomy', () => {
  it('exposes exactly the approved 20 events', () => {
    expect(ANALYTICS_EVENT_NAMES).toEqual([
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
    ]);
    expect(new Set(ANALYTICS_EVENT_NAMES).size).toBe(20);
    expect(ANALYTICS_EVENT_NAMES).not.toContain('my_view');
  });
});

describe('analytics provider boundary', () => {
  it('runs safely with the default no-op provider', () => {
    expect(() => trackAnalyticsEvent('home_view', {})).not.toThrow();
    expect(trackAnalyticsEvent('home_view', {})).toBe(true);
  });

  it('enriches product fields only from the registry and strips arbitrary or sensitive fields', () => {
    const events: Array<{ name: string; payload: AnalyticsProviderPayload }> = [];
    configureAnalytics((name, payload) => events.push({ name, payload }));

    trackAnalyticsEvent(
      'payment_success',
      {
        productId: 'general-signature',
        name: 'caller supplied name',
        price: 1,
        currency: 'USD',
        status: 'archived',
        email: 'person@example.com',
        phone: '010-1234-5678',
        url: 'https://example.com/private',
        paymentId: 'payment-secret',
        txId: 'transaction-secret',
        arbitrary: 'not-approved',
        dedupeKey: 'must-not-leak'
      } as never,
      { dedupeKey: 'payment-lifecycle' }
    );

    const product = getProductById('general-signature');
    expect(events).toEqual([
      {
        name: 'payment_success',
        payload: {
          productId: product.id,
          name: product.displayName,
          price: product.price,
          currency: product.currency,
          status: product.status
        }
      }
    ]);
  });

  it('rejects archived conversion events but keeps historical report analytics', () => {
    const track = vi.fn();
    configureAnalytics({ track });

    expect(trackAnalyticsEvent('product_click', { productId: 'life-flow' })).toBe(false);
    expect(trackAnalyticsEvent('payment_start', { productId: 'life-flow' })).toBe(false);
    expect(trackAnalyticsEvent('report_start', { productId: 'life-flow' })).toBe(false);
    expect(trackAnalyticsEvent('report_view', { productId: 'life-flow' })).toBe(true);
    expect(
      trackAnalyticsEvent('report_share', { productId: 'life-flow', target: 'clipboard' })
    ).toBe(true);

    expect(track.mock.calls.map(([name]) => name)).toEqual(['report_view', 'report_share']);
    expect(track.mock.calls[0]?.[1]).toMatchObject({
      productId: 'life-flow',
      status: 'archived'
    });
  });

  it('emits one lifecycle event for the same key and emits again for a different key', () => {
    const track = vi.fn();
    configureAnalytics({ track });

    expect(
      trackAnalyticsEvent('detail_view', { productId: 'love-reading' }, { dedupeKey: 'route-a' })
    ).toBe(true);
    expect(
      trackAnalyticsEvent('detail_view', { productId: 'love-reading' }, { dedupeKey: 'route-a' })
    ).toBe(false);
    expect(
      trackAnalyticsEvent('detail_view', { productId: 'love-reading' }, { dedupeKey: 'route-b' })
    ).toBe(true);

    expect(track).toHaveBeenCalledTimes(2);
    expect(track.mock.calls[0]?.[1]).not.toHaveProperty('dedupeKey');
  });

  it('isolates both synchronous throws and asynchronous rejections', async () => {
    configureAnalytics({
      track: () => {
        throw new Error('provider unavailable');
      }
    });
    expect(() => trackAnalyticsEvent('login_start', { method: 'kakao' })).not.toThrow();

    configureAnalytics({ track: () => Promise.reject(new Error('provider rejected')) });
    expect(() => trackAnalyticsEvent('login_success', { method: 'kakao' })).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('browser route lifecycle', () => {
  it('deduplicates StrictMode installs, but counts a later POP revisit', async () => {
    const track = vi.fn();
    configureAnalytics({ track });

    const disposeFirst = installBrowserAnalytics({
      pathname: '/detail/past-life-goblin',
      navigationKey: 'strict-route'
    });
    disposeFirst();
    const disposeSecond = installBrowserAnalytics({
      pathname: '/detail/past-life-goblin',
      navigationKey: 'strict-route'
    });
    disposeSecond();

    installBrowserAnalytics({
      pathname: '/detail/past-life-goblin/immersion',
      navigationKey: 'supplemental-route'
    })();

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(
      'detail_view',
      expect.objectContaining({ productId: 'past-life-goblin' })
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    installBrowserAnalytics({
      pathname: '/detail/past-life-goblin',
      navigationKey: 'strict-route'
    })();
    expect(track).toHaveBeenCalledTimes(2);
  });

  it('tracks a React Router product link after navigation prevents the native default', () => {
    const track = vi.fn();
    configureAnalytics({ track });
    let clickListener: EventListener | undefined;
    const documentRef = {
      baseURI: 'https://www.unwoldang.com/search',
      referrer: '',
      addEventListener(type: string, listener: EventListener) {
        if (type === 'click') clickListener = listener;
      },
      removeEventListener: vi.fn()
    } as unknown as Document;
    vi.stubGlobal('document', documentRef);
    vi.stubGlobal('window', {
      location: {
        href: 'https://www.unwoldang.com/search',
        origin: 'https://www.unwoldang.com',
        hostname: 'www.unwoldang.com',
        search: ''
      }
    });
    const anchor = {
      getAttribute(name: string) {
        return name === 'href' ? '/detail/love-reading' : null;
      },
      closest(selector: string) {
        return selector === 'a[href]' ? this : null;
      }
    } as unknown as Element;

    const dispose = installBrowserAnalytics({ pathname: '/search', navigationKey: 'search-link' });
    clickListener?.({ defaultPrevented: true, target: anchor } as Event);
    dispose();

    expect(track).toHaveBeenCalledWith(
      'product_click',
      expect.objectContaining({ productId: 'love-reading', placement: 'search' })
    );
  });

  it('uses document referrer only for the first navigation in an SPA document', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      }
    };
    const documentRef = {
      baseURI: 'https://www.unwoldang.com/',
      referrer: 'https://search.naver.com/search.naver?query=saju',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as unknown as Document;
    const locationRef = {
      href: 'https://www.unwoldang.com/?utm_source=naver&utm_medium=cpc',
      origin: 'https://www.unwoldang.com',
      hostname: 'www.unwoldang.com',
      search: '?utm_source=naver&utm_medium=cpc'
    };
    vi.stubGlobal('document', documentRef);
    vi.stubGlobal('window', { location: locationRef, sessionStorage: storage });

    installBrowserAnalytics({ pathname: '/', navigationKey: 'landing' })();
    locationRef.href = 'https://www.unwoldang.com/detail/love-reading';
    locationRef.search = '';
    installBrowserAnalytics({
      pathname: '/detail/love-reading',
      navigationKey: 'detail-after-landing'
    })();

    expect(
      JSON.parse(values.get(ANALYTICS_ATTRIBUTION_STORAGE_KEY) || '{}')
    ).toEqual({
      firstTouch: {
        channel: 'paid_search',
        utm_source: 'naver',
        utm_medium: 'cpc',
        referrer_hostname: 'search.naver.com'
      },
      lastTouch: {
        channel: 'paid_search',
        utm_source: 'naver',
        utm_medium: 'cpc',
        referrer_hostname: 'search.naver.com'
      }
    });
  });
});
