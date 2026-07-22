import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeFormDataWithKasi } from './kasiCalendarService';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('KASI report generation budget', () => {
  it('aborts fetch and response work with the external lease signal', async () => {
    vi.stubEnv('KASI_SERVICE_KEY', 'test-key');
    vi.stubEnv('KASI_REQUEST_TIMEOUT_MS', '600000');
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        requestSignal = init?.signal as AbortSignal;
        markStarted();
        requestSignal.addEventListener(
          'abort',
          () => reject(requestSignal?.reason),
          { once: true }
        );
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const reason = new Error('fixture lease deadline');
    const pending = normalizeFormDataWithKasi(
      {
        calendar: 'solar',
        birthDate: '1992-09-09',
        isLeapMonth: false
      },
      {
        deadlineAt: Date.now() + 60_000,
        signal: controller.signal
      }
    );

    await started;
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(requestSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
