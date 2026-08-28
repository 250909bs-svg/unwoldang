import type { MatchCoupleStoredFormData } from './types';

export const MATCH_COUPLE_DRAFT_PREFIX = 'unwoldang.intake.match-couple.v1';
export const MATCH_COUPLE_GUEST_DRAFT_KEY = `${MATCH_COUPLE_DRAFT_PREFIX}.guest`;

type DraftSource = Partial<MatchCoupleStoredFormData>;

interface ResolveMatchCoupleDraftInput {
  routeFormData?: DraftSource;
  routeDraftOwnerId?: string;
  currentUserId?: string;
  preferGuest?: boolean;
  storage?: Storage | null;
}

function browserSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isDraftSource(value: unknown): value is DraftSource {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function getMatchCoupleDraftKey(ownerId?: string | null) {
  const normalizedOwnerId = ownerId?.trim();
  return normalizedOwnerId
    ? `${MATCH_COUPLE_DRAFT_PREFIX}.${encodeURIComponent(normalizedOwnerId)}`
    : MATCH_COUPLE_GUEST_DRAFT_KEY;
}

export function readMatchCoupleDraft(
  ownerId?: string | null,
  storage: Storage | null = browserSessionStorage()
): DraftSource | undefined {
  if (!storage) return undefined;

  const key = getMatchCoupleDraftKey(ownerId);
  let raw: string | null = null;

  try {
    raw = storage.getItem(key);
  } catch {
    return undefined;
  }

  if (!raw) return undefined;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isDraftSource(parsed)) return parsed;
  } catch {
    // A partial browser write should never block the intake or preview route.
  }

  try {
    storage.removeItem(key);
  } catch {
    // Storage can become unavailable between the read and cleanup attempt.
  }
  return undefined;
}

export function saveMatchCoupleDraft(
  formData: DraftSource,
  ownerId?: string | null,
  storage: Storage | null = browserSessionStorage()
) {
  if (!storage || !isDraftSource(formData)) return false;

  try {
    storage.setItem(getMatchCoupleDraftKey(ownerId), JSON.stringify(formData));
    return true;
  } catch {
    return false;
  }
}

export function removeMatchCoupleDraft(
  ownerId?: string | null,
  storage: Storage | null = browserSessionStorage()
) {
  if (!storage) return false;

  try {
    storage.removeItem(getMatchCoupleDraftKey(ownerId));
    return true;
  } catch {
    return false;
  }
}

export function promoteMatchCoupleGuestDraft(
  formData: DraftSource,
  ownerId: string,
  storage: Storage | null = browserSessionStorage()
) {
  if (!ownerId.trim()) return false;

  const savedForMember = saveMatchCoupleDraft(formData, ownerId, storage);
  if (!savedForMember) return false;

  removeMatchCoupleDraft(undefined, storage);
  return true;
}

/**
 * Route state wins only when it belongs to the active user. A signed-in user
 * normally gets their isolated draft. The explicit, non-PII login-return
 * marker can prefer the guest draft that was just submitted, preventing an
 * older member draft from replacing it. This keeps one browser user's route
 * state out of another account.
 */
export function resolveMatchCoupleDraft({
  routeFormData,
  routeDraftOwnerId,
  currentUserId,
  preferGuest = false,
  storage = browserSessionStorage()
}: ResolveMatchCoupleDraftInput): DraftSource | undefined {
  const routeBelongsToCurrentUser =
    !routeDraftOwnerId || routeDraftOwnerId === currentUserId;

  if (routeFormData && routeBelongsToCurrentUser) return routeFormData;

  if (preferGuest) {
    const guestDraft = readMatchCoupleDraft(undefined, storage);
    if (guestDraft) return guestDraft;
  }

  if (currentUserId) {
    const userDraft = readMatchCoupleDraft(currentUserId, storage);
    if (userDraft) return userDraft;
  }

  return readMatchCoupleDraft(undefined, storage);
}
