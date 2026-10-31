// Vercel Serverless Function: static Contact page.
// /kontak is rewritten (vercel.json) to /api/kontak.
// Contact routes use only public handles (@meramufeed). No email
// address is published here — if the user later approves one, add it.

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

const TITLE = 'Kontak Redaksi';
const DESCRIPTION = 'Hubungi Redaksi Meramu lewat Instagram dan Threads @meramufeed.';

export default async function handler(req, res) {
  const canonical = `${SITE_URL}/kontak`;
  const body = `<a class="back" style="margin:0 0 20px" href="/">&larr; Beranda</a>
<div style="margin-top:20px"><span class="chip">Kontak</span></div>
<h1>${escapeHtml(TITLE)}</h1>
<div class="meta"><b>Meramu</b><span>•</span><span>Redaksi</span></div>
<article>
<p>Punya kabar untuk diliput, koreksi untuk artikel yang sudah tayang, atau saran buat Meramu? Hubungi redaksi lewat kanal berikut. Kami membaca semua pesan yang masuk.</p>
</article>
<div class="social">
<a href="https://instagram.com/meramufeed" target="_blank" rel="noreferrer">Instagram @meramufeed</a>
<span>•</span>
<a href="https://www.threads.net/@meramufeed" target="_blank" rel="noreferrer">Threads @meramufeed</a>
</div>
<article>
<p>Untuk koreksi berita, sertakan link artikel dan bagian yang perlu dikoreksi supaya bisa kami periksa dan perbaiki.</p>
</article>
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
  .head-actions{margin-left:0;display:flex;align-items:center;gap:8px;flex:none}
  .meramu-theme-btn,.meramu-menu-btn{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid #e5e5e5;background:#fff;color:#171717;cursor:pointer;padding:0}
  .meramu-theme-btn svg,.meramu-menu-btn svg{width:20px;height:20px;display:block}
  .meramu-theme-btn .theme-icon-sun{display:none}
  html.dark .meramu-theme-btn .theme-icon-sun{display:inline-flex}
  html.dark .meramu-theme-btn .theme-icon-moon{display:none}
  .meramu-mmenu{display:none;border-top:1px solid #e5e5e5;padding:4px 16px 12px}
  .meramu-mmenu.open{display:block}
  .meramu-mmenu a{display:block;padding:11px 0;text-decoration:none;color:#171717;font-weight:600;font-size:15px;border-bottom:1px solid #f5f5f5}
  .meramu-mmenu a:last-child{border-bottom:0}
  html.dark .meramu-theme-btn,html.dark .meramu-menu-btn{background:#18181b;border-color:rgba(255,255,255,.15);color:#f4f4f5}
  html.dark .meramu-mmenu{border-top-color:rgba(255,255,255,.1)}
  html.dark .meramu-mmenu a{color:#f4f4f5;border-bottom-color:rgba(255,255,255,.1)}
  @media(max-width:640px){.head nav{display:none}.head-actions{margin-left:auto}}
</style>
</head>
<body>
<div class="accent"></div>
<header><div class="head"><div class="badge">M</div><div class="brand">MERAMU<small>Gagasan, kultur, cerita — diramu jadi satu.</small></div><nav><a href="/">Beranda</a><a href="https://instagram.com/meramufeed">Instagram</a></nav><div class="head-actions"><button type="button" class="meramu-theme-btn" aria-label="Mode gelap"><span class="theme-icon-moon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span><span class="theme-icon-sun"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></span></button><button type="button" class="meramu-menu-btn" aria-label="Menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button></div></div><nav class="meramu-mmenu"><a href="/">Beranda</a><a href="/kategori/pop-culture">Pop Culture</a><a href="/kategori/ekonomi-kreatif">Ekonomi Kreatif</a><a href="/kategori/musik">Musik</a><a href="/kategori/entertainment">Entertainment</a><a href="/kategori/lifestyle">Lifestyle</a><a href="/kategori/tech">Tech</a><a href="/kategori/berita-umum">Berita Umum</a><a href="/kategori/sports">Sports</a><a href="/kategori/esports">Esports</a><a href="/kategori/politik">Politik</a><a href="https://instagram.com/meramufeed">Instagram</a><a href="https://www.threads.net/@meramufeed">Threads</a></nav></header><script>(function(){var themeBtn=document.querySelector('.meramu-theme-btn');var menuBtn=document.querySelector('.meramu-menu-btn');var menu=document.querySelector('.meramu-mmenu');function syncTheme(){if(!themeBtn)return;var dark=document.documentElement.classList.contains('dark');themeBtn.setAttribute('aria-label',dark?'Mode terang':'Mode gelap');}syncTheme();if(themeBtn){themeBtn.addEventListener('click',function(){var dark=document.documentElement.classList.toggle('dark');try{localStorage.setItem('meramu-theme',dark?'dark':'light');}catch(e){}syncTheme();});}if(menuBtn&&menu){menuBtn.addEventListener('click',function(){var open=menu.classList.toggle('open');menuBtn.setAttribute('aria-expanded',open?'true':'false');});menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){menu.classList.remove('open');menuBtn.setAttribute('aria-expanded','false');});});}})();</script>
<main>${body}</main>
<footer>MERAMU — Portal Berita<br /><a href="/">Beranda</a> • <a href="/tentang">Tentang</a> • <a href="/privasi">Privasi</a> • <a href="/kontak">Kontak</a></footer>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(html);
}
