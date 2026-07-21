/**
 * Temporary compatibility facade.
 *
 * New code should import from the domain modules under `features` or `shared`.
 * Existing callers can migrate incrementally without changing runtime behavior.
 */
export * from '../features/auth/core';
export * from '../features/customer';
export * from '../features/payments';
export { buildHashCallbackLocation } from '../shared/api/callbackRouting';
