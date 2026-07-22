import { createSecureRandomPart } from '../../shared/security/secureRandom';

export const createOrderId = () => `UW-${Date.now()}-${createSecureRandomPart()}`;

export const getPriceValue = (price: string) => Number(price.replace(/[^\d]/g, '')) || 0;
