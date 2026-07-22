import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const SITE_URL = 'https://www.unwoldang.com';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const routes = JSON.parse(await readFile(path.join(rootDir, 'src/content/seoRoutes.json'), 'utf8'));
const templateFile = path.join(distDir, 'index.html');
const template = await readFile(templateFile, 'utf8');
const publicSitemapFile = path.join(rootDir, 'public/sitemap.xml');
const distSitemapFile = path.join(distDir, 'sitemap.xml');
const moduleServer = await createServer({
  root: rootDir,
  configFile: false,
  logLevel: 'silent',
  server: { middlewareMode: true },
  appType: 'custom'
});

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
  return pattern.test(html)
    ? html.replace(pattern, replacement)
    : html.replace('</head>', `  ${replacement}\n  </head>`);
}

function replaceOptionalMeta(html, attribute, name, content) {
  if (content) return replaceMeta(html, attribute, name, content);
  return html.replace(
    new RegExp(`\\s*<meta\\s+${attribute}="${escapeRegExp(name)}"[^>]*>`, 'i'),
    ''
  );
}

function replaceLink(html, relation, replacement) {
  const pattern = new RegExp(`<link\\s+[^>]*rel="${escapeRegExp(relation)}"[^>]*>`, 'i');
  return pattern.test(html)
    ? html.replace(pattern, replacement)
    : html.replace('</head>', `  ${replacement}\n  </head>`);
}

function routeFileName(route) {
  return route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
}

try {
  const [{ activeProducts, getProductByRoute }, { buildSeoDocument }] = await Promise.all([
    moduleServer.ssrLoadModule('/src/products/registry.ts'),
    moduleServer.ssrLoadModule('/src/content/seoDocument.ts')
  ]);

  const isIndexableRoute = (route, seo) => {
    if (!seo.indexable) return false;
    if (!route.startsWith('/detail/')) return true;
    const product = getProductByRoute(route);
    return Boolean(product?.status === 'active' && product.routes.detail === route);
  };
  const getIndexableRouteEntries = () =>
    Object.entries(routes).filter(([route, seo]) => isIndexableRoute(route, seo));
  const createSeoDocument = (route, seo) => {
    const product = getProductByRoute(route);
    return buildSeoDocument({
      siteUrl: SITE_URL,
      requestedPath: route,
      canonicalPath: product?.routes.detail ?? route,
      seo,
      product,
      activeProducts,
      shouldNoIndex: false
    });
  };

  function buildFallback(route, seo, seoDocument) {
    const links = activeProducts
      .map((product) => `<a href="${product.routes.detail}">${escapeHtml(product.displayName)}</a>`)
      .join('');
    const highlights = seo.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const sections = (seo.sections || [])
      .map((item) => `<section class="seo-static-section"><h2>${escapeHtml(item.heading)}</h2><p>${escapeHtml(item.body)}</p></section>`)
      .join('');
    const faqItems = (seo.faqs || [])
      .map((item) => `<div><dt>${escapeHtml(item.question)}</dt><dd>${escapeHtml(item.answer)}</dd></div>`)
      .join('');
    const product = getProductByRoute(route);
    const action = seoDocument.isCanonicalActiveDetail && product
      ? `<a class="seo-static-action" href="${product.routes.intake}">개인 리포트 입력 시작</a>`
      : '';
    return `<main class="seo-static-fallback">
    <a class="seo-static-brand" href="/">운월당</a>
    <article>
      <p class="seo-static-kicker">만세력 기반 개인 맞춤 사주 리포트</p>
      <h1>${escapeHtml(seo.heading)}</h1>
      <p>${escapeHtml(seo.intro)}</p>
      <ul>${highlights}</ul>
      ${action}
      ${sections ? `<div class="seo-static-sections">${sections}</div>` : ''}
      ${faqItems ? `<section class="seo-static-faq"><h2>자주 묻는 질문</h2><dl>${faqItems}</dl></section>` : ''}
    </article>
    <nav aria-label="운월당 주요 사주 리포트">${links}</nav>
  </main>`;
  }

  function buildPage(route, seo) {
    const doc = createSeoDocument(route, seo);
    let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(doc.title)}</title>`);
    html = replaceMeta(html, 'name', 'description', doc.description);
    html = replaceMeta(html, 'name', 'keywords', doc.keywords);
    html = replaceMeta(html, 'name', 'robots', doc.robots);
    html = replaceMeta(html, 'name', 'googlebot', doc.robots);
    html = replaceMeta(html, 'property', 'og:locale', 'ko_KR');
    html = replaceMeta(html, 'property', 'og:site_name', '운월당');
    html = replaceMeta(html, 'property', 'og:type', doc.openGraph.type);
    html = replaceMeta(html, 'property', 'og:title', doc.openGraph.title);
    html = replaceMeta(html, 'property', 'og:description', doc.openGraph.description);
    html = replaceMeta(html, 'property', 'og:url', doc.openGraph.url);
    html = replaceMeta(html, 'property', 'og:image', doc.openGraph.image);
    html = replaceMeta(html, 'property', 'og:image:alt', doc.openGraph.imageAlt);
    html = replaceOptionalMeta(html, 'property', 'product:price:amount', doc.openGraph.priceAmount);
    html = replaceOptionalMeta(html, 'property', 'product:price:currency', doc.openGraph.priceCurrency);
    html = replaceMeta(html, 'name', 'twitter:card', doc.twitter.card);
    html = replaceMeta(html, 'name', 'twitter:title', doc.twitter.title);
    html = replaceMeta(html, 'name', 'twitter:description', doc.twitter.description);
    html = replaceMeta(html, 'name', 'twitter:image', doc.twitter.image);
    html = replaceMeta(html, 'name', 'twitter:image:alt', doc.twitter.imageAlt);
    html = replaceLink(html, 'canonical', `<link rel="canonical" href="${doc.canonicalUrl}" />`);
    doc.alternates.forEach((alternate) => {
      const pattern = new RegExp(`<link\\s+id="${alternate.id}"[^>]*>`, 'i');
      const replacement = `<link id="${alternate.id}" rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}" />`;
      html = pattern.test(html)
        ? html.replace(pattern, replacement)
        : html.replace('</head>', `  ${replacement}\n  </head>`);
    });
    html = html.replace(
      /<script\s+id="route-structured-data"[^>]*>[\s\S]*?<\/script>/i,
      `<script id="route-structured-data" type="application/ld+json">${JSON.stringify(doc.structuredData).replaceAll('<', '\\u003c')}</script>`
    );
    html = html.replace('<div id="root"></div>', `<div id="root">${buildFallback(route, seo, doc)}</div>`);
    return { html, doc };
  }
  function validatePage(route, seo, html, doc) {
    if (seo.title.length < 10 || seo.title.length > 60) throw new Error(`SEO title length is invalid for ${route}: ${seo.title.length}`);
    if (seo.description.length < 50 || seo.description.length > 180) throw new Error(`SEO description length is invalid for ${route}: ${seo.description.length}`);
    [`<title>${escapeHtml(doc.title)}</title>`, `rel="canonical" href="${doc.canonicalUrl}"`, `<h1>${escapeHtml(seo.heading)}</h1>`, 'class="seo-static-fallback"', 'id="app-boot-guard"', 'name="robots" content="index,follow'].forEach((fragment) => {
      if (!html.includes(fragment)) throw new Error(`SEO output is missing "${fragment}" for ${route}`);
    });
    [
      `<meta property="og:type" content="${doc.openGraph.type}" />`,
      `<meta property="og:title" content="${escapeHtml(doc.openGraph.title)}" />`,
      `<meta property="og:url" content="${doc.openGraph.url}" />`,
      `<meta property="og:image" content="${doc.openGraph.image}" />`,
      `<meta name="twitter:card" content="${doc.twitter.card}" />`,
      `<meta name="twitter:title" content="${escapeHtml(doc.twitter.title)}" />`,
      `<meta name="twitter:image" content="${doc.twitter.image}" />`,
      ...doc.alternates.map(
        (alternate) =>
          `<link id="${alternate.id}" rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}" />`
      )
    ].forEach((fragment) => {
      if (!html.includes(fragment)) throw new Error(`Social or language metadata is missing for ${route}: ${fragment}`);
    });
    if (doc.isCanonicalActiveDetail) {
      [
        `<meta property="product:price:amount" content="${doc.openGraph.priceAmount}" />`,
        `<meta property="product:price:currency" content="${doc.openGraph.priceCurrency}" />`
      ].forEach((fragment) => {
        if (!html.includes(fragment)) throw new Error(`Product metadata is missing for ${route}: ${fragment}`);
      });
    } else if (html.includes('property="product:price:')) {
      throw new Error(`Non-product SEO output contains product price metadata for ${route}`);
    }

    const match = html.match(/<script\s+id="route-structured-data"[^>]*>([\s\S]*?)<\/script>/i);
    if (!match) throw new Error(`Structured data is missing for ${route}`);
    const graph = JSON.parse(match[1])['@graph'];
    const productNode = graph.find((item) => item['@type'] === 'Product');
    const faqNode = graph.find((item) => item['@type'] === 'FAQPage');
    const product = getProductByRoute(route);
    if (doc.isCanonicalActiveDetail) {
      if (!productNode || !faqNode || !product) throw new Error(`Active product structured data is incomplete for ${route}`);
      if (productNode.name !== product.displayName || productNode.offers.price !== String(product.price) || productNode.offers.priceCurrency !== product.currency || productNode.offers.url !== `${SITE_URL}${product.routes.detail}`) {
        throw new Error(`Product registry metadata drift detected for ${route}`);
      }
    } else if (productNode || faqNode) {
      throw new Error(`Non-product SEO output contains Product or FAQ data for ${route}`);
    }
  }

  const entries = getIndexableRouteEntries();
  await rm(path.join(distDir, 'seo'), { recursive: true, force: true });
  await mkdir(path.join(distDir, 'seo'), { recursive: true });
  const seenTitles = new Set();
  const seenDescriptions = new Set();
  for (const [route, seo] of entries) {
    const { html, doc } = buildPage(route, seo);
    if (seenTitles.has(seo.title) || seenDescriptions.has(seo.description)) throw new Error(`Duplicate SEO title or description detected for ${route}`);
    seenTitles.add(seo.title);
    seenDescriptions.add(seo.description);
    await access(path.join(rootDir, 'public', new URL(doc.imageUrl).pathname.replace(/^\//, '')));
    validatePage(route, seo, html, doc);
    await writeFile(route === '/' ? templateFile : path.join(distDir, 'seo', `${routeFileName(route)}.html`), html, 'utf8');
  }
  const urls = entries
    .map(([route, seo]) => `  <url>\n    <loc>${SITE_URL}${route === '/' ? '/' : route}</loc>\n    <lastmod>${seo.lastmod}</lastmod>\n  </url>`)
    .join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  await writeFile(publicSitemapFile, sitemap, 'utf8');
  await writeFile(distSitemapFile, sitemap, 'utf8');
  console.log(`Generated ${entries.length} SEO pages and sitemap.xml`);
} finally {
  await moduleServer.close();
}
