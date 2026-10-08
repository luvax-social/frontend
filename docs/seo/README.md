# SEO serving and indexing policy

## Production configuration

Public indexing is opt-in. Configure both variables at **build time**:

```text
VITE_SITE_URL=https://luvax.online
VITE_SEO_INDEXABLE=true
```

`VITE_SITE_URL` must be an HTTPS origin without a path, credentials, query or fragment.
An indexing-enabled build fails if the origin is missing or invalid. Local and staging
builds default to noindex, a disallow-all robots file and an empty sitemap. Changing
runtime container environment variables does not change an already compiled Vite bundle.

For the container build:

```sh
docker build --build-arg VITE_SITE_URL=https://luvax.online \
  --build-arg VITE_SEO_INDEXABLE=true -t luvax-frontend .
```

Retain the existing deployment's API, OAuth and Turnstile configuration. SEO variables
do not configure those services or replace backend authorization.

## Documents and routes

The Vite build generates `index.html`, `spa.html`, `404.html`, `robots.txt` and
`sitemap.xml` from one metadata policy. Nginx selects the correct document:

| Request | HTTP behavior | Indexing |
|---|---|---|
| Clean `/` | 200, homepage metadata | Enabled only with the production opt-in |
| Root query views | 200, neutral SPA document | Noindex; no homepage canonical/graph |
| Known auth, support, dashboard, app and admin routes | 200, neutral SPA document | Noindex header and HTML |
| `/login`, `/register`, `/forgot-password`, `/index.html` | One 301 to the existing destination | Relative Location preserves HTTPS behind a TLS terminator |
| Unknown top-level paths and missing assets | Actual 404 and an error document | Noindex |
| `/robots.txt` and `/sitemap.xml` | Exact TXT/XML resources | Never an HTML fallback |

Published support and signed-link paths remain unchanged. Authentication and role guards
still protect the application. Unknown entity IDs within known app route groups cannot
be resolved by this static server; these routes remain noindex and the application
handles their API errors. Robots rules are not a replacement for authorization or noindex.

Registration and forgot-password buttons update the existing root query views. Browser
back, direct links and metadata use the same view state. Operational query values and
user IDs are never copied into metadata or structured data.

The client replaces the managed head entries on navigation. Route and global rendering
errors remove public canonical/schema/share metadata and mark the document noindex.

## Public structured data

An indexable homepage has one JSON-LD graph containing Organization, WebSite and WebPage.
The graph uses the configured origin and the actual brand logo. No offers, reviews,
authors, corporate details or social profiles are inferred.

The current website has no public editorial article, product-detail, FAQ or nested public
breadcrumb page. Add their schema only when the corresponding visible, factual content
exists. A private profile, authentication form or support token screen is not a substitute.

References: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics),
[structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies),
[site names](https://developers.google.com/search/docs/appearance/site-names),
[robots guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro).

## Assets and cache

Fingerprint-named `/assets/` files use a one-year immutable cache. Mutable public asset
names require revalidation. HTML and private SPA documents use no-store; robots and
sitemap use no-cache. Nginx compresses HTML, CSS, JavaScript and supported textual types
with gzip. Verify Cloudflare's effective headers separately after deployment.

The small logo and favicon retain the existing artwork. The decorative homepage image
has 640px and 1200px derivatives with an explicit ratio and responsive source selection.
Original public image URLs remain available for compatibility. The logo is 14,476 bytes
instead of the 5,871,936-byte original; the favicon is 4,426 bytes. Hero derivatives are
68,722 and 200,732 bytes, from the existing 576,680-byte third hero image.

Font CSS is discovered from the document head with preconnect hints and `display=swap`.
The unused Inter family is no longer requested. Post media keeps its existing reserved
frame and lazy loading; thumbnails now defer decoding/fetching too. The moderation
support queue is loaded on demand instead of through the anonymous entry dependency graph.

## Verification

```sh
npm test
npm run lint
npm run build
```

Build with the production opt-in, serve `dist/` through the repository's Nginx configuration,
then run:

```sh
node scripts/check-seo-http.mjs http://127.0.0.1:4183 https://luvax.online
```

The HTTP check covers public/private HTML, query credentials, discovery content types,
single-hop relative redirects, real 404s, mutable versus immutable cache and gzip. A Vite
preview server does not use `nginx.conf` and cannot validate these serving policies.

Rendered checks must cover mobile and desktop login, registration, forgot-password, browser
back, a support route and an unknown URL. Verify one visible primary H1/main landmark,
no horizontal overflow and no stale homepage graph/canonical on operational screens.

Validate the actual graph with [Schema.org Validator](https://validator.schema.org/) and
[Google Rich Results Test](https://search.google.com/test/rich-results). Code-input validation
does not verify deployed crawling, logo accessibility, content-policy compliance or ranking.

### Verification recorded on 2026-10-08

- Full suite: 43 files and 397 tests passed, including nine new SEO/auth regressions.
- Lint: zero errors and 62 warnings; the baseline had 61 warnings, and the additional
  warning is the existing Fast Refresh rule applied to the lazy support queue declaration.
- Both indexing-enabled and staging builds passed. The staging output was inspected for
  noindex, no canonical/graph, disallow-all robots and an empty sitemap.
- The HTTP matrix passed against official Windows Nginx 1.30.5 with only the listen address
  and document root adapted for local serving. Docker's Nginx 1.27 image was not exercised
  because the local Docker engine was stopped; test that image before deployment.
- Rendered login at 390px and desktop had one visible H1 in main and no horizontal overflow.
  Registration, forgot-password, browser back, support and an unknown URL were checked for
  correct indexing signals. Support kept its H1 in a main landmark; its categories could
  not load while the backend was offline, so ticket submission was not validated.
- Schema.org code validation reported zero errors and zero warnings for the actual graph.
  Google Rich Results Test code validation reported **No items detected**. This is not
  a certification of eligibility for rich results or successful production indexing.

The deployment was intentionally offline during these checks. No production restart,
field CWV result, Search Console coverage result or search-intent completeness is asserted.

## Remaining SEO gate requirements

The foundation changes do not certify exhaustive SEO completion. Before introducing GEO:

1. Deploy and crawl the online site; inspect HTTPS/www behavior, GSC coverage and actual
   HTTP responses, and resolve the remaining broken legal fragment links using approved text.
2. Revalidate schema on the accessible production URL and verify its assets.
3. Confirm target market/keywords and design sufficient public search-intent content.
   The homepage is still an authentication entry, and posts/profiles remain private.

Measure field p75 LCP, INP and CLS using adequate CrUX/Search Console data; local tests
cannot establish field CWV success. Do not infer keyword cannibalization, organic traffic
or complete topic coverage from template metadata alone. No GEO content changes are part
of this serving policy.
