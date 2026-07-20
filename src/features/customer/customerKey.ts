import { createSecureRandomPart } from '../../shared/security/secureRandom';
import {
  defineStorage,
  getCustomerKeyStorageContract,
  readStorageValue,
  versionedStringStorageCodec,
  writeStorageValue
} from '../../shared/storage';

export const createCustomerKey = (userId?: string) => {
  if (typeof window === 'undefined') {
    return `uw.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
  }

  const identity = (userId || 'guest').replace(/[^a-zA-Z0-9\-_.=@]/g, '') || 'guest';
  const contract = getCustomerKeyStorageContract(identity);
  const definition = defineStorage(
    contract,
    versionedStringStorageCodec(contract)
  );
  const stored = readStorageValue(definition);

  if (stored) {
    return stored;
  }

  const randomPart = createSecureRandomPart();
  const created = `uw.${identity}.${randomPart}`.slice(0, 50);
  writeStorageValue(definition, created);
  return created;
};
