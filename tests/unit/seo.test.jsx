import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalErrorBoundary from '@/components/common/ErrorBoundary';
import RouteMetadata from '@/components/common/RouteMetadata';
import { createSeoConfig, getPageMetadata } from '@/config/seo';
import { createSeoDocuments } from '../../scripts/seo-assets.js';

const production = { VITE_SITE_URL: 'https://luvax.online/', VITE_SEO_INDEXABLE: 'true' };
const template =
  '<html><head><title>old</title><meta name="description" content="old"></head><body><div id="root"></div><script type="module" src="/assets/app-hash.js"></script></body></html>';

beforeEach(() => {
  document.head.innerHTML = '';
});

describe('public indexing policy', () => {
  it('requires explicit indexing opt-in and a valid HTTPS origin', () => {
    expect(createSeoConfig({}).indexable).toBe(false);
    for (const url of [
      '',
      'http://luvax.online',
      'https://luvax.online/path',
      'https://user:pass@luvax.online',
      'https://luvax.online/?token=secret',
    ]) {
      expect(() => createSeoConfig({ ...production, VITE_SITE_URL: url })).toThrow();
    }
    expect(createSeoConfig(production).origin).toBe('https://luvax.online');
  });

  it('indexes only the clean root URL and never puts query credentials in metadata', () => {
    const config = createSeoConfig(production);
    expect(getPageMetadata(config, '/', '').canonical).toBe('https://luvax.online/');
    for (const [path, search] of [
      ['/', '?view=register'],
      ['/', '?reauth=1'],
      ['/reset-password', '?token=secret'],
      ['/app/p/123', ''],
      ['/support/appeal/status', '?token=secret'],
      ['/missing', ''],
    ]) {
      const metadata = getPageMetadata(config, path, search);
      expect(metadata.robots).toContain('noindex');
      expect(metadata.canonical).toBeNull();
      expect(metadata.schema).toBeNull();
      expect(JSON.stringify(metadata)).not.toContain('secret');
    }
  });
});

describe('build SEO documents', () => {
  it('emits a public graph and machine-readable discovery resources without private URLs', () => {
    const docs = createSeoDocuments(template, createSeoConfig(production));
    const doc = new DOMParser().parseFromString(docs['index.html'], 'text/html');
    expect(doc.querySelectorAll('title')).toHaveLength(1);
    expect(doc.querySelector('link[rel="canonical"]').href).toBe('https://luvax.online/');
    const graph = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)[
      '@graph'
    ];
    expect(graph.map((n) => n['@type'])).toEqual(['Organization', 'WebSite', 'WebPage']);
    const xml = new DOMParser().parseFromString(docs['sitemap.xml'], 'application/xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    expect([...xml.querySelectorAll('loc')].map((n) => n.textContent)).toEqual([
      'https://luvax.online/',
    ]);
    expect(docs['robots.txt']).toContain('Sitemap: https://luvax.online/sitemap.xml');
    expect(docs['robots.txt']).not.toContain('Disallow: /app');
  });

  it('preserves the SPA entry but removes public identity from private and error documents', () => {
    const docs = createSeoDocuments(template, createSeoConfig(production));
    for (const file of ['spa.html', '404.html']) {
      const doc = new DOMParser().parseFromString(docs[file], 'text/html');
      expect(doc.querySelector('meta[name="robots"]').content).toContain('noindex');
      expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
      expect(doc.querySelector('script[type="application/ld+json"]')).toBeNull();
      expect(doc.querySelector('script[type="module"]').getAttribute('src')).toBe(
        '/assets/app-hash.js'
      );
    }
    expect(
      new DOMParser().parseFromString(docs['404.html'], 'text/html').querySelector('main h1')
    ).not.toBeNull();
  });

  it('keeps staging out of the index and does not publish an indexable sitemap URL', () => {
    const docs = createSeoDocuments(
      template,
      createSeoConfig({ VITE_SITE_URL: 'https://luvax.online' })
    );
    expect(docs['robots.txt']).toContain('Disallow: /');
    const doc = new DOMParser().parseFromString(docs['index.html'], 'text/html');
    expect(doc.querySelector('meta[name="robots"]').content).toContain('noindex');
    expect(
      new DOMParser()
        .parseFromString(docs['sitemap.xml'], 'application/xml')
        .querySelectorAll('loc')
    ).toHaveLength(0);
  });
});

it('removes stale public metadata when navigation enters a token-bearing operational route', async () => {
  const config = createSeoConfig(production);
  const { unmount } = render(
    <MemoryRouter initialEntries={['/']}>
      <RouteMetadata config={config} />
    </MemoryRouter>
  );
  await waitFor(() => expect(document.querySelector('link[rel="canonical"]')).not.toBeNull());
  unmount();
  render(
    <MemoryRouter initialEntries={['/reset-password?token=secret']}>
      <RouteMetadata config={config} />
    </MemoryRouter>
  );
  await waitFor(() =>
    expect(document.querySelector('meta[name="robots"]').content).toContain('noindex')
  );
  expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  expect(document.querySelectorAll('title')).toHaveLength(1);
  expect(document.head.innerHTML).not.toContain('secret');
});

it('removes homepage identity and share metadata after a render failure', () => {
  document.head.innerHTML = new DOMParser().parseFromString(
    createSeoDocuments(template, createSeoConfig(production))['index.html'],
    'text/html'
  ).head.innerHTML;
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  function Failure() {
    throw new Error('render failure fixture');
  }
  try {
    render(
      <GlobalErrorBoundary>
        <Failure />
      </GlobalErrorBoundary>
    );
    expect(document.querySelector('meta[name="robots"]').content).toContain('noindex');
    expect(document.querySelector('meta[property="og:url"]')).toBeNull();
    expect(document.querySelector('meta[name="twitter:title"]')).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  } finally {
    consoleError.mockRestore();
  }
});
