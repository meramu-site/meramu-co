// Vercel Serverless Function: dynamic XML sitemap for meramu.site.
// /sitemap.xml is rewritten (vercel.json) to /api/sitemap.
// Reads live from the same public Firestore collection the portal CMS
// writes to, so a newly published article enters the sitemap without a
// site rebuild. NOTE: fetches up to 100 articles per call; add pagination
// if the portal ever grows past 100 published articles.
// IMPORTANT: the old static public/sitemap.xml must NOT exist in the repo,
// because Vercel serves filesystem files before rewrites and it would
// shadow this function.

const PROJECT_ID = 'meramu-site';
const APP_ID = 'meramu-site-app';
const SITE_URL = 'https://meramu.site';

const CATEGORY_SLUGS = [
  'pop-culture',
  'ekonomi-kreatif',
  'musik',
  'entertainment',
  'lifestyle',
  'tech',
  'berita-umum',
  'sports',
  'esports',
  'politik',
];

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function msField(fields, name) {
  const v = fields?.[name];
  if (!v) return 0;
  if (v.integerValue !== undefined) {
    const n = Number(v.integerValue);
    return Number.isFinite(n) ? n : 0;
  }
  if (v.timestampValue) {
    const t = Date.parse(v.timestampValue);
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof v.stringValue === 'string') {
    const n = Number(v.stringValue);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function strField(fields, name) {
  const v = fields?.[name];
  if (!v) return '';
  if (typeof v.stringValue === 'string') return v.stringValue;
  return '';
}

function dayInJakarta(ms) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export default async function handler(req, res) {
  const today = dayInJakarta(Date.now());
  const entries = [];
  let docs = [];

  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (apiKey) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/articles?pageSize=100&key=${apiKey}`;
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        docs = (data.documents || []).map((d) => {
          const parts = (d.name || '').split('/');
          return { id: parts[parts.length - 1], fields: d.fields || {} };
        });
      }
    } catch {
      docs = [];
    }
  }

  // Homepage: lastmod = newest article date (or today when empty).
  const newestMs = docs.reduce((m, d) => Math.max(m, msField(d.fields, 'createdAt')), 0);
  entries.push(urlEntry(`${SITE_URL}/`, newestMs ? dayInJakarta(newestMs) : today, 'daily', '1.0'));
  entries.push(urlEntry(`${SITE_URL}/home`, newestMs ? dayInJakarta(newestMs) : today, 'daily', '0.9'));
  entries.push(urlEntry(`${SITE_URL}/tentang`, '2026-10-30', 'monthly', '0.8'));
  entries.push(urlEntry(`${SITE_URL}/privasi`, '2026-10-30', 'monthly', '0.5'));
  entries.push(urlEntry(`${SITE_URL}/kontak`, '2026-10-30', 'monthly', '0.5'));

  // Category pages: lastmod = newest article date in that category.
  const byCategory = {};
  for (const d of docs) {
    const c = strField(d.fields, 'category');
    const ms = msField(d.fields, 'createdAt');
    if (c && ms && (!byCategory[c] || ms > byCategory[c])) byCategory[c] = ms;
  }
  const slugToCategory = {
    'pop-culture': 'Pop Culture',
    'ekonomi-kreatif': 'Ekonomi Kreatif',
    'musik': 'Musik',
    'entertainment': 'Entertainment',
    'lifestyle': 'Lifestyle',
    'tech': 'Tech',
    'berita-umum': 'Berita Umum',
    'sports': 'Sports',
    'esports': 'Esports',
    'politik': 'Politik',
  };
  for (const slug of CATEGORY_SLUGS) {
    const ms = byCategory[slugToCategory[slug]];
    entries.push(urlEntry(`${SITE_URL}/kategori/${slug}`, ms ? dayInJakarta(ms) : '', 'daily', '0.8'));
  }

  // Article pages, newest first.
  docs
    .sort((a, b) => msField(b.fields, 'createdAt') - msField(a.fields, 'createdAt'))
    .forEach((d) => {
      const ms = msField(d.fields, 'createdAt');
      entries.push(urlEntry(
        `${SITE_URL}/berita/${encodeURIComponent(d.id)}`,
        ms ? dayInJakarta(ms) : '',
        'monthly',
        '0.8',
      ));
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
}
