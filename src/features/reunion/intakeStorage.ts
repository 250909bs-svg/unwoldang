import type { ReunionContext } from '../../lib/reunion';
import type { ReunionIntakeDraft } from './reunionFlow';

const STORAGE_PREFIX = 'unwoldang.reunion-intake.v1';
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000;

type StoredReunionDraft = {
  version: 1;
  savedAt: number;
  draft: ReunionIntakeDraft;
  context?: ReunionContext;
};

function safeOwnerId(ownerId?: string) {
  return ownerId?.trim().replace(/[^a-zA-Z0-9._@=-]/g, '') || 'guest';
}

export function getReunionDraftStorageKey(ownerId?: string) {
  return `${STORAGE_PREFIX}.${safeOwnerId(ownerId)}`;
}

function isStoredDraft(value: unknown): value is StoredReunionDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const candidate = value as Partial<StoredReunionDraft>;
  return candidate.version === 1 &&
    typeof candidate.savedAt === 'number' &&
    Boolean(candidate.draft) &&
    typeof candidate.draft === 'object';
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try { return window.sessionStorage; } catch { return null; }
}

export function readReunionDraft(ownerId?: string): StoredReunionDraft | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  const key = getReunionDraftStorageKey(ownerId);

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredDraft(parsed) || Date.now() - parsed.savedAt > MAX_DRAFT_AGE_MS) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try { storage.removeItem(key); } catch { /* unavailable storage */ }
    return null;
  }
}

export function writeReunionDraft(
  draft: ReunionIntakeDraft,
  ownerId?: string,
  context?: ReunionContext
) {
  const storage = getSessionStorage();
  if (!storage) return;
  const value: StoredReunionDraft = {
    version: 1,
    savedAt: Date.now(),
    draft,
    context
  };
  try {
    storage.setItem(getReunionDraftStorageKey(ownerId), JSON.stringify(value));
  } catch {
    // Draft persistence is best effort; the in-memory intake remains usable.
  }
}

export function clearReunionDraft(ownerId?: string) {
  const storage = getSessionStorage();
  if (!storage) return;
  try { storage.removeItem(getReunionDraftStorageKey(ownerId)); } catch { /* unavailable storage */ }
}
