import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createSeoConfig, getPageMetadata, metadataEntries } from '../src/config/seo.js';

const escape = (value) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function replaceHead(html, metadata) {
  const clean = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*name=["'](?:description|robots)["'][^>]*>/gi, '')
    .replace(/<(?:meta|link)\b[^>]*data-lx-seo[^>]*>/gi, '')
    .replace(/<script\b[^>]*data-lx-seo[^>]*>[\s\S]*?<\/script>/gi, '');
  const head = metadataEntries(metadata)
    .map(({ tag, attrs = {}, text = '' }) => {
      const attributes = Object.entries(attrs)
        .map(([key, value]) => ` ${key}="${escape(value)}"`)
        .join('');
      return ['meta', 'link'].includes(tag)
        ? `<${tag} data-lx-seo${attributes}>`
        : `<${tag} data-lx-seo${attributes}>${tag === 'script' ? text : escape(text)}</${tag}>`;
    })
    .join('\n');
  return clean.replace('</head>', `${head}\n</head>`);
}

export function createSeoDocuments(html, config) {
  const home = replaceHead(html, getPageMetadata(config, '/', ''));
  const spa = replaceHead(html, getPageMetadata(config, '/app', '', 'Luvax'));
  const missing = replaceHead(
    html,
    getPageMetadata(config, '/missing', '', 'Page not found | Luvax')
  ).replace(
    '<div id="root"></div>',
    '<div id="root"><main class="not-found-page"><p>404</p><h1>That page does not exist.</h1><a href="/">Back to Luvax</a></main></div>'
  );
  return {
    'index.html': home,
    'spa.html': spa,
    '404.html': missing,
    'robots.txt': config.indexable
      ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${config.origin}/sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n',
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${config.indexable ? `<url><loc>${escape(config.origin)}/</loc></url>` : ''}</urlset>\n`,
  };
}

export function seoAssetsPlugin(env) {
  const config = createSeoConfig(env);
  let outDir;
  return {
    name: 'luvax-seo-assets',
    apply: 'build',
    configResolved(resolved) {
      outDir = path.resolve(resolved.root, resolved.build.outDir);
    },
    transformIndexHtml(html) {
      return createSeoDocuments(html, config)['index.html'];
    },
    writeBundle() {
      const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
      for (const [file, content] of Object.entries(createSeoDocuments(html, config))) {
        writeFileSync(path.join(outDir, file), content);
      }
    },
  };
}
