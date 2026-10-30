// Vercel Serverless Function: every article is its own real page.
// /berita/<id> is rewritten (vercel.json) to /api/berita?id=<id>.
// The article is read live from the same public Firestore collection the
// portal CMS writes to, so a newly published article gets its own page
// immediately, with no site rebuild.

const PROJECT_ID = 'meramu-site';
const APP_ID = 'meramu-site-app';
const SITE_URL = 'https://meramu.site';
const ACCENT = '#0D1B8C';
const GA_ID = 'G-J3BTYYC4X8';
const DEFAULT_OG = `${SITE_URL}/og-image.png`;

// Mirrors App.tsx CATEGORY_SLUGS, for the chip -> category page link.
const CATEGORY_SLUGS = {
  'Pop Culture': 'pop-culture',
  'Ekonomi Kreatif': 'ekonomi-kreatif',
  'Musik & Komedi': 'musik-komedi',
  'Lifestyle': 'lifestyle',
  'Tech': 'tech',
  'Berita Umum': 'berita-umum',
  'Sports': 'sports',
  'Esports': 'esports',
  'Politik': 'politik',
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
  if (typeof v.integerValue === 'string') return v.integerValue;
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

// Mirrors the portal's renderArticleContent: blank-line separated blocks,
// "## " becomes a subheading, "> " becomes a quote, the rest paragraphs.
function renderContent(raw) {
  if (!raw) return '';
  return raw
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('## ')) {
        return `<h2>${escapeHtml(trimmed.slice(3).trim())}</h2>`;
      }
      if (trimmed.startsWith('> ')) {
        return `<blockquote>${escapeHtml(trimmed.slice(2).trim())}</blockquote>`;
      }
      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .join('\n');
}

function pageShell({ title, description, canonical, ogImage, body, status = 200, jsonLd = '' }) {
  const shareImage = ogImage || DEFAULT_OG;
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — Meramu</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<meta name="robots" content="max-image-preview:large" />
<meta property="og:title" content="${escapeHtml(title)} — Meramu" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="${escapeHtml(shareImage)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)} — Meramu" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(shareImage)}" />
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
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
  h1{font-size:30px;line-height:1.2;letter-spacing:-.02em;margin:16px 0 12px}
  .meta{font-size:13px;color:#737373;display:flex;gap:8px;flex-wrap:wrap;padding-bottom:20px;border-bottom:1px solid #f5f5f5}
  .meta b{color:#171717} figure{margin:24px 0} figure img{width:100%;border-radius:16px;display:block;background:#f5f5f5}
  figcaption{font-size:12px;color:#737373;margin-top:8px} .lead{font-size:18px;line-height:1.7;color:#404040}
  article p{font-size:17px;line-height:1.8;color:#404040;margin:14px 0}
  article h2{font-size:21px;margin:26px 0 10px;color:#171717}
  article blockquote{margin:18px 0;padding:10px 18px;border-left:4px solid ${ACCENT};background:#fafafa;border-radius:0 12px 12px 0;font-style:italic;font-size:18px;color:#404040}
  .back{display:inline-block;margin-top:32px;font-weight:700;text-decoration:none}
  footer{border-top:1px solid #e5e5e5;padding:24px;text-align:center;font-size:13px;color:#737373}
  @media(max-width:640px){h1{font-size:26px} article p{font-size:16px}}
  html.dark body{background:#09090b;color:#f4f4f5}
  html.dark header{border-bottom-color:rgba(255,255,255,.1)}
  html.dark .brand small{color:#a3a3a3}
  html.dark .head nav a{color:#f4f4f5}
  html.dark .meta{color:#a3a3a3;border-bottom-color:rgba(255,255,255,.1)}
  html.dark .meta b{color:#f4f4f5}
  html.dark figcaption{color:#a3a3a3}
  html.dark .lead{color:#d4d4d8}
  html.dark article p{color:#d4d4d8}
  html.dark article h2{color:#f4f4f5}
  html.dark article blockquote{background:#27272a;color:#d4d4d8}
  html.dark figure img{background:#27272a}
  html.dark footer{border-top-color:rgba(255,255,255,.1);color:#a3a3a3}
</style>
</head>
<body>
<div class="accent"></div>
<header><div class="head"><div class="badge">M</div><div class="brand">MERAMU<small>Gagasan, kultur, cerita — diramu jadi satu.</small></div><nav><a href="/">Beranda</a><a href="https://instagram.com/meramufeed">Instagram</a></nav></div></header>
<main>${body}</main>
<footer>MERAMU — Portal Berita<br /><a href="/">Beranda</a> • <a href="/tentang">Tentang</a> • <a href="/privasi">Privasi</a> • <a href="/kontak">Kontak</a></footer>
</body>
</html>`;
  return { html, status };
}

export default async function handler(req, res) {
  const id = String(req.query.id || '').trim();

  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    const { html } = pageShell({
      title: 'Berita tidak ditemukan',
      description: 'Artikel yang kamu cari tidak ada di Meramu.',
      canonical: `${SITE_URL}/`,
      ogImage: '',
      body: `<h1>Berita tidak ditemukan</h1><p class="lead">Alamat ini tidak mengarah ke artikel mana pun.</p><a class="back" href="/">&larr; Kembali ke Beranda</a>`,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(html);
  }

  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    const { html } = pageShell({
      title: 'Berita belum bisa dibuka',
      description: 'Terjadi kendala konfigurasi di server.',
      canonical: `${SITE_URL}/berita/${encodeURIComponent(id)}`,
      ogImage: '',
      body: `<h1>Berita belum bisa dibuka</h1><p class="lead">Terjadi kendala konfigurasi di server. Coba lagi nanti.</p><a class="back" href="/">&larr; Kembali ke Beranda</a>`,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(html);
  }

  const docPath = `artifacts/${APP_ID}/public/data/articles/${encodeURIComponent(id)}`;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?key=${apiKey}`;

  let doc;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Firestore ${r.status}`);
    doc = await r.json();
  } catch {
    const { html } = pageShell({
      title: 'Berita tidak ditemukan',
      description: 'Artikel yang kamu cari tidak ada di Meramu.',
      canonical: `${SITE_URL}/`,
      ogImage: '',
      body: `<h1>Berita tidak ditemukan</h1><p class="lead">Artikel ini mungkin sudah dihapus atau alamatnya salah.</p><a class="back" href="/">&larr; Kembali ke Beranda</a>`,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(html);
  }

  const f = doc.fields || {};
  const title = strField(f, 'title') || 'Tanpa judul';
  const excerpt = strField(f, 'excerpt');
  const content = strField(f, 'content');
  const category = strField(f, 'category');
  const author = strField(f, 'author') || 'Redaksi Meramu';
  const readTime = strField(f, 'readTime');
  const imageUrl = strField(f, 'imageUrl');
  const imageCaption = strField(f, 'imageCaption');
  const createdMs = msField(f, 'createdAt');
  const updatedMs = msField(f, 'updatedAt') || createdMs;
  const dateStr = formatDate(createdMs);
  const canonical = `${SITE_URL}/berita/${encodeURIComponent(id)}`;
  const categorySlug = CATEGORY_SLUGS[category] || '';

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    description: excerpt || title,
    image: imageUrl ? [imageUrl] : [DEFAULT_OG],
    author: { '@type': 'Organization', name: author, url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'Meramu',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    inLanguage: 'id-ID',
  };
  if (category) ld.articleSection = category;
  if (createdMs) ld.datePublished = new Date(createdMs).toISOString();
  if (updatedMs) ld.dateModified = new Date(updatedMs).toISOString();
  const jsonLd = JSON.stringify(ld).replace(/</g, '\\u003c');

  const metaBits = [author, dateStr, readTime].filter(Boolean).map(escapeHtml);
  const body = `<a class="back" style="margin:0 0 20px" href="/">&larr; Beranda</a>
${category ? `<div style="margin-top:20px">${categorySlug ? `<a class="chip" style="text-decoration:none" href="/kategori/${categorySlug}">${escapeHtml(category)}</a>` : `<span class="chip">${escapeHtml(category)}</span>`}</div>` : ''}
<h1>${escapeHtml(title)}</h1>
<div class="meta">${metaBits.map((b, i) => (i === 0 ? `<b>${b}</b>` : `<span>•</span><span>${b}</span>`)).join('')}</div>
${imageUrl ? `<figure><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" />${imageCaption ? `<figcaption>${escapeHtml(imageCaption)}</figcaption>` : ''}</figure>` : ''}
${excerpt ? `<p class="lead">${escapeHtml(excerpt)}</p>` : ''}
<article>${renderContent(content)}</article>
<a class="back" href="/">&larr; Kembali ke Beranda</a>`;

  const { html } = pageShell({
    title,
    description: excerpt || title,
    canonical,
    ogImage: imageUrl,
    body,
    jsonLd,
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(html);
}
