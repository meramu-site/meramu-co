// Vercel Serverless Function: every category is its own real page.
// /kategori/<slug> is rewritten (vercel.json) to /api/kategori?slug=<slug>.
// Lists live from the same public Firestore collection the portal CMS
// writes to. NOTE: fetches up to 100 articles per call; add pagination
// if the portal ever grows past 100 published articles.

const PROJECT_ID = 'meramu-site';
const APP_ID = 'meramu-site-app';
const SITE_URL = 'https://meramu.site';
const ACCENT = '#0D1B8C';
const GA_ID = 'G-J3BTYYC4X8';

const SLUG_TO_CATEGORY = {
  'pop-culture': 'Pop Culture',
  'ekonomi-kreatif': 'Ekonomi Kreatif',
  'musik-komedi': 'Musik & Komedi',
  'lifestyle': 'Lifestyle',
  'tech': 'Tech',
  'berita-umum': 'Berita Umum',
  'sports': 'Sports',
  'esports': 'Esports',
  'politik': 'Politik',
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  return 0;
}

function formatDate(ms) {
  if (!ms) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

function shell({ title, description, canonical, body }) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — Meramu.co</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>
<script>(function(){try{if(localStorage.getItem('meramu-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();</script>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:ui-sans-system,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#171717;background:#fff}
  a{color:${ACCENT}} .accent{height:6px;background:${ACCENT}}
  header{border-bottom:1px solid #e5e5e5} .head{max-width:768px;margin:0 auto;padding:16px;display:flex;align-items:center;gap:12px}
  .badge{width:36px;height:36px;border-radius:10px;background:${ACCENT};color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}
  .brand{font-weight:900;letter-spacing:.02em} .brand small{display:block;font-size:10px;letter-spacing:.18em;color:#737373}
  .head nav{margin-left:auto;display:flex;gap:16px;font-size:14px} .head nav a{color:#171717;text-decoration:none;font-weight:600}
  main{max-width:768px;margin:0 auto;padding:28px 20px 56px}
  .chip{display:inline-block;background:${ACCENT};color:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:5px 12px;border-radius:999px}
  h1{font-size:28px;line-height:1.2;letter-spacing:-.02em;margin:16px 0 8px}
  .count{font-size:14px;color:#737373;margin-bottom:24px}
  .card{display:flex;gap:16px;text-decoration:none;color:#171717;padding:18px 0;border-top:1px solid #f5f5f5}
  .card img,.ph{width:96px;height:96px;border-radius:12px;object-fit:cover;flex:none;background:#f5f5f5}
  .ph{display:flex;align-items:center;justify-content:center;background:${ACCENT};color:#fff;font-weight:900;font-size:22px}
  .card h2{font-size:17px;line-height:1.35;margin:0 0 6px} .card p{font-size:14px;line-height:1.6;color:#525252;margin:0 0 8px}
  .card .meta{font-size:12px;color:#a3a3a3}
  .back{display:inline-block;margin-top:24px;font-weight:700;text-decoration:none}
  footer{border-top:1px solid #e5e5e5;padding:24px;text-align:center;font-size:13px;color:#737373}
  html.dark body{background:#09090b;color:#f4f4f5}
  html.dark header{border-bottom-color:rgba(255,255,255,.1)}
  html.dark .brand small{color:#a3a3a3}
  html.dark .head nav a{color:#f4f4f5}
  html.dark .count{color:#a3a3a3}
  html.dark .card{color:#f4f4f5;border-top-color:rgba(255,255,255,.1)}
  html.dark .card img{background:#27272a}
  html.dark .card p{color:#d4d4d8}
  html.dark footer{border-top-color:rgba(255,255,255,.1);color:#a3a3a3}
</style>
</head>
<body>
<div class="accent"></div>
<header><div class="head"><div class="badge">M</div><div class="brand">MERAMU.CO<small>OFFICIAL PORTAL</small></div><nav><a href="/">Beranda</a><a href="https://instagram.com/meramudotco">Instagram</a></nav></div></header>
<main>${body}</main>
<footer>MERAMU.CO — Portal Berita<br /><a href="/">Kembali ke Beranda</a></footer>
</body>
</html>`;
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || '').trim();
  const category = SLUG_TO_CATEGORY[slug];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!category) {
    return res.status(404).send(shell({
      title: 'Rubrik tidak ditemukan',
      description: 'Rubrik yang kamu cari tidak ada di Meramu.co.',
      canonical: `${SITE_URL}/`,
      body: `<h1>Rubrik tidak ditemukan</h1><p class="count">Alamat ini tidak mengarah ke rubrik mana pun.</p><a class="back" href="/">&larr; Kembali ke Beranda</a>`,
    }));
  }

  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    return res.status(500).send(shell({
      title: 'Rubrik belum bisa dibuka',
      description: 'Terjadi kendala konfigurasi di server.',
      canonical: `${SITE_URL}/kategori/${slug}`,
      body: `<h1>Rubrik belum bisa dibuka</h1><p class="count">Terjadi kendala konfigurasi di server. Coba lagi nanti.</p><a class="back" href="/">&larr; Kembali ke Beranda</a>`,
    }));
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
    return res.status(500).send(shell({
      title: 'Rubrik belum bisa dibuka',
      description: 'Terjadi kendala saat mengambil daftar berita.',
      canonical: `${SITE_URL}/kategori/${slug}`,
      body: `<h1>Rubrik belum bisa dibuka</h1><p class="count">Terjadi kendala saat mengambil daftar berita. Coba lagi nanti.</p><a class="back" href="/">&larr; Kembali ke Beranda</a>`,
    }));
  }

  const items = docs
    .filter((d) => strField(d.fields, 'category') === category)
    .sort((a, b) => msField(b.fields, 'createdAt') - msField(a.fields, 'createdAt'));

  const cards = items.map((d) => {
    const f = d.fields;
    const title = strField(f, 'title') || 'Tanpa judul';
    const excerpt = strField(f, 'excerpt');
    const imageUrl = strField(f, 'imageUrl');
    const author = strField(f, 'author') || 'Redaksi Meramu';
    const dateStr = formatDate(msField(f, 'createdAt'));
    const readTime = strField(f, 'readTime');
    const meta = [author, dateStr, readTime].filter(Boolean).join(' • ');
    const thumb = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="" />`
      : `<div class="ph">M</div>`;
    return `<a class="card" href="/berita/${encodeURIComponent(d.id)}">${thumb}<div><h2>${escapeHtml(title)}</h2>${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ''}<div class="meta">${escapeHtml(meta)}</div></div></a>`;
  }).join('\n');

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(shell({
    title: `Rubrik: ${category}`,
    description: `Berita terbaru rubrik ${category} di Meramu.co.`,
    canonical: `${SITE_URL}/kategori/${slug}`,
    body: `<a class="back" style="margin:0 0 20px" href="/">&larr; Beranda</a>
<div style="margin-top:20px"><span class="chip">Rubrik</span></div>
<h1>${escapeHtml(category)}</h1>
<p class="count">${items.length} Artikel Tersedia</p>
${cards || `<p class="count">Belum ada berita di rubrik ini.</p>`}
<a class="back" href="/">&larr; Kembali ke Beranda</a>`,
  }));
}
