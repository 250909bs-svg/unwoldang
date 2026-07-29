import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REUNION_DRAFT_KEY,
  REUNION_DRAFT_SCHEMA_VERSION,
  REUNION_DRAFT_TTL_MS,
  createEmptyReunionIntake,
  readReunionDraft,
  saveReunionDraft
} from './intake';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    }
  };
}

function readStoredEnvelope() {
  const raw = window.sessionStorage.getItem(REUNION_DRAFT_KEY);
  if (!raw) throw new Error('expected a stored reunion draft');
  return JSON.parse(raw) as Record<string, any>;
}

describe('reunion intake draft security', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T03:00:00.000Z'));
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage: createMemoryStorage() }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('stores a versioned, timestamped envelope and restores a valid draft', () => {
    const input = createEmptyReunionIntake('2026-07-21');
    input.name = 'Mina';
    input.birthDate = '1995-03-02';
    input.reunion.customQuestion = 'Can we talk again?';

    saveReunionDraft(input);

    const envelope = readStoredEnvelope();
    expect(envelope.schemaVersion).toBe(REUNION_DRAFT_SCHEMA_VERSION);
    expect(envelope.savedAt).toBe('2026-07-21T03:00:00.000Z');
    expect(envelope.data.name).toBe('Mina');
    expect(readReunionDraft()).toMatchObject({
      name: 'Mina',
      birthDate: '1995-03-02',
      reunion: {
        schemaVersion: 'reunion-intake-v1',
        customQuestion: 'Can we talk again?'
      }
    });
  });

  it('deletes malformed JSON instead of hydrating it', () => {
    window.sessionStorage.setItem(REUNION_DRAFT_KEY, '{not-json');

    expect(readReunionDraft()).toBeNull();
    expect(window.sessionStorage.getItem(REUNION_DRAFT_KEY)).toBeNull();
  });

  it('deletes expired drafts after the 24 hour TTL', () => {
    saveReunionDraft(createEmptyReunionIntake('2026-07-21'));
    const envelope = readStoredEnvelope();
    envelope.savedAt = new Date(Date.now() - REUNION_DRAFT_TTL_MS - 1).toISOString();
    window.sessionStorage.setItem(REUNION_DRAFT_KEY, JSON.stringify(envelope));

    expect(readReunionDraft()).toBeNull();
    expect(window.sessionStorage.getItem(REUNION_DRAFT_KEY)).toBeNull();
  });

  it('deletes an older or damaged schema envelope', () => {
    saveReunionDraft(createEmptyReunionIntake('2026-07-21'));
    const envelope = readStoredEnvelope();
    envelope.schemaVersion = 'reunion-draft-v0';
    window.sessionStorage.setItem(REUNION_DRAFT_KEY, JSON.stringify(envelope));

    expect(readReunionDraft()).toBeNull();
    expect(window.sessionStorage.getItem(REUNION_DRAFT_KEY)).toBeNull();
  });

  it('whitelists and normalizes untrusted field types without spreading extra keys', () => {
    saveReunionDraft(createEmptyReunionIntake('2026-07-21'));
    const envelope = readStoredEnvelope();
    envelope.data.admin = true;
    envelope.data.gender = 'robot';
    envelope.data.isLeapMonth = 'true';
    envelope.data.name = 42;
    envelope.data.partner.gender = 'unknown';
    envelope.data.reunion.selectedQuestions = [
      'reunion-index',
      'not-a-question',
      'reunion-index',
      7
    ];
    envelope.data.reunion.facts.breakupReasons = ['trust', 'invalid', 'trust'];
    envelope.data.reunion.facts.pastReunionCount = '4';
    envelope.data.reunion.safety.violence = 'yes';
    envelope.data.reunion.readiness.level = 'perfect';
    window.sessionStorage.setItem(REUNION_DRAFT_KEY, JSON.stringify(envelope));

    const restored = readReunionDraft();
    expect(restored).not.toBeNull();
    expect(restored).toMatchObject({
      name: '',
      gender: 'female',
      isLeapMonth: false,
      partner: { gender: 'male' },
      reunion: {
        selectedQuestions: ['reunion-index'],
        facts: {
          breakupReasons: ['trust'],
          pastReunionCount: 0
        },
        safety: { violence: false },
        readiness: { level: 'shaky' }
      }
    });
    expect((restored as unknown as Record<string, unknown>).admin).toBeUndefined();
  });
});
