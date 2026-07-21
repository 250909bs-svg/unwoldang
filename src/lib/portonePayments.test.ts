import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPortOneSdk } from './portonePayments';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PortOne SDK loader', () => {
  it('removes a failed script so the next attempt can load a fresh one', async () => {
    let currentScript: Record<string, unknown> | null = null;
    const appended: Array<Record<string, unknown>> = [];
    const documentStub = {
      querySelector: vi.fn(() => currentScript),
      createElement: vi.fn(() => {
        const script: Record<string, unknown> = {
          remove: vi.fn(() => {
            if (currentScript === script) {
              currentScript = null;
            }
          })
        };
        return script;
      }),
      head: {
        appendChild: vi.fn((script: Record<string, unknown>) => {
          currentScript = script;
          appended.push(script);
        })
      }
    };
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', documentStub);

    const first = loadPortOneSdk();
    (appended[0].onerror as () => void)();
    await expect(first).rejects.toThrow('로드에 실패');

    const second = loadPortOneSdk();
    expect(appended).toHaveLength(2);
    (appended[1].onerror as () => void)();
    await expect(second).rejects.toThrow('로드에 실패');
  });
});
