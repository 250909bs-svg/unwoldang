import {
  APP_STORAGE_KEYS,
  defineStorage,
  readStorageValue,
  versionedJsonStorageCodec,
  versionedStringStorageCodec,
  writeStorageValue
} from '../../shared/storage';
import type { AuthUser } from './model';

const authUserStorage = defineStorage<AuthUser>(
  APP_STORAGE_KEYS.authUser,
  versionedJsonStorageCodec(APP_STORAGE_KEYS.authUser, {
    // v1 intentionally preserves the permissive legacy payload contract.
    decode: (value) => value as AuthUser
  })
);
const kakaoAuthStateStorage = defineStorage(
  APP_STORAGE_KEYS.kakaoAuthState,
  versionedStringStorageCodec(APP_STORAGE_KEYS.kakaoAuthState)
);

export const readStoredAuthUser = () => readStorageValue(authUserStorage);

export const writeStoredAuthUser = (user: AuthUser | null) => {
  writeStorageValue(authUserStorage, user);
};

export const writePendingAuthState = (state: string) => {
  writeStorageValue(kakaoAuthStateStorage, state);
};

export const consumePendingAuthState = (state?: string | null) => {
  if (typeof window === 'undefined' || !state) {
    return false;
  }

  const stored = readStorageValue(kakaoAuthStateStorage);
  writeStorageValue(kakaoAuthStateStorage, null);

  return Boolean(stored && stored === state);
};
