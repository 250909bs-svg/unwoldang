# Search Engine Launch Setup

Use the final production domain for search registration. Prefer `https://unwoldang.com` over the Vercel preview domain.

## Files Already Served

- `https://unwoldang.com/robots.txt`
- `https://unwoldang.com/sitemap.xml`

The sitemap includes public landing/detail/legal pages only. Payment, report, login, my page, admin, auth callback, and loading pages are blocked or marked noindex.

## Google Search Console

1. Open https://search.google.com/search-console
2. Add property: `https://unwoldang.com`
3. Verify ownership with the method Google gives you.
4. Submit sitemap: `https://unwoldang.com/sitemap.xml`
5. Use URL Inspection for `https://unwoldang.com/` and request indexing.

## Naver Search Advisor

1. Open https://searchadvisor.naver.com
2. Add site: `https://unwoldang.com`
3. Verify ownership with the method Naver gives you.
4. Submit sitemap: `https://unwoldang.com/sitemap.xml`
5. Check robots.txt in Webmaster Tools.
6. Request collection for the home page and primary detail pages.

## Verification Tokens

Google and Naver generate unique verification tokens per account. Do not guess or commit a fake token.

If using HTML file verification, download the file from Google/Naver and place it in `public/`, then deploy.
If using meta tag verification, paste the exact tag into the app head or ask Codex to add it.

## Primary URLs To Request First

- `https://unwoldang.com/`
- `https://unwoldang.com/menu`
- `https://unwoldang.com/detail/general-signature`
- `https://unwoldang.com/detail/concern-reading`
- `https://unwoldang.com/detail/love-reading`
- `https://unwoldang.com/terms`
- `https://unwoldang.com/privacy`
- `https://unwoldang.com/refund`
