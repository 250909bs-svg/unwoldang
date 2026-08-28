import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  buildSeoDocument,
  type RouteSeoContent,
  type SeoDocument
} from '../content/seoDocument';
import seoRouteData from '../content/seoRoutes.json';
import { installBrowserAnalytics } from '../features/analytics';
import { activeProducts, canIndexProduct, getProductByRoute } from '../products/registry';

const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://www.unwoldang.com').replace(/\/$/, '');

const routeSeo = seoRouteData as Record<string, RouteSeoContent>;
const defaultSeo = routeSeo['/'];

const noIndexPrefixes = [
  '/form/',
  '/preview/',
  '/report/',
  '/auth/',
  '/payment/',
  '/admin/',
  '/my/'
];
const noIndexPaths = new Set(['/checkout', '/loading', '/login', '/my', '/admin', '/search']);

function setMeta(
  name: string,
  content: string | undefined,
  attribute: 'name' | 'property' = 'name'
) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);

  if (!content) {
    tag?.remove();
    return;
  }

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }

  link.href = url;
}

function setLanguageAlternates(alternates: SeoDocument['alternates']) {
  alternates.forEach(({ href, hreflang, id }) => {
    let link = document.head.querySelector<HTMLLinkElement>(`#${id}`);

    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'alternate';
      document.head.appendChild(link);
    }

    link.hreflang = hreflang;
    link.href = href;
  });
}

function setStructuredData(data: unknown) {
  let script = document.head.querySelector<HTMLScriptElement>('#route-structured-data');

  if (!script) {
    script = document.createElement('script');
    script.id = 'route-structured-data';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
}

function normalizePath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
}

function resolveSeoPath(path: string) {
  if (routeSeo[path]) {
    return path;
  }

  const product = getProductByRoute(path);

  if (!product) {
    return undefined;
  }

  const isProductAlias =
    path === product.routes.intake ||
    path === product.routes.report ||
    path === product.routes.preview;

  return isProductAlias ? product.routes.detail : undefined;
}

export function resolveSeoPolicy(pathname: string) {
  const path = normalizePath(pathname);
  const seoPath = resolveSeoPath(path);
  const seo = seoPath ? routeSeo[seoPath] ?? defaultSeo : defaultSeo;
  const seoProduct = seoPath ? getProductByRoute(seoPath) : undefined;
  const isKnownPage = Boolean(seoPath);
  const productAllowsIndex = !seoProduct || canIndexProduct(seoProduct.id);
  const shouldNoIndex =
    !isKnownPage ||
    !seo.indexable ||
    !productAllowsIndex ||
    noIndexPaths.has(path) ||
    noIndexPrefixes.some((prefix) => path.startsWith(prefix));
  const canonicalPath = seoPath ?? '/';

  return {
    path,
    seoPath,
    seo,
    seoProduct,
    productAllowsIndex,
    shouldNoIndex,
    canonicalPath,
    robots: shouldNoIndex
      ? 'noindex,nofollow'
      : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
  };
}

export default function Seo() {
  const location = useLocation();

  useEffect(
    () =>
      installBrowserAnalytics({
        pathname: location.pathname,
        navigationKey: location.key
      }),
    [location.key, location.pathname]
  );

  useEffect(() => {
    const { path, seo, seoProduct, canonicalPath, shouldNoIndex } = resolveSeoPolicy(
      location.pathname
    );
    const seoDocument = buildSeoDocument({
      siteUrl: SITE_URL,
      requestedPath: path,
      canonicalPath,
      seo,
      product: seoProduct,
      activeProducts,
      shouldNoIndex
    });

    document.documentElement.lang = 'ko';
    document.title = seoDocument.title;
    setMeta('description', seoDocument.description);
    setMeta('keywords', seoDocument.keywords);
    setMeta('robots', seoDocument.robots);
    setMeta('googlebot', seoDocument.robots);
    setCanonical(seoDocument.canonicalUrl);
    setLanguageAlternates(seoDocument.alternates);

    setMeta('og:locale', 'ko_KR', 'property');
    setMeta('og:type', seoDocument.openGraph.type, 'property');
    setMeta('og:site_name', '운월당', 'property');
    setMeta('og:title', seoDocument.openGraph.title, 'property');
    setMeta('og:description', seoDocument.openGraph.description, 'property');
    setMeta('og:url', seoDocument.openGraph.url, 'property');
    setMeta('og:image', seoDocument.openGraph.image, 'property');
    setMeta('og:image:alt', seoDocument.openGraph.imageAlt, 'property');
    setMeta('product:price:amount', seoDocument.openGraph.priceAmount, 'property');
    setMeta('product:price:currency', seoDocument.openGraph.priceCurrency, 'property');
    setMeta('twitter:card', seoDocument.twitter.card);
    setMeta('twitter:title', seoDocument.twitter.title);
    setMeta('twitter:description', seoDocument.twitter.description);
    setMeta('twitter:image', seoDocument.twitter.image);
    setMeta('twitter:image:alt', seoDocument.twitter.imageAlt);

    setStructuredData(seoDocument.structuredData);
  }, [location.pathname]);

  return null;
}
