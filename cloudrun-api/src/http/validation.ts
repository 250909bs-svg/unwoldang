import { PaymentRequestError } from '../contracts/errors.ts';

export function getRequiredString(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new PaymentRequestError(400, `${key} 값이 올바르지 않습니다.`);
  }

  return value.trim();
}

export function getRequiredAmount(body: Record<string, unknown>) {
  const amount = Number(body.amount);

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new PaymentRequestError(400, 'amount 값이 올바르지 않습니다.');
  }

  return amount;
}

export function getOptionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
