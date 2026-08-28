import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_ATTRIBUTION_STORAGE_KEY,
  ATTRIBUTION_CHANNELS,
  captureSessionAttribution,
  readSessionAttribution,
  type SessionStorageLike
} from './attribution';

class MemorySessionStorage implements SessionStorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('session attribution', () => {
  it('stores only the five standard UTM fields, a bounded channel, and referrer hostname', () => {
    const storage = new MemorySessionStorage();
    const attribution = captureSessionAttribution({
      pathname: '/',
      search:
        '?utm_source=naver&utm_medium=cpc&utm_campaign=summer&utm_term=saju&utm_content=hero&code=oauth-secret&state=state-secret&paymentId=payment-secret&txId=tx-secret&gclid=click-secret',
      referrer: 'https://search.naver.com/private/person?email=person@example.com',
      currentHostname: 'www.unwoldang.com',
      storage
    });

    expect(attribution?.firstTouch).toEqual({
      channel: 'paid_search',
      utm_source: 'naver',
      utm_medium: 'cpc',
      utm_campaign: 'summer',
      utm_term: 'saju',
      utm_content: 'hero',
      referrer_hostname: 'search.naver.com'
    });
    expect(ATTRIBUTION_CHANNELS).toContain(attribution?.firstTouch.channel);

    const serialized = storage.getItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY) || '';
    expect(serialized).not.toMatch(/oauth-secret|state-secret|payment-secret|tx-secret|click-secret/);
    expect(serialized).not.toMatch(/\/private\/person|person@example\.com/);
  });

  it('keeps first touch and updates last touch only for a new acquisition signal', () => {
    const storage = new MemorySessionStorage();
    captureSessionAttribution({
      pathname: '/',
      search: '?utm_source=google&utm_medium=organic',
      storage
    });
    captureSessionAttribution({ pathname: '/detail/love-reading', storage });
    captureSessionAttribution({
      pathname: '/detail/love-reading',
      search: '?utm_source=instagram&utm_medium=social',
      storage
    });

    expect(readSessionAttribution(storage)).toEqual({
      firstTouch: {
        channel: 'organic_search',
        utm_source: 'google',
        utm_medium: 'organic'
      },
      lastTouch: {
        channel: 'organic_social',
        utm_source: 'instagram',
        utm_medium: 'social'
      }
    });
  });

  it('does not overwrite attribution on auth or payment callbacks', () => {
    const storage = new MemorySessionStorage();
    captureSessionAttribution({
      pathname: '/',
      search: '?utm_source=naver&utm_medium=cpc',
      storage
    });
    const beforeCallback = storage.getItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY);

    captureSessionAttribution({
      pathname: '/auth/kakao/callback',
      search: '?code=oauth-secret&utm_source=callback',
      referrer: 'https://accounts.kakao.com/oauth/authorize',
      storage
    });
    captureSessionAttribution({
      pathname: '/payment/portone/callback',
      search: '?paymentId=payment-secret&txId=tx-secret&utm_source=gateway',
      referrer: 'https://payment.example/transaction/secret',
      storage
    });

    expect(storage.getItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY)).toBe(beforeCallback);
  });

  it('discards PII, URLs, control characters, click IDs, and excessive values', () => {
    const storage = new MemorySessionStorage();
    const attribution = captureSessionAttribution({
      pathname: '/',
      search: new URLSearchParams({
        utm_source: 'person@example.com',
        utm_medium: 'campaign-user-010-1234-5678',
        utm_campaign: 'https://example.com/private',
        utm_term: 'gclid=click-secret',
        utm_content: `unsafe\u0000value${'x'.repeat(120)}`
      }).toString(),
      referrer: 'https://safe.example/private/path?phone=01012345678',
      storage
    });

    expect(attribution).toEqual({
      firstTouch: { channel: 'referral', referrer_hostname: 'safe.example' },
      lastTouch: { channel: 'referral', referrer_hostname: 'safe.example' }
    });
    const serialized = storage.getItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY) || '';
    expect(serialized).not.toMatch(/person@|010-|https?:|click-secret|private\/path/);
  });

  it('rejects natural-language UTM values instead of persisting possible personal data', () => {
    const storage = new MemorySessionStorage();
    const attribution = captureSessionAttribution({
      pathname: '/',
      search: new URLSearchParams({
        utm_source: '홍길동_서울강남',
        utm_campaign: 'private customer cohort',
        utm_term: '민감한 검색 문장'
      }).toString(),
      storage
    });

    expect(attribution).toEqual({
      firstTouch: { channel: 'direct' },
      lastTouch: { channel: 'direct' }
    });
    expect(storage.getItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY)).not.toMatch(
      /홍길동|서울강남|private customer|민감한/
    );
  });

  it('classifies explicit paid and organic social media consistently', () => {
    const paidStorage = new MemorySessionStorage();
    const organicStorage = new MemorySessionStorage();

    expect(
      captureSessionAttribution({
        pathname: '/',
        search: '?utm_source=instagram&utm_medium=paid_social',
        storage: paidStorage
      })?.firstTouch.channel
    ).toBe('paid_social');
    expect(
      captureSessionAttribution({
        pathname: '/',
        search: '?utm_source=instagram&utm_medium=organic',
        storage: organicStorage
      })?.firstTouch.channel
    ).toBe('organic_social');
  });
});
