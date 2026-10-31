// Vercel Serverless Function: RSS 2.0 feed for meramu.site.
// /feed.xml is rewritten (vercel.json) to /api/feed.
// Reads live from the same public Firestore collection the portal CMS
// writes to. Latest 20 articles, newest first.
// NOTE: fetches up to 100 articles per call; add pagination if the
// portal ever grows past 100 published articles.

const PROJECT_ID = 'meramu-site';
const APP_ID = 'meramu-site-app';
const SITE_URL = 'https://meramu.site';

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function strField(fields, name) {
  const v = fields?.[name];
  if (!v) return '';
  if (typeof v.stringValue === 'string') return v.stringValue;
  return '';
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


// Article slugs (SEO URLs, Oct 2026). MUST stay identical in api/berita.js,
// api/kategori.js, api/cari.js, api/feed.js, api/sitemap.js, api/index.js
// and src/App.tsx (no shared import). See api/berita.js for the full rules:
// lowercase, apostrophes dropped, dashes collapsed, collision = createdAt
// asc then id asc, first keeps the bare slug, rest get -2, -3, ...
function slugifyTitle(title) {
  const s = String(title || '').toLowerCase().replace(/[''']/g, '').replace(/[\u2013\u2014]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'artikel';
}
function assignSlugs(docs) {
  const groups = new Map();
  for (const d of docs) {
    const base = slugifyTitle(d.title);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(d);
  }
  const out = new Map();
  for (const [base, list] of groups) {
    list.sort((a, b) => (a.createdMs - b.createdMs) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    list.forEach((d, i) => out.set(d.id, i === 0 ? base : `${base}-${i + 1}`));
  }
  return out;
}

export default async function handler(req, res) {
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

  // Item links + guids use article slugs (Oct 2026). Note: guids change
  // from the old ID URLs to slug URLs once; feed readers may show the 20
  // latest items as new a single time, and the old guid URLs 301-redirect
  // to the new ones anyway.
  const slugMap = assignSlugs(docs.map((d) => ({ id: d.id, title: strField(d.fields, 'title'), createdMs: msField(d.fields, 'createdAt') })));
  const items = docs
    .sort((a, b) => msField(b.fields, 'createdAt') - msField(a.fields, 'createdAt'))
    .slice(0, 20)
    .map((d) => {
      const f = d.fields;
      const title = strField(f, 'title') || 'Tanpa judul';
      const excerpt = strField(f, 'excerpt');
      const category = strField(f, 'category');
      const author = strField(f, 'author') || 'Redaksi Meramu';
      const ms = msField(f, 'createdAt');
      const pubDate = ms ? new Date(ms).toUTCString() : '';
      const link = `${SITE_URL}/berita/${slugMap.get(d.id) || d.id}`;
      return `    <item>\n      <title>${escapeXml(title)}</title>\n      <link>${escapeXml(link)}</link>\n      <guid isPermaLink="true">${escapeXml(link)}</guid>\n${excerpt ? `      <description>${escapeXml(excerpt)}</description>\n` : ''}${category ? `      <category>${escapeXml(category)}</category>\n` : ''}      <author>${escapeXml(author)}</author>\n${pubDate ? `      <pubDate>${pubDate}</pubDate>\n` : ''}    </item>`;
    })
    .join('\n');

  const lastBuild = docs.length
    ? new Date(Math.max(...docs.map((d) => msField(d.fields, 'createdAt')))).toUTCString()
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Meramu — Portal Berita</title>\n    <link>${SITE_URL}/</link>\n    <description>Baca berita secukupnya, lanjut kerja lagi.</description>\n    <language>id-ID</language>\n    <lastBuildDate>${lastBuild}</lastBuildDate>\n${items}\n  </channel>\n</rss>\n`;
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
}
