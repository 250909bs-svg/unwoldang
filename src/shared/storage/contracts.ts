export type StorageArea = 'local' | 'session';
export type StorageSerialization = 'json' | 'raw-string';

export type StorageKeyContract = {
  key: string;
  area: StorageArea;
  version: number;
  serialization: StorageSerialization;
};

export type StorageCodec<T> = {
  serialize: (value: T) => string;
  deserialize: (raw: string) => T;
};

export type StorageDefinition<T> = StorageKeyContract & {
  codec: StorageCodec<T>;
};

export const jsonStorageCodec = <T>(): StorageCodec<T> => ({
  serialize: (value) => JSON.stringify(value),
  deserialize: (raw) => JSON.parse(raw) as T
});

export const rawStringStorageCodec: StorageCodec<string> = {
  serialize: (value) => value,
  deserialize: (raw) => raw
};

export function defineStorage<T>(
  contract: StorageKeyContract,
  codec: StorageCodec<T>
): StorageDefinition<T> {
  return { ...contract, codec };
}

function getStorage(area: StorageArea): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return area === 'local' ? window.localStorage : window.sessionStorage;
}

export function readStorageValue<T>(definition: StorageDefinition<T>): T | null {
  const storage = getStorage(definition.area);

  if (!storage) {
    return null;
  }

  const raw = storage.getItem(definition.key);

  if (raw === null) {
    return null;
  }

  try {
    return definition.codec.deserialize(raw);
  } catch {
    storage.removeItem(definition.key);
    return null;
  }
}

export function writeStorageValue<T>(definition: StorageDefinition<T>, value: T | null): void {
  const storage = getStorage(definition.area);

  if (!storage) {
    return;
  }

  if (value === null) {
    storage.removeItem(definition.key);
    return;
  }

  storage.setItem(definition.key, definition.codec.serialize(value));
}

export function removeStorageValue(definition: StorageKeyContract): void {
  getStorage(definition.area)?.removeItem(definition.key);
}
