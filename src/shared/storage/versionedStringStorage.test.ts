import { describe, expect, it } from 'vitest';
import type { StorageKeyContract } from './contracts';
import { getCustomerKeyStorageContract } from './keys';
import { versionedStringStorageCodec } from './versioned';

describe('versioned string storage codec', () => {
  it.each([
    'uw.user-1.random',
    'v1:legacy-looking-value',
    'v2:future-looking-value',
    '{"__unwoldangStorageVersion":2,"payload":"envelope-looking-value"}'
  ])('keeps every version 1 raw value byte-for-byte: %s', (raw) => {
    const codec = versionedStringStorageCodec(getCustomerKeyStorageContract('user-1'));
    expect(codec.serialize(raw)).toBe(raw);
    expect(codec.deserialize(raw)).toBe(raw);
  });

  it('uses an unambiguous envelope for version 2 and migrates raw v1 values', () => {
    const v2Contract: StorageKeyContract = {
      ...getCustomerKeyStorageContract('user-1'),
      version: 2
    };
    const codec = versionedStringStorageCodec(v2Contract, {
      1: (legacyValue) => `migrated:${legacyValue}`
    });

    expect(codec.serialize('new-value')).toBe(
      '{"__unwoldangStorageVersion":2,"payload":"new-value"}'
    );
    expect(codec.deserialize('{"__unwoldangStorageVersion":2,"payload":"new-value"}')).toBe(
      'new-value'
    );
    expect(codec.deserialize('v2:legacy-value')).toBe('migrated:v2:legacy-value');
  });
});
