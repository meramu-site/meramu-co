// Vercel Serverless Function: the About page is its own real page.
// /tentang is rewritten (vercel.json) to /api/tentang.
// Static content: the user-approved "Tentang Meramu" text (2026-10-30).

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

// Approved text, verbatim (user-approved 2026-10-30, good-news angle removed
// by the user; the unique point is "baca berita secukupnya, lanjut kerja lagi").
const PARAGRAPHS = [
  'Meramu lahir pada 28 Oktober 2026 — bertepatan dengan Hari Sumpah Pemuda, dan di minggu ketika anak muda Indonesia sedang bersuara paling lantang. Kami lahir dari generasi itu, dan untuk mereka.',
  'Kami percaya satu hal sederhana: baca berita secukupnya, lanjut kerja lagi.',
  'Media lain berlomba bikin kamu betah berlama-lama: feed tanpa ujung, notifikasi tanpa henti, rasa takut ketinggalan. Meramu memilih sebaliknya. Kami adalah kurasi harian untuk yang nggak punya waktu banyak — racikan kabar yang dipilih dengan sengaja: budaya pop, musik dan komedi, ekonomi kreatif, teknologi, dan kabar publik, diterjemahkan ke bahasa sehari-hari.',
  'Secukupnya bukan berarti seadanya. Setiap kabar yang lolos kurasi kami harus menjawab satu pertanyaan: apa yang perlu kamu tahu hari ini, supaya kamu bisa lanjut kerja, lanjut kuliah, lanjut hidup — tanpa merasa ketinggalan?',
  'Meramu, dari kata meracik: kami meramu kabar, secukupnya, supaya waktumu kembali jadi milikmu.',
];

export default async function handler(req, res) {
  const title = 'Tentang Meramu';
  const description = 'Baca berita secukupnya, lanjut kerja lagi.';
  const canonical = `${SITE_URL}/tentang`;
  const body = `<a class="back" style="margin:0 0 20px" href="/">&larr; Beranda</a>
<div style="margin-top:20px"><span class="chip">Tentang</span></div>
<h1>${escapeHtml(title)}</h1>
<div class="meta"><b>Meramu</b><span>•</span><span>Lahir 28 Oktober 2026</span></div>
<article>${PARAGRAPHS.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}</article>
<div class="social">
<a href="https://instagram.com/meramufeed" target="_blank" rel="noreferrer">Instagram @meramufeed</a>
<span>•</span>
<a href="https://www.threads.net/@meramufeed" target="_blank" rel="noreferrer">Threads @meramufeed</a>
</div>
<div class="social">
<a href="/privasi">Kebijakan Privasi</a>
<span>•</span>
<a href="/kontak">Kontak Redaksi</a>
</div>
<a class="back" href="/">&larr; Kembali ke Beranda</a>`;

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
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="https://meramu.site/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)} — Meramu" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="https://meramu.site/og-image.png" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Meramu","url":"https://meramu.site","logo":"https://meramu.site/favicon.svg","description":"Baca berita secukupnya, lanjut kerja lagi.","foundingDate":"2026-10-28","sameAs":["https://instagram.com/meramufeed","https://www.threads.net/@meramufeed"]}</script>
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
  .meta b{color:#171717}
  article p{font-size:17px;line-height:1.8;color:#404040;margin:14px 0}
  .social{margin:28px 0;display:flex;gap:8px;flex-wrap:wrap;font-size:14px;font-weight:600}
  .social span{color:#737373}
  .back{display:inline-block;margin-top:32px;font-weight:700;text-decoration:none}
  footer{border-top:1px solid #e5e5e5;padding:24px;text-align:center;font-size:13px;color:#737373}
  @media(max-width:640px){h1{font-size:26px} article p{font-size:16px}}
  html.dark body{background:#09090b;color:#f4f4f5}
  html.dark header{border-bottom-color:rgba(255,255,255,.1)}
  html.dark .brand small{color:#a3a3a3}
  html.dark .head nav a{color:#f4f4f5}
  html.dark .meta{color:#a3a3a3;border-bottom-color:rgba(255,255,255,.1)}
  html.dark .meta b{color:#f4f4f5}
  html.dark article p{color:#d4d4d8}
  html.dark .social span{color:#a3a3a3}
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

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(html);
}
