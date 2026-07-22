import { getProductByRoute, isProductActive } from '../../products/registry';
import type { ProductDefinition } from '../../products/types';
import type { AnalyticsPlacement } from './taxonomy';
import { captureSessionAttribution } from './attribution';
import { trackAnalyticsEvent } from './core';

export interface InstallBrowserAnalyticsOptions {
  pathname: string;
  navigationKey: string;
}

const handledClickEvents = new WeakSet<Event>();
const attributedDocuments = new WeakSet<Document>();
const navigationVisits = new Map<
  string,
  { token: number; mountCount: number; releaseTimer?: ReturnType<typeof setTimeout> }
>();
let nextNavigationVisitToken = 1;

function acquireNavigationVisit(navigationIdentity: string) {
  let visit = navigationVisits.get(navigationIdentity);
  if (visit) {
    if (visit.releaseTimer) {
      clearTimeout(visit.releaseTimer);
      visit.releaseTimer = undefined;
    }
    visit.mountCount += 1;
  } else {
    visit = { token: nextNavigationVisitToken, mountCount: 1 };
    nextNavigationVisitToken += 1;
    navigationVisits.set(navigationIdentity, visit);
  }

  let released = false;
  return {
    token: visit.token,
    release() {
      if (released) {
        return;
      }
      released = true;
      visit.mountCount -= 1;
      if (visit.mountCount === 0) {
        visit.releaseTimer = setTimeout(() => {
          if (visit?.mountCount === 0) {
            navigationVisits.delete(navigationIdentity);
          }
        }, 0);
      }
    }
  };
}

function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function getCanonicalActiveDetailProduct(
  pathname: string
): ProductDefinition | undefined {
  const normalized = normalizePathname(pathname);
  const product = getProductByRoute(normalized);
  return product && isProductActive(product.id) && normalizePathname(product.routes.detail) === normalized
    ? product
    : undefined;
}

function getBrowserDocument(): Document | undefined {
  return typeof document === 'undefined' ? undefined : document;
}

function getBrowserLocation(): Location | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.location;
  } catch {
    return undefined;
  }
}

function resolveActiveDetailLink(
  anchor: Element,
  documentRef: Document,
  locationRef?: Location
): ProductDefinition | undefined {
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) {
    return undefined;
  }

  try {
    const baseUrl = locationRef?.href || documentRef.baseURI;
    const url = new URL(href, baseUrl);
    if (locationRef?.origin && url.origin !== locationRef.origin) {
      return undefined;
    }
    return getCanonicalActiveDetailProduct(url.pathname);
  } catch {
    return undefined;
  }
}

function getPlacement(anchor: Element, pathname: string): AnalyticsPlacement {
  const declared = anchor.getAttribute('data-analytics-placement');
  if (
    declared === 'home' ||
    declared === 'menu' ||
    declared === 'search' ||
    declared === 'recommendation' ||
    declared === 'report' ||
    declared === 'navigation'
  ) {
    return declared;
  }

  if (anchor.closest('nav')) {
    return 'navigation';
  }

  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath === '/') {
    return 'home';
  }
  if (normalizedPath === '/search') {
    return 'search';
  }
  if (normalizedPath.startsWith('/report/')) {
    return 'report';
  }
  return 'recommendation';
}

function findAnchor(target: EventTarget | null): Element | undefined {
  if (!target || typeof target !== 'object') {
    return undefined;
  }

  const closest = (target as { closest?: unknown }).closest;
  return typeof closest === 'function'
    ? ((closest as (selector: string) => Element | null).call(target, 'a[href]') ?? undefined)
    : undefined;
}

function installProductClickTracking(
  documentRef: Document,
  locationRef: Location | undefined,
  pathname: string
): () => void {
  const handleClick = (event: Event) => {
    if (handledClickEvents.has(event)) {
      return;
    }

    const anchor = findAnchor(event.target);
    if (!anchor) {
      return;
    }

    const product = resolveActiveDetailLink(anchor, documentRef, locationRef);
    if (!product) {
      return;
    }

    handledClickEvents.add(event);
    trackAnalyticsEvent('product_click', {
      productId: product.id,
      placement: getPlacement(anchor, pathname)
    });
  };

  // Bubble phase respects stopPropagation from drag UI. React Router Link calls
  // preventDefault for successful client navigation, so defaultPrevented alone
  // must not suppress a legitimate product click.
  documentRef.addEventListener('click', handleClick);
  return () => documentRef.removeEventListener('click', handleClick);
}

function installProductImpressionTracking(
  documentRef: Document,
  locationRef: Location | undefined,
  pathname: string,
  lifecycleKey: string
): () => void {
  const Observer = documentRef.defaultView?.IntersectionObserver ?? globalThis.IntersectionObserver;
  if (typeof Observer !== 'function') {
    return () => undefined;
  }

  let disposed = false;
  const nextPositionByPlacement = new Map<AnalyticsPlacement, number>();
  const seenAnchors = new WeakSet<Element>();
  const productsByAnchor = new Map<
    Element,
    { product: ProductDefinition; placement: AnalyticsPlacement; position: number }
  >();
  const observer = new Observer(
    (entries) => {
      if (disposed) {
        return;
      }

      entries.forEach((entry) => {
        if (!entry.isIntersecting && entry.intersectionRatio <= 0) {
          return;
        }

        const item = productsByAnchor.get(entry.target);
        if (!item) {
          return;
        }

        trackAnalyticsEvent(
          'product_impression',
          {
            productId: item.product.id,
            placement: item.placement,
            position: item.position
          },
          {
            dedupeKey: `impression:${lifecycleKey}:placement:${item.placement}:product:${item.product.id}`
          }
        );
        observer.unobserve(entry.target);
        productsByAnchor.delete(entry.target);
      });
    },
    { threshold: 0.25 }
  );

  const observeAnchor = (anchor: Element) => {
    if (disposed || seenAnchors.has(anchor)) {
      return;
    }
    seenAnchors.add(anchor);

    const product = resolveActiveDetailLink(anchor, documentRef, locationRef);
    if (!product) {
      return;
    }

    const placement = getPlacement(anchor, pathname);
    const position = (nextPositionByPlacement.get(placement) ?? 0) + 1;
    nextPositionByPlacement.set(placement, position);
    productsByAnchor.set(anchor, { product, placement, position });
    observer.observe(anchor);
  };

  const scanForProductLinks = (root: Document | Element) => {
    if ('matches' in root && root.matches('a[href]')) {
      observeAnchor(root);
    }
    root.querySelectorAll('a[href]').forEach(observeAnchor);
  };

  scanForProductLinks(documentRef);

  const MutationObserverConstructor =
    documentRef.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  const mutationObserver =
    typeof MutationObserverConstructor === 'function'
      ? new MutationObserverConstructor((records) => {
          records.forEach((record) => {
            record.addedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                scanForProductLinks(node as Element);
              }
            });
          });
        })
      : undefined;

  if (mutationObserver && documentRef.documentElement) {
    mutationObserver.observe(documentRef.documentElement, { childList: true, subtree: true });
  }

  return () => {
    disposed = true;
    mutationObserver?.disconnect();
    observer.disconnect();
    productsByAnchor.clear();
  };
}

/**
 * Installs route and product-discovery analytics for one router navigation.
 * The returned cleanup is safe to call repeatedly and is StrictMode-friendly.
 */
export function installBrowserAnalytics({
  pathname,
  navigationKey
}: InstallBrowserAnalyticsOptions): () => void {
  const normalizedPath = normalizePathname(pathname);
  const documentRef = getBrowserDocument();
  const locationRef = getBrowserLocation();
  const navigationIdentity = navigationKey || normalizedPath;
  const navigationVisit = acquireNavigationVisit(navigationIdentity);
  const lifecycleKey = `navigation:${navigationIdentity}:visit:${navigationVisit.token}`;
  const isFirstDocumentCapture = Boolean(
    documentRef && !attributedDocuments.has(documentRef)
  );
  if (documentRef) {
    attributedDocuments.add(documentRef);
  }

  captureSessionAttribution({
    pathname: normalizedPath,
    search: locationRef?.search || '',
    referrer: isFirstDocumentCapture ? documentRef?.referrer || '' : '',
    currentHostname: locationRef?.hostname
  });

  if (normalizedPath === '/') {
    trackAnalyticsEvent('home_view', {}, { dedupeKey: lifecycleKey });
  } else {
    const product = getCanonicalActiveDetailProduct(normalizedPath);
    if (product) {
      trackAnalyticsEvent(
        'detail_view',
        { productId: product.id },
        { dedupeKey: lifecycleKey }
      );
    }
  }

  if (!documentRef) {
    return navigationVisit.release;
  }

  const removeClickTracking = installProductClickTracking(documentRef, locationRef, normalizedPath);
  const removeImpressionTracking = installProductImpressionTracking(
    documentRef,
    locationRef,
    normalizedPath,
    lifecycleKey
  );
  let disposed = false;

  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    removeClickTracking();
    removeImpressionTracking();
    navigationVisit.release();
  };
}
