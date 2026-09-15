import type { ReunionContext } from './types';
import { normalizeReunionContext } from './validation';

const REUNION_STORAGE_PREFIX = 'unwoldang.reunion.context.v1';

function ownerFingerprint(ownerId: string) {
  let hash = 2166136261;
  for (const character of ownerId.trim().toLocaleLowerCase('en-US')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getReunionContextStorageKey(ownerId?: string) {
  const normalizedOwnerId = ownerId?.trim();
  return normalizedOwnerId ? `${REUNION_STORAGE_PREFIX}.owner-${ownerFingerprint(normalizedOwnerId)}` : REUNION_STORAGE_PREFIX;
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try { return window.sessionStorage; } catch { return null; }
}

export function readReunionContext(ownerId?: string): ReunionContext | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  const key = getReunionContextStorageKey(ownerId);

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const normalized = normalizeReunionContext(JSON.parse(raw) as unknown);
    if (!normalized) storage.removeItem(key);
    return normalized;
  } catch {
    try { storage.removeItem(key); } catch { /* unavailable storage */ }
    return null;
  }
}

export function writeReunionContext(value: unknown, ownerId?: string): ReunionContext {
  const normalized = normalizeReunionContext(value);
  if (!normalized) throw new Error('재회 정보를 저장할 수 없습니다. 입력값을 확인해 주세요.');
  const storage = getSessionStorage();
  if (!storage) return normalized;

  try {
    storage.setItem(getReunionContextStorageKey(ownerId), JSON.stringify(normalized));
    return normalized;
  } catch {
    return normalized;
  }
}

export function clearReunionContext(ownerId?: string) {
  const storage = getSessionStorage();
  if (!storage) return;
  try { storage.removeItem(getReunionContextStorageKey(ownerId)); } catch { /* unavailable storage */ }
}
