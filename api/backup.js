// Vercel Serverless Function: full article export for backups.
// /api/backup returns every published article as JSON. The data is the
// same public content already shown on the article pages (no drafts,
// no credentials, no private fields) — this endpoint only makes it
// downloadable in one file so backups can be taken regularly.
// NOTE: fetches up to 100 articles per call; add pagination if the
// portal ever grows past 100 published articles.

const PROJECT_ID = 'meramu-site';
const APP_ID = 'meramu-site-app';

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

function iso(ms) {
  return ms ? new Date(ms).toISOString() : '';
}

export default async function handler(req, res) {
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: 'Server belum dikonfigurasi.' });
  }

  let docs = [];
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/articles?pageSize=100&key=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Firestore ${r.status}`);
    const data = await r.json();
    docs = (data.documents || []).map((d) => {
      const parts = (d.name || '').split('/');
      return { id: parts[parts.length - 1], fields: d.fields || {} };
    });
  } catch {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: 'Gagal mengambil daftar artikel.' });
  }

  const articles = docs
    .sort((a, b) => msField(b.fields, 'createdAt') - msField(a.fields, 'createdAt'))
    .map((d) => {
      const f = d.fields;
      return {
        id: d.id,
        title: strField(f, 'title'),
        excerpt: strField(f, 'excerpt'),
        content: strField(f, 'content'),
        category: strField(f, 'category'),
        author: strField(f, 'author'),
        readTime: strField(f, 'readTime'),
        imageUrl: strField(f, 'imageUrl'),
        imageCaption: strField(f, 'imageCaption'),
        createdAt: iso(msField(f, 'createdAt')),
        updatedAt: iso(msField(f, 'updatedAt')),
      };
    });

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).json({
    site: 'meramu.site',
    generatedAt: new Date().toISOString(),
    count: articles.length,
    articles,
  });
}
