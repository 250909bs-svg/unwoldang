import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { seoRouteData, type RouteSeo } from '../content/seoRouteRegistry';
import { canIndexProduct, getProductByRoute } from '../products/registry';

const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://www.unwoldang.com').replace(/\/$/, '');

const routeSeo = seoRouteData;
const defaultSeo = routeSeo['/'];

const noIndexPrefixes = ['/form/', '/preview/', '/report/', '/auth/', '/payment/'];
const noIndexPaths = new Set(['/checkout', '/loading', '/login', '/my', '/admin', '/search']);

function setMeta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);

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

function setLanguageAlternate(url: string) {
  const alternates = [
    { language: 'ko-KR', id: 'route-hreflang-ko' },
    { language: 'x-default', id: 'route-hreflang-default' }
  ];

  alternates.forEach(({ language, id }) => {
    let link = document.head.querySelector<HTMLLinkElement>(`#${id}`);

    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'alternate';
      document.head.appendChild(link);
    }

    link.hreflang = language;
    link.href = url;
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
  const robots = shouldNoIndex
    ? 'noindex,nofollow'
    : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

  return {
    path,
    seoPath,
    seo,
    seoProduct,
    productAllowsIndex,
    shouldNoIndex,
    canonicalPath,
    robots
  };
}

function buildStructuredData(path: string, seo: RouteSeo, canonicalUrl: string, imageUrl: string) {
  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: '운월당',
      legalName: '케이컴퍼니',
      url: `${SITE_URL}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/apple-touch-icon.png`,
        width: 180,
        height: 180
      },
      email: '250909bs@gmail.com',
      telephone: '050420111894',
      areaServed: 'KR',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '050420111894',
        email: '250909bs@gmail.com',
        contactType: 'customer support',
        areaServed: 'KR',
        availableLanguage: 'ko'
      }
    },
    {
      '@type': 'WebSite',
      '@id': websiteId,
      name: '운월당',
      alternateName: ['운월당 사주', 'Unwoldang'],
      url: `${SITE_URL}/`,
      inLanguage: 'ko-KR',
      publisher: { '@id': organizationId }
    },
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: seo.title,
      description: seo.description,
      dateModified: seo.lastmod,
      inLanguage: 'ko-KR',
      isPartOf: { '@id': websiteId },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: imageUrl,
        caption: seo.imageAlt || `${seo.heading} 대표 이미지`
      }
    }
  ];

  if (path === '/') {
    graph.push({
      '@type': 'ItemList',
      '@id': `${SITE_URL}/#service-list`,
      name: '운월당 대표 사주 리포트',
      itemListElement: Object.entries(routeSeo)
        .filter(([route, item]) => {
          const product = getProductByRoute(route);
          return route.startsWith('/detail/') && item.indexable && Boolean(product && canIndexProduct(product.id));
        })
        .map(([route, item], index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.productName || item.heading,
          url: `${SITE_URL}${route}`
        }))
    });
  } else {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '운월당',
          item: `${SITE_URL}/`
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: seo.heading,
          item: canonicalUrl
        }
      ]
    });
  }

  const product = getProductByRoute(path);

  if (product && canIndexProduct(product.id) && path.startsWith('/detail/') && seo.price && seo.priceCurrency) {
    graph.push({
      '@type': 'Product',
      '@id': `${canonicalUrl}#product`,
      name: seo.productName || seo.heading,
      description: seo.description,
      url: canonicalUrl,
      image: imageUrl,
      category: '개인 맞춤 사주 리포트',
      brand: { '@id': organizationId },
      offers: {
        '@type': 'Offer',
        url: canonicalUrl,
        price: String(seo.price),
        priceCurrency: seo.priceCurrency,
        availability: 'https://schema.org/InStock',
        seller: { '@id': organizationId }
      }
    });
  }

  if (seo.faqs?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonicalUrl}#faq`,
      mainEntity: seo.faqs.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer
        }
      }))
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph
  };
}

export default function Seo() {
  const location = useLocation();

  useEffect(() => {
    const { path, seoPath, seo, seoProduct, productAllowsIndex, canonicalPath, robots } =
      resolveSeoPolicy(location.pathname);
    const canonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`;
    const imageUrl = `${SITE_URL}${seo.image}`;

    document.documentElement.lang = 'ko';
    document.title = seo.title;
    setMeta('description', seo.description);
    setMeta('keywords', seo.keywords);
    setMeta('robots', robots);
    setMeta('googlebot', robots);
    setCanonical(canonicalUrl);
    setLanguageAlternate(canonicalUrl);

    setMeta('og:locale', 'ko_KR', 'property');
    setMeta('og:type', seoProduct && productAllowsIndex ? 'product' : 'website', 'property');
    setMeta('og:site_name', '운월당', 'property');
    setMeta('og:title', seo.title, 'property');
    setMeta('og:description', seo.description, 'property');
    setMeta('og:url', canonicalUrl, 'property');
    setMeta('og:image', imageUrl, 'property');
    setMeta('og:image:alt', seo.imageAlt || `${seo.heading} 대표 이미지`, 'property');
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', seo.title);
    setMeta('twitter:description', seo.description);
    setMeta('twitter:image', imageUrl);
    setMeta('twitter:image:alt', seo.imageAlt || `${seo.heading} 대표 이미지`);

    setStructuredData(buildStructuredData(seoPath ?? path, seo, canonicalUrl, imageUrl));
  }, [location.pathname]);

  return null;
}
