import { describe, expect, it } from 'vitest';
import type { StorageKeyContract } from './contracts';
import { APP_STORAGE_KEYS } from './keys';
import { versionedJsonStorageCodec } from './versioned';

describe('versioned storage codec', () => {
  it('keeps version 1 JSON in the legacy raw shape', () => {
    const codec = versionedJsonStorageCodec(APP_STORAGE_KEYS.authUser, {
      decode: (value) => value as { id: string }
    });

    expect(codec.serialize({ id: 'user-1' })).toBe('{"id":"user-1"}');
    expect(codec.deserialize('{"id":"user-1"}')).toEqual({ id: 'user-1' });
  });

  it('writes a discriminator for version 2 and migrates legacy v1 payloads', () => {
    const v2Contract: StorageKeyContract = {
      ...APP_STORAGE_KEYS.authUser,
      version: 2
    };
    const codec = versionedJsonStorageCodec(v2Contract, {
      decode: (value) => value as { displayName: string },
      migrations: {
        1: (value) => ({ displayName: (value as { nickname: string }).nickname })
      }
    });

    expect(codec.serialize({ displayName: '운월당' })).toBe(
      '{"__unwoldangStorageVersion":2,"payload":{"displayName":"운월당"}}'
    );
    expect(codec.deserialize('{"nickname":"이전 사용자"}')).toEqual({
      displayName: '이전 사용자'
    });
  });

  it('rejects an unknown envelope version without an explicit migration', () => {
    const codec = versionedJsonStorageCodec(APP_STORAGE_KEYS.authUser, {
      decode: (value) => value
    });

    expect(() => codec.deserialize(
      '{"__unwoldangStorageVersion":99,"payload":{"id":"future"}}'
    )).toThrow('Unsupported storage version: 99');
  });
});
