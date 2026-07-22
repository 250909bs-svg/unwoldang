# Search Engine Launch Setup

Use the canonical production domain for search registration: `https://www.unwoldang.com`.

## Files Already Served

- `https://www.unwoldang.com/robots.txt`
- `https://www.unwoldang.com/sitemap.xml`

The sitemap includes public landing pages, the five active product detail pages, and legal pages only. Payment, report, login, my page, admin, auth callback, and loading pages are blocked or marked noindex.

## Google Search Console

1. Open https://search.google.com/search-console
2. Add property: `https://www.unwoldang.com`
3. Verify ownership with the method Google gives you.
4. Submit sitemap: `https://www.unwoldang.com/sitemap.xml`
5. Use URL Inspection for `https://www.unwoldang.com/` and request indexing.

## Naver Search Advisor

1. Open https://searchadvisor.naver.com
2. Add site: `https://www.unwoldang.com`
3. Verify ownership with the method Naver gives you.
4. Submit sitemap: `https://www.unwoldang.com/sitemap.xml`
5. Check robots.txt in Webmaster Tools.
6. Request collection for the home page and primary detail pages.

## Verification Tokens

Google and Naver generate unique verification tokens per account. Do not guess or commit a fake token.

If using HTML file verification, download the file from Google/Naver and place it in `public/`, then deploy.
If using meta tag verification, paste the exact tag into the app head or ask Codex to add it.

## Primary URLs To Request First

- `https://www.unwoldang.com/`
- `https://www.unwoldang.com/detail/general-saju`
- `https://www.unwoldang.com/detail/past-life-goblin`
- `https://www.unwoldang.com/detail/love-reading`
- `https://www.unwoldang.com/detail/love-reunion`
- `https://www.unwoldang.com/detail/match-couple`
- `https://www.unwoldang.com/terms`
- `https://www.unwoldang.com/privacy`
- `https://www.unwoldang.com/refund`

## Product URL Lifecycle

The product registry is the source of truth for detail-page lifecycle. These seven registered archived detail URLs remain SPA routes so visitors see the sale-ended notice:

- `https://www.unwoldang.com/detail/life-flow`
- `https://www.unwoldang.com/detail/concern-reading`
- `https://www.unwoldang.com/detail/match-destiny`
- `https://www.unwoldang.com/detail/marriage-blueprint`
- `https://www.unwoldang.com/detail/marriage-timing`
- `https://www.unwoldang.com/detail/career-reading`
- `https://www.unwoldang.com/detail/money-reading`

Archived detail responses send `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`, and the URLs are excluded from the sitemap. Their existing `/report/{productId}` URLs remain available for authorized historical-report rereads; archiving a product does not bypass or revoke the existing report-access contract.

Any unregistered or legacy `/detail/*` path returns a hard HTTP 410 response and is excluded from the sitemap. This includes `/detail/general-signature`; the active canonical URL for that product is `/detail/general-saju`. The legacy top-level `/menu` and `/tarot` URLs permanently redirect to the home page (`/`) and should not be submitted separately.

To hide an already indexed archived or 410 URL quickly, submit only that exact URL in Search Console Removals. Never submit the `/detail/` prefix because all five active product pages use it.
