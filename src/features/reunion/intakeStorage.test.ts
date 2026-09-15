import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyReunionDraft } from './reunionFlow';
import { clearReunionDraft, readReunionDraft, writeReunionDraft } from './intakeStorage';

afterEach(() => Reflect.deleteProperty(globalThis, 'window'));

describe('reunion intake storage safety', () => {
  it('does not crash when sessionStorage itself is unavailable', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: Object.defineProperty({}, 'sessionStorage', {
        get() { throw new Error('blocked'); }
      })
    });
    expect(() => readReunionDraft()).not.toThrow();
    expect(() => writeReunionDraft(createEmptyReunionDraft())).not.toThrow();
    expect(() => clearReunionDraft()).not.toThrow();
  });

  it('does not crash when storage operations are rejected', () => {
    const blocked = (): never => { throw new Error('blocked'); };
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage: { getItem: blocked, setItem: blocked, removeItem: blocked } }
    });
    expect(readReunionDraft()).toBeNull();
    expect(() => writeReunionDraft(createEmptyReunionDraft())).not.toThrow();
    expect(() => clearReunionDraft()).not.toThrow();
  });
});
