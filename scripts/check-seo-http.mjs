import assert from 'node:assert/strict';
import process from 'node:process';

const base = process.argv[2] || 'http://127.0.0.1:4183';
const origin = process.argv[3];
assert(origin, 'Usage: node scripts/check-seo-http.mjs <server URL> <canonical origin>');

async function request(path, status = 200, headers = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', headers });
  assert.equal(response.status, status, `${path}: HTTP status`);
  return { response, body: await response.text() };
}

const { response: home, body: homeHtml } = await request('/');
assert.match(homeHtml, new RegExp(`rel="canonical" href="${origin}/"`));
assert.match(homeHtml, /application\/ld\+json/);
assert(!home.headers.get('x-robots-tag'), 'The clean homepage must not have a noindex header');
assert.match(home.headers.get('cache-control'), /no-store/);

for (const path of [
  '/?view=register',
  '/?view=forgot',
  '/?reauth=1',
  '/app',
  '/app/p/fixture',
  '/app/u/fixture',
  '/admin',
  '/admin/users/fixture',
  '/dashboard',
  '/verify-email?token=fixture',
  '/verify-email-notice',
  '/reset-password?token=fixture',
  '/oauth2/callback?code=fixture',
  '/support/new',
  '/support/appeal?token=fixture',
  '/support/confirm?token=fixture',
  '/support/appeal/status?token=fixture',
  '/support/appeal/resend',
  '/tags/photography',
]) {
  const { response, body } = await request(path);
  assert.match(response.headers.get('x-robots-tag'), /noindex/, `${path}: noindex header`);
  assert.match(body, /name="robots" content="noindex/, `${path}: noindex HTML`);
  assert(!body.includes('rel="canonical"'), `${path}: homepage canonical leaked`);
  assert(!body.includes('application/ld+json'), `${path}: homepage graph leaked`);
  assert(!body.includes('token=fixture'), `${path}: query credential leaked into HTML`);
}

for (const [from, destination] of [
  ['/login?reauth=1', '/?reauth=1'],
  ['/register', '/?view=register'],
  ['/register/?reauth=1', '/?view=register&reauth=1'],
  ['/forgot-password?reauth=1', '/?view=forgot&reauth=1'],
  ['/index.html', '/'],
]) {
  const { response } = await request(from, 301);
  assert(
    response.headers.get('location').startsWith('/'),
    `${from}: redirect must preserve the visitor's HTTPS scheme behind TLS termination`
  );
  assert.equal(
    new URL(response.headers.get('location'), base).pathname +
      new URL(response.headers.get('location'), base).search,
    destination
  );
  await request(destination);
}

for (const path of [
  '/seo-check-missing-page',
  '/support/unknown',
  '/assets/missing.js',
  '/missing.webp',
  '/spa.html',
  '/404.html',
]) {
  const { response, body } = await request(path, 404);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert(!body.includes('rel="canonical"'));
}

const { response: robots, body: robotsText } = await request('/robots.txt');
assert.match(robots.headers.get('content-type'), /text\/plain/);
assert(robotsText.includes(`Sitemap: ${origin}/sitemap.xml`));
const { response: sitemap, body: sitemapXml } = await request('/sitemap.xml');
assert.match(sitemap.headers.get('content-type'), /(?:application|text)\/xml/);
assert(sitemapXml.includes(`<loc>${origin}/</loc>`));
assert(!sitemapXml.includes('/app'));

const bundle = homeHtml.match(/src="(\/assets\/[^" ]+\.js)"/)[1];
const { response: asset } = await request(bundle, 200, { 'Accept-Encoding': 'gzip' });
assert.match(asset.headers.get('cache-control'), /max-age=31536000, immutable/);
assert.equal(asset.headers.get('content-encoding'), 'gzip');
const { response: logo } = await request('/luvax-logo.webp');
assert(!logo.headers.get('cache-control').includes('immutable'));
assert.match(logo.headers.get('cache-control'), /must-revalidate/);

process.stdout.write(
  'SEO HTTP checks passed: public/private HTML, discovery, redirects, 404s, cache and gzip.\n'
);
