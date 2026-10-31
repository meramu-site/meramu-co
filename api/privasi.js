// Vercel Serverless Function: static Privacy Policy page.
// /privasi is rewritten (vercel.json) to /api/privasi.
// Content describes the portal's actual data practices as of 2026-10-30:
// Google Analytics for aggregate stats, no reader accounts, no
// newsletter, no third-party ads, admin login for editors only.

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

const TITLE = 'Kebijakan Privasi';
const DESCRIPTION = 'Data apa yang dikumpulkan Meramu dan kenapa. Berlaku sejak 30 Oktober 2026.';

const SECTIONS = [
  {
    h: 'Ringkasnya',
    ps: [
      'Meramu menghargai privasi pembaca. Halaman ini menjelaskan data apa yang kami kumpulkan, kenapa, dan apa yang tidak kami lakukan. Kebijakan ini berlaku sejak 30 Oktober 2026.',
    ],
  },
  {
    h: 'Data yang kami kumpulkan',
    ps: [
      'Google Analytics: kami memakai Google Analytics untuk memahami pembaca secara agregat — halaman apa yang dibaca, perangkat apa yang dipakai, dan perkiraan wilayah (kota/negara). Data ini tidak mengidentifikasi kamu secara pribadi.',
      'Pembaca tidak perlu akun: membaca Meramu tidak meminta nama, email, atau data pribadi apa pun. Tidak ada kolom komentar dan tidak ada formulir yang mengumpulkan data pembaca.',
      'Login admin hanya untuk redaksi: halaman Dapur Redaksi dipakai tim Meramu untuk menulis dan menerbitkan artikel. Akun redaksi tidak dibagikan ke pembaca.',
      'Gambar dari pihak ketiga: sebagian foto artikel dimuat dari server pihak ketiga (misalnya Wikimedia Commons atau CDN promotor). Saat gambar itu dimuat, server tersebut dapat melihat alamat IP perangkatmu, sesuai kebijakan mereka masing-masing.',
    ],
  },
  {
    h: 'Yang tidak kami lakukan',
    ps: [
      'Kami tidak menjual data pembaca ke pihak mana pun.',
      'Kami tidak mengirim newsletter, karena kami tidak mengumpulkan alamat email pembaca.',
      'Kami tidak menayangkan iklan pihak ketiga dan tidak melacak pembaca lintas situs untuk iklan.',
    ],
  },
  {
    h: 'Cookie dan penyimpanan lokal',
    ps: [
      'Google Analytics memakai cookie (misalnya _ga) untuk membedakan kunjungan. Kamu bisa memblokir cookie dari pengaturan browser tanpa merusak bacaan — yang tersimpan lokal di perangkatmu hanya preferensi tampilan (mode gelap/terang dan bahasa), bukan identitasmu.',
    ],
  },
  {
    h: 'Perubahan kebijakan',
    ps: [
      'Bila praktik kami berubah, halaman ini diperbarui dan tanggal berlakunya ikut berubah. Pertanyaan soal privasi bisa disampaikan lewat halaman Kontak atau DM Instagram/Threads @meramufeed.',
    ],
  },
];

export default async function handler(req, res) {
  const canonical = `${SITE_URL}/privasi`;
  const body = `<a class="back" style="margin:0 0 20px" href="/">&larr; Beranda</a>
<div style="margin-top:20px"><span class="chip">Legal</span></div>
<h1>${escapeHtml(TITLE)}</h1>
<div class="meta"><b>Meramu</b><span>•</span><span>Berlaku sejak 30 Oktober 2026</span></div>
<article>${SECTIONS.map((s) => `<h2>${escapeHtml(s.h)}</h2>\n${s.ps.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}`).join('\n')}</article>
<a class="back" href="/">&larr; Kembali ke Beranda</a>`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(TITLE)} — Meramu</title>
<meta name="description" content="${escapeHtml(DESCRIPTION)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<link rel="icon" href="/favicon.ico" />
<meta name="robots" content="max-image-preview:large" />
<meta property="og:title" content="${escapeHtml(TITLE)} — Meramu" />
<meta property="og:description" content="${escapeHtml(DESCRIPTION)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="https://meramu.site/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(TITLE)} — Meramu" />
<meta name="twitter:description" content="${escapeHtml(DESCRIPTION)}" />
<meta name="twitter:image" content="https://meramu.site/og-image.png" />
<script>(function(){function meramuLoadGtag(){window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag('js',new Date());window.gtag('config','${GA_ID}');var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';document.head.appendChild(s);}if(document.readyState==='complete'){meramuLoadGtag();}else{window.addEventListener('load',meramuLoadGtag);}})();</script>
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
  article h2{font-size:21px;margin:26px 0 10px;color:#171717}
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
  html.dark article h2{color:#f4f4f5}
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
