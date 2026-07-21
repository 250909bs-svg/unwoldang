import type { ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { readPendingPayment } from '../../lib/auth';
import { isValidPaymentOrderId } from '../../lib/reportAccessGate';
import NotFound from '../../pages/NotFound';
import {
  canPurchaseProduct,
  canReadHistoricalReport,
  canStartProduct,
  getProductById
} from '../registry';
import ProductUnavailable from './ProductUnavailable';

type ProductBoundaryProps = {
  children: ReactNode;
  productId?: string;
};

export type RecoveredEntitlementState = {
  orderId: string;
  reportAccessToken: string;
};

type ProductFlowLocationState = {
  product?: string;
  orderId?: string;
  reportAccessToken?: unknown;
  reportData?: unknown;
  recoveredEntitlement?: RecoveredEntitlementState;
};

export function hasNonEmptyReportAccessToken(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function UnknownOrUnavailable({ productId }: { productId?: string }) {
  const product = getProductById(productId);
  return product ? <ProductUnavailable product={product} /> : <NotFound />;
}

export function canResumeArchivedIntake(
  productId?: string,
  recoveredEntitlement?: RecoveredEntitlementState
) {
  const product = getProductById(productId);
  const token = recoveredEntitlement?.reportAccessToken;

  return Boolean(
    product?.status === 'archived' &&
      canReadHistoricalReport(product.id) &&
      isValidPaymentOrderId(recoveredEntitlement?.orderId) &&
      typeof token === 'string' &&
      token.trim().length >= 40
  );
}

export function ProductIntakeRouteBoundary({ children, productId: explicitProductId }: ProductBoundaryProps) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const locationState = (location.state as ProductFlowLocationState | null) ?? null;
  const productId = explicitProductId || id;

  if (canStartProduct(productId)) {
    return children;
  }

  if (canResumeArchivedIntake(productId, locationState?.recoveredEntitlement)) {
    return children;
  }

  return <UnknownOrUnavailable productId={productId} />;
}

export function ProductCheckoutRouteBoundary({ children }: ProductBoundaryProps) {
  const location = useLocation();
  const locationState = (location.state as ProductFlowLocationState | null) ?? null;
  const pendingPayment = readPendingPayment();
  const productId = locationState?.product || pendingPayment?.productId;

  if (!canPurchaseProduct(productId)) {
    return <UnknownOrUnavailable productId={productId} />;
  }

  return children;
}

export function ProductLoadingRouteBoundary({ children }: ProductBoundaryProps) {
  const location = useLocation();
  const locationState = (location.state as ProductFlowLocationState | null) ?? null;
  const pendingPayment = readPendingPayment();
  const productId = locationState?.product || pendingPayment?.productId;
  const product = getProductById(productId);

  if (!product) {
    return <NotFound />;
  }

  if (canStartProduct(product.id)) {
    return children;
  }

  const orderId = locationState?.orderId || pendingPayment?.orderId;
  const reportAccessToken = locationState?.reportAccessToken || pendingPayment?.reportAccessToken;
  const hasHistoricalEntitlement =
    canReadHistoricalReport(product.id) &&
    isValidPaymentOrderId(orderId) &&
    (hasNonEmptyReportAccessToken(reportAccessToken) || Boolean(locationState?.reportData));

  return hasHistoricalEntitlement ? children : <ProductUnavailable product={product} />;
}

export function HistoricalReportRouteBoundary({ children }: ProductBoundaryProps) {
  const { id } = useParams<{ id: string }>();
  const product = getProductById(id);

  if (!product) {
    return <NotFound />;
  }

  if (!canReadHistoricalReport(product.id)) {
    return <ProductUnavailable product={product} />;
  }

  return children;
}
