import type { ProductDefinition } from '../products/types';

export const INDEX_ROBOTS =
  'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
export const NOINDEX_ROBOTS = 'noindex,nofollow';

export type RouteSeoContent = {
  title: string;
  description: string;
  keywords: string;
  image: string;
  imageAlt?: string;
  heading: string;
  intro: string;
  highlights: string[];
  sections?: Array<{ heading: string; body: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  indexable: boolean;
  lastmod: string;
};

type LanguageAlternate = {
  id: 'route-hreflang-ko' | 'route-hreflang-default';
  hreflang: 'ko-KR' | 'x-default';
  href: string;
};

export type SeoDocument = {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  imageUrl: string;
  imageAlt: string;
  robots: string;
  openGraph: {
    type: 'product' | 'website';
    title: string;
    description: string;
    url: string;
    image: string;
    imageAlt: string;
    priceAmount?: string;
    priceCurrency?: string;
  };
  twitter: {
    card: 'summary_large_image';
    title: string;
    description: string;
    image: string;
    imageAlt: string;
  };
  alternates: LanguageAlternate[];
  structuredData: {
    '@context': 'https://schema.org';
    '@graph': Record<string, unknown>[];
  };
  isCanonicalActiveDetail: boolean;
};

type BuildSeoDocumentInput = {
  siteUrl: string;
  requestedPath: string;
  canonicalPath: string;
  seo: RouteSeoContent;
  product?: ProductDefinition;
  activeProducts: readonly ProductDefinition[];
  shouldNoIndex: boolean;
};

function normalizeSiteUrl(siteUrl: string) {
  return siteUrl.replace(/\/+$/, '');
}

function absoluteUrl(siteUrl: string, value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`;
}

function canonicalUrlForPath(siteUrl: string, canonicalPath: string) {
  return canonicalPath === '/' ? `${siteUrl}/` : absoluteUrl(siteUrl, canonicalPath);
}

export function buildSeoDocument({
  siteUrl,
  requestedPath,
  canonicalPath,
  seo,
  product,
  activeProducts,
  shouldNoIndex
}: BuildSeoDocumentInput): SeoDocument {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const canonicalUrl = canonicalUrlForPath(normalizedSiteUrl, canonicalPath);
  const effectiveNoIndex = Boolean(
    shouldNoIndex ||
      !seo.indexable ||
      (product &&
        (product.status !== 'active' ||
          requestedPath !== product.routes.detail ||
          canonicalPath !== product.routes.detail))
  );
  const isCanonicalActiveDetail = Boolean(
    !effectiveNoIndex &&
      product?.status === 'active' &&
      requestedPath === canonicalPath &&
      canonicalPath === product.routes.detail
  );
  const socialTitle = product?.displayName ?? seo.title;
  const socialImage = product?.search.image ?? seo.image;
  const imageUrl = absoluteUrl(normalizedSiteUrl, socialImage);
  const imageAlt = seo.imageAlt || `${socialTitle} 대표 이미지`;
  const organizationId = `${normalizedSiteUrl}/#organization`;
  const websiteId = `${normalizedSiteUrl}/#website`;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: '운월당',
      legalName: '케이컴퍼니',
      url: `${normalizedSiteUrl}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${normalizedSiteUrl}/apple-touch-icon.png`,
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
      url: `${normalizedSiteUrl}/`,
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
        caption: imageAlt
      }
    }
  ];

  if (!effectiveNoIndex && requestedPath === '/' && canonicalPath === '/') {
    graph.push({
      '@type': 'ItemList',
      '@id': `${normalizedSiteUrl}/#service-list`,
      name: '운월당 대표 사주 리포트',
      itemListElement: activeProducts.map((activeProduct, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: activeProduct.displayName,
        url: absoluteUrl(normalizedSiteUrl, activeProduct.routes.detail)
      }))
    });
  } else if (canonicalPath !== '/') {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '운월당',
          item: `${normalizedSiteUrl}/`
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

  if (isCanonicalActiveDetail && product) {
    graph.push({
      '@type': 'Product',
      '@id': `${canonicalUrl}#product`,
      sku: product.id,
      name: product.displayName,
      description: seo.description,
      url: canonicalUrl,
      image: imageUrl,
      category: '개인 맞춤 사주 리포트',
      brand: { '@id': organizationId },
      offers: {
        '@type': 'Offer',
        url: canonicalUrl,
        price: String(product.price),
        priceCurrency: product.currency,
        availability: 'https://schema.org/InStock',
        seller: { '@id': organizationId }
      }
    });

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
  }

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    canonicalUrl,
    imageUrl,
    imageAlt,
    robots: effectiveNoIndex ? NOINDEX_ROBOTS : INDEX_ROBOTS,
    openGraph: {
      type: isCanonicalActiveDetail ? 'product' : 'website',
      title: socialTitle,
      description: seo.description,
      url: canonicalUrl,
      image: imageUrl,
      imageAlt,
      priceAmount: isCanonicalActiveDetail && product ? String(product.price) : undefined,
      priceCurrency: isCanonicalActiveDetail && product ? product.currency : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: seo.description,
      image: imageUrl,
      imageAlt
    },
    alternates: [
      { id: 'route-hreflang-ko', hreflang: 'ko-KR', href: canonicalUrl },
      { id: 'route-hreflang-default', hreflang: 'x-default', href: canonicalUrl }
    ],
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': graph
    },
    isCanonicalActiveDetail
  };
}
