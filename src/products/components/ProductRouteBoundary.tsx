import type { ReactNode } from 'react';
import NotFound from '../../pages/NotFound';
import { canStartProduct, getProductById } from '../registry';
import ProductUnavailable from './ProductUnavailable';

type ProductRouteBoundaryProps = {
  productId?: string;
  children: ReactNode;
};

export default function ProductRouteBoundary({ productId, children }: ProductRouteBoundaryProps) {
  const product = getProductById(productId);

  if (!product) {
    return <NotFound />;
  }

  if (!canStartProduct(product.id)) {
    return <ProductUnavailable product={product} />;
  }

  return children;
}
