import { Router } from 'express';
import { env } from '../config/env.js';
import { VALID_JOB_TYPES, slugify } from '../shared/schemas.js';

export const seoRouter = Router();

// Dynamic robots.txt
seoRouter.get('/robots.txt', (_req, res) => {
  const content = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    '',
    `Sitemap: ${env.APP_URL}/sitemap.xml`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(content);
});

// Dynamic sitemap.xml
seoRouter.get('/sitemap.xml', (_req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const baseUrl = env.APP_URL.replace(/\/$/, '');

  const urls = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${baseUrl}/#how`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${baseUrl}/#freelancers`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${baseUrl}/#contact`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${baseUrl}/#reviews`, priority: '0.7', changefreq: 'weekly' },
  ];

  // Dynamic service entries for crawlable service landing pages
  for (const job of VALID_JOB_TYPES) {
    const slug = slugify(job);
    urls.push({
      loc: `${baseUrl}/szolgaltatasok/${slug}`,
      priority: '0.8',
      changefreq: 'weekly',
    });
  }

  const xmlEntries = urls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(xml);
});

// Dynamic SEO metadata provider API
seoRouter.get('/api/seo/metadata', (req, res) => {
  const page = typeof req.query.page === 'string' ? req.query.page : 'home';
  const baseUrl = env.APP_URL.replace(/\/$/, '');

  const metaMap: Record<string, any> = {
    home: {
      title: 'OnDemand – Ellenőrzött Szakemberek Budapesten | Villanyszerelő & Vízvezetékszerelő',
      description:
        'Azonnali és megbízható segítség ellenőrzött mesteremberektől Budapesten. Villanyszerelés, vízvezetékszerelés, klíma és fűtésszerelés átlátható árakkal.',
      canonical: `${baseUrl}/`,
      openGraph: {
        type: 'website',
        title: 'OnDemand – Ellenőrzött Szakemberek Budapesten',
        description: 'Gyors segítség ellenőrzött szakemberektől. Átlátható árak, foglalás percek alatt.',
        url: `${baseUrl}/`,
        image: `${baseUrl}/og-image.jpg`,
        locale: 'hu_HU',
        siteName: 'OnDemand',
      },
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'HomeAndConstructionBusiness',
        name: 'OnDemand Kft.',
        url: `${baseUrl}/`,
        telephone: '+36 70 881 6665',
        email: 'ondemandkft@gmail.com',
        priceRange: '$$',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Budapest',
          addressCountry: 'HU',
        },
        areaServed: {
          '@type': 'City',
          name: 'Budapest',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '150',
          bestRating: '5',
        },
      },
    },
  };

  const selected = metaMap[page] || metaMap.home;
  res.json({ success: true, data: selected });
});
