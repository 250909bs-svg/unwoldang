import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://www.unwoldang.com';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const routesFile = path.join(rootDir, 'src', 'content', 'seoRoutes.json');
const templateFile = path.join(distDir, 'index.html');
const publicSitemapFile = path.join(rootDir, 'public', 'sitemap.xml');
const distSitemapFile = path.join(distDir, 'sitemap.xml');

const routes = JSON.parse(await readFile(routesFile, 'utf8'));
const template = await readFile(templateFile, 'utf8');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceMeta(html, attribute, name, content) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${escapeRegExp(name)}"[^>]*>`, 'i');
  const replacement = `<meta ${attribute}="${name}" content="${escapeHtml(content)}" />`;

  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `  ${replacement}\n  </head>`);
}

function replaceLink(html, relation, replacement) {
  const pattern = new RegExp(`<link\\s+[^>]*rel="${escapeRegExp(relation)}"[^>]*>`, 'i');
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `  ${replacement}\n  </head>`);
}

function routeFileName(route) {
  return route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
}

function breadcrumbData(route, seo, canonicalUrl) {
  if (route === '/') {
    return null;
  }

  return {
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
  };
}

function buildStructuredData(route, seo) {
  const canonicalUrl = `${SITE_URL}${route === '/' ? '/' : route}`;
  const imageUrl = `${SITE_URL}${seo.image}`;
  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;
  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: seo.title,
      description: seo.description,
      inLanguage: 'ko-KR',
      isPartOf: { '@id': websiteId },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: imageUrl
      }
    }
  ];

  if (route === '/') {
    graph.unshift(
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
        areaServed: 'KR'
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
        '@type': 'ItemList',
        '@id': `${SITE_URL}/#service-list`,
        name: '운월당 개인 맞춤 사주 리포트',
        itemListElement: Object.entries(routes)
          .filter(([pathName, item]) => pathName.startsWith('/detail/') && item.indexable)
          .map(([pathName, item], index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.heading,
            url: `${SITE_URL}${pathName}`
          }))
      }
    );
  } else {
    graph.push(breadcrumbData(route, seo, canonicalUrl));
  }

  if (route.startsWith('/detail/')) {
    graph.push({
      '@type': 'Service',
      '@id': `${canonicalUrl}#service`,
      name: seo.heading,
      serviceType: '개인 맞춤 사주 리포트',
      description: seo.description,
      url: canonicalUrl,
      image: imageUrl,
      areaServed: 'KR',
      availableLanguage: 'ko-KR',
      provider: { '@id': organizationId }
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph.filter(Boolean)
  };
}

function buildFallback(route, seo) {
  const serviceLinks = Object.entries(routes)
    .filter(([pathName, item]) => pathName.startsWith('/detail/') && item.indexable)
    .map(([pathName, item]) => `<a href="${pathName}">${escapeHtml(item.heading)}</a>`)
    .join('');
  const highlights = seo.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  return `<main class="seo-static-fallback">
    <a class="seo-static-brand" href="/">운월당</a>
    <article>
      <p class="seo-static-kicker">만세력 기반 개인 맞춤 사주 리포트</p>
      <h1>${escapeHtml(seo.heading)}</h1>
      <p>${escapeHtml(seo.intro)}</p>
      <ul>${highlights}</ul>
      ${route.startsWith('/detail/') ? `<a class="seo-static-action" href="/form/${route.split('/').at(-1)}">개인 리포트 입력 시작</a>` : ''}
    </article>
    <nav aria-label="운월당 주요 사주 리포트">${serviceLinks}</nav>
  </main>`;
}

function buildPage(route, seo) {
  const canonicalUrl = `${SITE_URL}${route === '/' ? '/' : route}`;
  const imageUrl = `${SITE_URL}${seo.image}`;
  const robots = seo.indexable
    ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    : 'noindex,nofollow';
  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`);
  html = replaceMeta(html, 'name', 'description', seo.description);
  html = replaceMeta(html, 'name', 'keywords', seo.keywords);
  html = replaceMeta(html, 'name', 'robots', robots);
  html = replaceMeta(html, 'name', 'googlebot', robots);
  html = replaceMeta(html, 'property', 'og:type', route.startsWith('/detail/') ? 'product' : 'website');
  html = replaceMeta(html, 'property', 'og:title', seo.title);
  html = replaceMeta(html, 'property', 'og:description', seo.description);
  html = replaceMeta(html, 'property', 'og:url', canonicalUrl);
  html = replaceMeta(html, 'property', 'og:image', imageUrl);
  html = replaceMeta(html, 'property', 'og:image:alt', `${seo.heading} 대표 이미지`);
  html = replaceMeta(html, 'name', 'twitter:title', seo.title);
  html = replaceMeta(html, 'name', 'twitter:description', seo.description);
  html = replaceMeta(html, 'name', 'twitter:image', imageUrl);
  html = replaceLink(html, 'canonical', `<link rel="canonical" href="${canonicalUrl}" />`);
  html = html.replace(
    /<link\s+id="route-hreflang-ko"[^>]*>/i,
    `<link id="route-hreflang-ko" rel="alternate" hreflang="ko-KR" href="${canonicalUrl}" />`
  );
  html = html.replace(
    /<link\s+id="route-hreflang-default"[^>]*>/i,
    `<link id="route-hreflang-default" rel="alternate" hreflang="x-default" href="${canonicalUrl}" />`
  );
  html = html.replace(
    /<script\s+id="route-structured-data"[^>]*>[\s\S]*?<\/script>/i,
    `<script id="route-structured-data" type="application/ld+json">${JSON.stringify(buildStructuredData(route, seo)).replaceAll('<', '\\u003c')}</script>`
  );
  html = html.replace('<div id="root"></div>', `<div id="root">${buildFallback(route, seo)}</div>`);

  return html;
}

function buildSitemap() {
  const urls = Object.entries(routes)
    .filter(([, seo]) => seo.indexable)
    .map(([route, seo]) => `  <url>\n    <loc>${SITE_URL}${route === '/' ? '/' : route}</loc>\n    <lastmod>${seo.lastmod}</lastmod>\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function validatePage(route, seo, html) {
  const canonicalUrl = `${SITE_URL}${route === '/' ? '/' : route}`;
  const structuredDataMatch = html.match(
    /<script\s+id="route-structured-data"[^>]*>([\s\S]*?)<\/script>/i
  );
  const requiredFragments = [
    `<title>${escapeHtml(seo.title)}</title>`,
    `rel="canonical" href="${canonicalUrl}"`,
    `<h1>${escapeHtml(seo.heading)}</h1>`,
    'class="seo-static-fallback"',
    'name="robots" content="index,follow'
  ];

  if (seo.title.length < 10 || seo.title.length > 60) {
    throw new Error(`SEO title length is invalid for ${route}: ${seo.title.length}`);
  }

  if (seo.description.length < 50 || seo.description.length > 180) {
    throw new Error(`SEO description length is invalid for ${route}: ${seo.description.length}`);
  }

  requiredFragments.forEach((fragment) => {
    if (!html.includes(fragment)) {
      throw new Error(`SEO output is missing "${fragment}" for ${route}`);
    }
  });

  if (!structuredDataMatch) {
    throw new Error(`Structured data is missing for ${route}`);
  }

  JSON.parse(structuredDataMatch[1]);
}

await mkdir(path.join(distDir, 'seo'), { recursive: true });

const seenTitles = new Set();
const seenDescriptions = new Set();

for (const [route, seo] of Object.entries(routes)) {
  if (!seo.indexable) {
    continue;
  }

  const html = buildPage(route, seo);
  const outputFile = route === '/' ? templateFile : path.join(distDir, 'seo', `${routeFileName(route)}.html`);

  if (seenTitles.has(seo.title) || seenDescriptions.has(seo.description)) {
    throw new Error(`Duplicate SEO title or description detected for ${route}`);
  }

  seenTitles.add(seo.title);
  seenDescriptions.add(seo.description);
  await access(path.join(rootDir, 'public', seo.image.replace(/^\//, '')));
  validatePage(route, seo, html);
  await writeFile(outputFile, html, 'utf8');
}

const sitemap = buildSitemap();
await writeFile(publicSitemapFile, sitemap, 'utf8');
await writeFile(distSitemapFile, sitemap, 'utf8');

console.log(`Generated ${Object.values(routes).filter((route) => route.indexable).length} SEO pages and sitemap.xml`);
