// Vercel Serverless Function: RSS 2.0 feed for meramu.site.
// /feed.xml is rewritten (vercel.json) to /api/feed.
// Reads live from the same public Firestore collection the portal CMS
// writes to. Latest 20 articles, newest first. Since Fase 2 (Nov 2026)
// the 20 come from a filtered runQuery (orderBy createdAt desc, limit 20)
// so the feed sees articles the pageSize=100 list window drops; the list
// fetch remains as the fallback when the query fails.

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

// Fase 2 (Nov 2026): filtered Firestore queries via the REST runQuery
// endpoint (same helper as api/berita.js; no shared import by design).
// Returns [{ id, fields }] for each matching document. Fails fast (5s);
// callers fall back to the list fetch.
async function runFirestoreQuery(apiKey, structuredQuery) {
  const parent = `artifacts/${APP_ID}/public/data`;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${parent}:runQuery?key=${apiKey}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`Firestore runQuery ${r.status}`);
  const arr = await r.json();
  return (Array.isArray(arr) ? arr : [])
    .map((e) => e.document)
    .filter(Boolean)
    .map((d) => ({ id: String(d.name || '').split('/').pop(), fields: d.fields || {} }));
}

export default async function handler(req, res) {
  let docs = [];
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (apiKey) {
    // Fase 2 (Nov 2026): newest 20 via a filtered runQuery (bare orderBy
    // needs no composite index). Falls back to the list fetch on error.
    try {
      docs = await runFirestoreQuery(apiKey, {
        from: [{ collectionId: 'articles' }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 20,
      });
    } catch {
      docs = [];
    }
    if (!docs.length) {
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
  }

  // Item links + guids use article slugs. Stored slug wins (Fase 2);
  // otherwise the computed slug (no duplicate title bases in the
  // collection, verified Nov 2026).
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
      const slug = strField(f, 'slug') || (strField(f, 'title') ? slugifyTitle(title) : d.id);
      const link = `${SITE_URL}/berita/${slug}`;
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
