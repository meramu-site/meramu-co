// Vercel Serverless Function: search results are their own real page.
// /cari?q=... is rewritten (vercel.json) to /api/cari (query preserved).
// Searches live from the same public Firestore collection the portal CMS
// writes to. NOTE: fetches up to 100 articles per call; add pagination
// if the portal ever grows past 100 published articles.

const PROJECT_ID = 'meramu-site';
const APP_ID = 'meramu-site-app';
const SITE_URL = 'https://meramu.site';
const ACCENT = '#0D1B8C';
const GA_ID = 'G-J3BTYYC4X8';

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
<meta name="robots" content="max-image-preview:large" />
<meta property="og:title" content="${escapeHtml(title)} — Meramu.co" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="https://meramu.site/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)} — Meramu.co" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="https://meramu.site/og-image.png" />
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
  h1{font-size:26px;line-height:1.25;letter-spacing:-.02em;margin:16px 0 8px}
  .count{font-size:14px;color:#737373;margin-bottom:24px}
  form.search{display:flex;gap:8px;margin:20px 0}
  form.search input{flex:1;padding:12px 16px;border-radius:999px;border:1px solid #e5e5e5;font-size:15px;outline:none}
  form.search button{padding:12px 20px;border-radius:999px;border:none;background:${ACCENT};color:#fff;font-weight:700;font-size:14px;cursor:pointer}
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
  html.dark form.search input{background:#27272a;border-color:rgba(255,255,255,.15);color:#f4f4f5}
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
  const q = String(req.query.q || '').trim();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const canonical = `${SITE_URL}/cari${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  const searchForm = `<form class="search" action="/cari" method="get"><input type="text" name="q" value="${escapeHtml(q)}" placeholder="Cari topik, berita..." /><button type="submit">Cari</button></form>`;

  if (!q) {
    return res.status(200).send(shell({
      title: 'Cari Berita',
      description: 'Cari berita di Meramu.co.',
      canonical,
      body: `<a class="back" style="margin:0 0 20px" href="/">&larr; Beranda</a>
<h1>Cari Berita</h1>
${searchForm}
<p class="count">Tulis kata kunci, lalu tekan Cari.</p>`,
    }));
  }

  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    return res.status(500).send(shell({
      title: 'Pencarian belum bisa dibuka',
      description: 'Terjadi kendala konfigurasi di server.',
      canonical,
      body: `<h1>Pencarian belum bisa dibuka</h1><p class="count">Terjadi kendala konfigurasi di server. Coba lagi nanti.</p><a class="back" href="/">&larr; Kembali ke Beranda</a>`,
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
      title: 'Pencarian belum bisa dibuka',
      description: 'Terjadi kendala saat mengambil daftar berita.',
      canonical,
      body: `<h1>Pencarian belum bisa dibuka</h1><p class="count">Terjadi kendala saat mengambil daftar berita. Coba lagi nanti.</p><a class="back" href="/">&larr; Kembali ke Beranda</a>`,
    }));
  }

  const needle = q.toLowerCase();
  const items = docs
    .filter((d) => {
      const f = d.fields;
      return [strField(f, 'title'), strField(f, 'excerpt'), strField(f, 'category')]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    })
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
    title: `Hasil cari: ${q}`,
    description: `Hasil pencarian "${q}" di Meramu.co.`,
    canonical,
    body: `<a class="back" style="margin:0 0 20px" href="/">&larr; Beranda</a>
<h1>Hasil cari: &ldquo;${escapeHtml(q)}&rdquo;</h1>
${searchForm}
<p class="count">${items.length} Artikel Ditemukan</p>
${cards || `<p class="count">Tidak ada berita yang cocok dengan kata kunci ini.</p>`}
<a class="back" href="/">&larr; Kembali ke Beranda</a>`,
  }));
}
