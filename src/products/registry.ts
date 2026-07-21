import productManifest from './manifest.json';
import { careerReadingProduct } from './career-reading';
import { concernReadingProduct } from './concern-reading';
import { generalSignatureProduct } from './general-signature';
import { lifeFlowProduct } from './life-flow';
import { loveReadingProduct } from './love-reading';
import { loveReunionProduct } from './love-reunion';
import { marriageBlueprintProduct } from './marriage-blueprint';
import { marriageTimingProduct } from './marriage-timing';
import { matchCoupleProduct } from './match-couple';
import { matchDestinyProduct } from './match-destiny';
import { moneyReadingProduct } from './money-reading';
import { pastLifeGoblinProduct } from './past-life-goblin';
import {
  productIds,
  productStatuses,
  type ProductDefinition,
  type ProductId,
  type ProductModuleDefinition,
  type ProductStatus
} from './types';

const productModules = {
  'general-signature': generalSignatureProduct,
  'life-flow': lifeFlowProduct,
  'concern-reading': concernReadingProduct,
  'past-life-goblin': pastLifeGoblinProduct,
  'love-reading': loveReadingProduct,
  'love-reunion': loveReunionProduct,
  'match-couple': matchCoupleProduct,
  'match-destiny': matchDestinyProduct,
  'marriage-blueprint': marriageBlueprintProduct,
  'marriage-timing': marriageTimingProduct,
  'career-reading': careerReadingProduct,
  'money-reading': moneyReadingProduct
} satisfies Record<ProductId, ProductModuleDefinition>;

const manifestStatuses = productManifest as Record<string, unknown>;

function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === 'string' && productStatuses.includes(value as ProductStatus);
}

function validateManifest() {
  const manifestIds = Object.keys(manifestStatuses).sort();
  const registeredIds = [...productIds].sort();

  if (
    manifestIds.length !== registeredIds.length ||
    manifestIds.some((id, index) => id !== registeredIds[index])
  ) {
    throw new Error('Product manifest IDs must exactly match the registered product IDs.');
  }

  productIds.forEach((id) => {
    if (!isProductStatus(manifestStatuses[id])) {
      throw new Error(`Product manifest has an invalid status for "${id}".`);
    }

    if (productModules[id].id !== id) {
      throw new Error(`Product module ID does not match its registry key: "${id}".`);
    }
  });
}

validateManifest();

export const productRegistry = Object.freeze(
  Object.fromEntries(
    productIds.map((id) => [
      id,
      Object.freeze({
        ...productModules[id],
        status: manifestStatuses[id] as ProductStatus
      })
    ])
  ) as unknown as Record<ProductId, ProductDefinition>
);

export const activeProducts = Object.freeze(
  productIds.map((id) => productRegistry[id]).filter((product) => product.status === 'active')
);

export function getProductById(id: ProductId): ProductDefinition;
export function getProductById(id?: string): ProductDefinition | undefined;
export function getProductById(id?: string): ProductDefinition | undefined {
  return id && Object.prototype.hasOwnProperty.call(productRegistry, id)
    ? productRegistry[id as ProductId]
    : undefined;
}

export function isProductActive(id?: string): id is ProductId {
  return getProductById(id)?.status === 'active';
}

export function canDiscoverProduct(id?: string): boolean {
  return isProductActive(id);
}

export function canStartProduct(id?: string): boolean {
  return isProductActive(id);
}

export function canPurchaseProduct(id?: string): boolean {
  return isProductActive(id);
}

export function canIndexProduct(id?: string): boolean {
  return isProductActive(id);
}

export function canReadHistoricalReport(id?: string): boolean {
  const product = getProductById(id);
  return product?.status === 'active' || product?.status === 'archived';
}

function normalizeRoute(pathname: string): string {
  const [path] = pathname.split(/[?#]/, 1);
  if (!path || path === '/') {
    return '/';
  }

  return path.replace(/\/+$/, '');
}

const productIdByRoute = new Map<string, ProductId>();

productIds.forEach((id) => {
  const { routes } = productRegistry[id];
  const productRoutes = [routes.detail, routes.intake, routes.report, routes.preview, ...(routes.supplemental ?? [])]
    .filter((route): route is string => Boolean(route));

  productRoutes.forEach((route) => {
    const normalizedRoute = normalizeRoute(route);
    const existingId = productIdByRoute.get(normalizedRoute);

    if (existingId && existingId !== id) {
      throw new Error(`Product route "${normalizedRoute}" is registered more than once.`);
    }

    productIdByRoute.set(normalizedRoute, id);
  });
});

export function getProductIdByRoute(pathname?: string): ProductId | undefined {
  return pathname ? productIdByRoute.get(normalizeRoute(pathname)) : undefined;
}

export function getProductByRoute(pathname?: string): ProductDefinition | undefined {
  const id = getProductIdByRoute(pathname);
  return id ? productRegistry[id] : undefined;
}
