# Search Engine Launch Setup

Use the canonical production domain for search registration: `https://www.unwoldang.com`.

## Files Already Served

- `https://www.unwoldang.com/robots.txt`
- `https://www.unwoldang.com/sitemap.xml`

The sitemap includes public landing/detail/legal pages only. Payment, report, login, my page, admin, auth callback, and loading pages are blocked or marked noindex.

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
- `https://www.unwoldang.com/detail/past-life-goblin`
- `https://www.unwoldang.com/detail/love-reading`
- `https://www.unwoldang.com/terms`
- `https://www.unwoldang.com/privacy`
- `https://www.unwoldang.com/refund`

## Retired Detail URLs

The retired one-segment `/detail/*` pages return HTTP 410 and must not be added to the sitemap or robots.txt. To hide already indexed results quickly, submit only the exact retired URLs in Search Console Removals. Never submit the `/detail/` prefix because the two active products use it too.
