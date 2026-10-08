export const HOME_TITLE = 'Luvax | A quiet social network for your interests';
export const HOME_DESCRIPTION =
  'Luvax is a quiet social network for sharing photos, following your interests and connecting with people. Create an account or sign in to join the conversation.';

/** Indexing is an explicit deployment decision; preview builds default to noindex. */
export function createSeoConfig(env = {}) {
  const indexable = env.VITE_SEO_INDEXABLE === 'true';
  const value = env.VITE_SITE_URL?.trim();
  if (!value) {
    if (indexable) throw new Error('VITE_SITE_URL is required when indexing is enabled.');
    return { origin: '', indexable: false };
  }
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('VITE_SITE_URL must be a public HTTPS origin without a path or credentials.');
  }
  return { origin: url.origin, indexable };
}

/** Never derive public metadata from query values, IDs or a browser's local origin. */
export function getPageMetadata(config, pathname, search = '', title = 'Luvax') {
  const home = pathname === '/' && !search;
  const publicHome = home && config.indexable;
  const view = pathname === '/' ? new URLSearchParams(search).get('view') : null;
  const pageTitle =
    view === 'register'
      ? 'Create an account | Luvax'
      : view === 'forgot'
        ? 'Reset your password | Luvax'
        : home
          ? HOME_TITLE
          : title;
  const url = `${config.origin}/`;
  return {
    title: pageTitle,
    description: home ? HOME_DESCRIPTION : 'Manage your Luvax account securely.',
    robots: publicHome ? 'index, follow' : 'noindex, follow',
    canonical: publicHome ? url : null,
    schema: publicHome
      ? {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': `${url}#organization`,
              name: 'Luvax',
              url,
              logo: `${config.origin}/luvax-logo.webp`,
            },
            {
              '@type': 'WebSite',
              '@id': `${url}#website`,
              name: 'Luvax',
              url,
              publisher: { '@id': `${url}#organization` },
            },
            {
              '@type': 'WebPage',
              '@id': `${url}#webpage`,
              name: HOME_TITLE,
              description: HOME_DESCRIPTION,
              url,
              isPartOf: { '@id': `${url}#website` },
            },
          ],
        }
      : null,
  };
}

/** The build and client use the same head entries to avoid divergent indexing signals. */
export function metadataEntries(metadata) {
  const entries = [
    { tag: 'title', text: metadata.title },
    { tag: 'meta', attrs: { name: 'description', content: metadata.description } },
    { tag: 'meta', attrs: { name: 'robots', content: metadata.robots } },
  ];
  if (metadata.canonical) {
    entries.push(
      { tag: 'link', attrs: { rel: 'canonical', href: metadata.canonical } },
      { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
      { tag: 'meta', attrs: { property: 'og:site_name', content: 'Luvax' } },
      { tag: 'meta', attrs: { property: 'og:title', content: metadata.title } },
      { tag: 'meta', attrs: { property: 'og:description', content: metadata.description } },
      { tag: 'meta', attrs: { property: 'og:url', content: metadata.canonical } },
      { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary' } },
      { tag: 'meta', attrs: { name: 'twitter:title', content: metadata.title } },
      { tag: 'meta', attrs: { name: 'twitter:description', content: metadata.description } }
    );
  }
  if (metadata.schema) {
    entries.push({
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      text: JSON.stringify(metadata.schema).replace(/</g, '\\u003c'),
    });
  }
  return entries;
}
