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
  'musik': 'Musik',
  'entertainment': 'Entertainment',
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

// Resize Wikimedia images via Special:FilePath (PageSpeed fix, Oct 2026).
// Same helper as api/berita.js, api/cari.js and src/App.tsx (duplicated on
// purpose so a serverless file never breaks on a bundling miss). See
// api/berita.js for the full explanation: FilePath widths are verified
// working, direct /thumb/ widths are not.
// Fallback URL for an image: the FilePath JPEG/PNG for Wikimedia files,
// the original URL for same-origin local files. For pass-through URLs
// (already-thumb, other CDNs) this equals the input, so no fallback is added.
function wikimediaFilePath(url, width) {
  if (!url || typeof url !== 'string') return url;
  // Self-hosted /img/ fallback (migration, Nov 2026): the JPEG sibling
  // of the same base, used as the onerror fallback for /img/ images.
  // Absolute in, absolute out; relative in, relative out.
  const selfImg = url.match(/^(https:\/\/meramu\.site)?\/img\/([a-z0-9-]+)\.webp$/);
  if (selfImg) {
    const base = selfImg[2].replace(/-(500|800|1200)$/, '');
    return `${selfImg[1] || ''}/img/${base}-1200.jpg`;
  }
  const up = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/([^/]+)\/(?!thumb\/)[^/]+\/[^/]+\/(.+)$/);
  if (up) {
    const host = up[1] === 'commons' ? 'commons.wikimedia.org' : `${up[1]}.wikipedia.org`;
    return `https://${host}/wiki/Special:FilePath/${up[2]}?width=${width}`;
  }
  const fp = url.match(/^https:\/\/(commons\.wikimedia\.org|[a-z-]+\.wikipedia\.org)\/wiki\/Special:FilePath\/([^?#]+)/);
  if (fp) return `https://${fp[1]}/wiki/Special:FilePath/${fp[2]}?width=${width}`;
  return url;
}

// Resize + WebP via images.weserv.nl (PageSpeed fix, Oct 2026). Verified
// live: direct Wikimedia uploads and meramu.site files convert (e.g.
// 329KB JPEG -> 121KB WebP); FilePath inputs need ?width= inside the
// proxied URL (a plain FilePath without width 404s on weserv).
// Already-thumb URLs and other CDNs pass through unchanged. No quality
// param: w + output=webp only. NOTE: intentionally duplicated in
// api/kategori.js, api/cari.js, api/index.js and src/App.tsx (no shared
// import, so a serverless file can never break because of a bundling
// miss). Keep the copies in sync.
function wikimediaThumb(url, width) {
  if (!url || typeof url !== 'string') return url;
  // Self-hosted /img/ variants (migration, Nov 2026): the stored form is
  // https://meramu.site/img/<base>.webp (or relative /img/<base>.webp).
  // Map the requested width to the nearest generated size; a trailing
  // size suffix on the input is stripped first so sized URLs re-map.
  // This branch MUST stay above the same-origin rule below, or /img/
  // URLs would still go through weserv.
  const selfImg = url.match(/^(https:\/\/meramu\.site)?\/img\/([a-z0-9-]+)\.webp$/);
  if (selfImg) {
    const base = selfImg[2].replace(/-(500|800|1200)$/, '');
    const w = width <= 500 ? 500 : width <= 800 ? 800 : 1200;
    return `${selfImg[1] || ''}/img/${base}-${w}.webp`;
  }
  const up = url.match(/^https:\/\/(upload\.wikimedia\.org\/wikipedia\/([^/]+)\/(?!thumb\/)[^/]+\/[^/]+\/[^?#]+)/);
  if (up) return `https://images.weserv.nl/?url=${up[1]}&w=${width}&output=webp`;
  const fp = url.match(/^https:\/\/(commons\.wikimedia\.org|[a-z-]+\.wikipedia\.org)\/wiki\/Special:FilePath\/([^?#]+)/);
  if (fp) return `https://images.weserv.nl/?url=${fp[1]}/wiki/Special:FilePath/${fp[2]}?width=${width}&w=${width}&output=webp`;
  const local = url.match(/^https:\/\/meramu\.site\/([^?#]+)/);
  if (local) return `https://images.weserv.nl/?url=meramu.site/${local[1]}&w=${width}&output=webp`;
  return url;
}

// onerror attribute for a weserv <img>: on failure, swap to the fallback
// (FilePath for Wikimedia, original local URL for same-origin files).
// Empty when the src is not a weserv URL (nothing to fall back from).
// For srcset images the srcset is dropped first, otherwise the browser
// would re-pick the broken weserv candidate instead of the fallback.
function imgFallback(url, width, hasSrcset) {
  const t = wikimediaThumb(url, width);
  const f = wikimediaFilePath(url, width);
  if (t === f) return '';
  const esc = f.replace(/&/g, '&amp;').replace(/'/g, "\\'");
  return hasSrcset
    ? ` onerror="this.onerror=null;this.removeAttribute('srcset');this.src='${esc}'"`
    : ` onerror="this.onerror=null;this.src='${esc}'"`;
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


function shell({ title, description, canonical, body }) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — Meramu</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
  <link rel="alternate" type="application/rss+xml" href="https://meramu.site/feed.xml">
<link rel="icon" href="/favicon.ico" />
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
<script>(function(){function meramuLoadGtag(){window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag('js',new Date());window.gtag('config','${GA_ID}');var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';document.head.appendChild(s);}if(document.readyState==='complete'){meramuLoadGtag();}else{window.addEventListener('load',meramuLoadGtag);}})();</script>
<script>(function(){try{if(localStorage.getItem('meramu-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();</script>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:ui-sans-system,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#171717;background:#fff}
  a{color:${ACCENT}} .accent{height:6px;background:${ACCENT}}
  header{border-bottom:1px solid #e5e5e5} .head{max-width:768px;margin:0 auto;padding:16px;display:flex;align-items:center;gap:12px}
  .brand-link{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit}
  .badge{width:36px;height:36px;border-radius:10px;background:${ACCENT};color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}
  .brand{font-weight:900;letter-spacing:.02em;color:#0D1B8C} .brand small{display:block;font-size:10px;letter-spacing:normal;color:#000}
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
  html.dark .brand{color:#8EA2FF}html.dark .brand small{color:#f4f4f5}
  html.dark .head nav a{color:#f4f4f5}
  html.dark .count{color:#a3a3a3}
  html.dark .card{color:#f4f4f5;border-top-color:rgba(255,255,255,.1)}
  html.dark .card img{background:#27272a}
  html.dark .card p{color:#d4d4d8}
  html.dark footer{border-top-color:rgba(255,255,255,.1);color:#a3a3a3}
  .head-actions{margin-left:0;display:flex;align-items:center;gap:8px;flex:none}
  .meramu-theme-btn,.meramu-menu-btn{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid #e5e5e5;background:#fff;color:#171717;cursor:pointer;padding:0}
  .meramu-theme-btn svg,.meramu-menu-btn svg{width:20px;height:20px;display:block}
  .meramu-theme-btn .theme-icon-sun{display:none}
  html.dark .meramu-theme-btn .theme-icon-sun{display:inline-flex}
  html.dark .meramu-theme-btn .theme-icon-moon{display:none}
  .meramu-mmenu{
    position: fixed; top: 62px; left: auto; right: 10px; bottom: auto; width: min(420px, calc(100vw - 20px)); max-height: min(72vh, 560px);
    background: #fff; border: 1px solid #ececec; border-radius: 14px;
    box-shadow: 0 12px 28px -14px rgba(0,0,0,.3);
    display: flex; flex-direction: column;
    visibility: hidden; opacity: 0; z-index: 60;
    transition: visibility 300ms ease-in-out, opacity 300ms ease-in-out;
    will-change: opacity;
  }
  .meramu-mmenu.open{ visibility: visible; opacity: 1; }
  .meramu-mmenu-scroll{ overflow: auto; overscroll-behavior: contain;
    padding: 8px 16px; flex: 1; min-height: 0; }
  .meramu-parent{ display: flex; align-items: center; justify-content: space-between;
    width: 100%; min-height: 42px; padding: 10px 0;
    font-family: inherit; font-size: 15.5px; font-weight: 700; color: #171717;
    text-decoration: none; background: none; border: 0; border-bottom: 1px solid #f5f5f5;
    text-align: left; cursor: pointer; }
  .meramu-arrow{ color: #a3a3a3; }
  .meramu-chev{ width: 8px; height: 8px; min-width: 8px;
    border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
    transform: rotate(45deg); transition: transform 200ms; }
  .meramu-parent-btn[aria-expanded="true"] .meramu-chev{ transform: rotate(-135deg); }
  .meramu-sub{ display: grid; grid-template-rows: 0fr; visibility: hidden;
    transition: grid-template-rows 220ms cubic-bezier(.16,1,.3,1), visibility 220ms; }
  .meramu-sub.open{ grid-template-rows: 1fr; visibility: visible; }
  .meramu-sub>div{ overflow: hidden; min-height: 0; }
  .meramu-cols{ columns: 2; column-gap: 10px; }
  .meramu-child{ break-inside: avoid; display: flex; align-items: center; gap: 7px;
    padding: 6px 2px; font-size: 12.5px; font-weight: 600; color: #4a4a4a;
    text-decoration: none; }
  .meramu-ico{ width: 22px; height: 22px; min-width: 22px; border-radius: 6px;
    background: #0D1B8C; color: #fff; font-size: 9px; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center; }
  .meramu-ico svg{width:14px;height:14px;display:block}
  .meramu-kontak-row{ display: flex; align-items: center; gap: 7px;
    padding: 9px 2px; font-size: 13.5px; color: #171717; text-decoration: none; }
  .meramu-handle{ margin-left: auto; font-size: 9.5px; color: #737373; }
  .meramu-mmenu-foot{ flex-shrink: 0; display: flex; align-items: center;
    justify-content: space-between; padding: 12px 16px;
    border-top: 1px solid #e5e5e5; }
  .meramu-mmenu-foot a{ font-size: 14px; font-weight: 600; color: #171717; text-decoration: none; }
  .meramu-foot-theme{ background: none; border: 0; padding: 0;
    font-family: inherit; font-size: 14px; font-weight: 600; color: #171717; cursor: pointer; }
  .scrim{ position: fixed; inset: 0; background: rgba(15,15,20,.28);
    opacity: 0; visibility: hidden; z-index: 55;
    transition: opacity .18s ease; }
  .scrim.open{ opacity: 1; visibility: visible; }
  .meramu-menu-btn{ position: relative; z-index: 70; }
  .meramu-menu-btn::after{ content:""; position:absolute; inset:-4px; }
  .meramu-menu-btn .icon-burger,.meramu-menu-btn .icon-x{ display: inline-flex; }
  .meramu-menu-btn .icon-x{ display: none; }
  .meramu-menu-btn.open .icon-burger{ display: none; }
  .meramu-menu-btn.open .icon-x{ display: inline-flex; }
  html.dark .meramu-theme-btn,html.dark .meramu-menu-btn{background:#18181b;border-color:rgba(255,255,255,.15);color:#f4f4f5}
  html.dark .meramu-mmenu{ background:#18181b; border-color: rgba(255,255,255,.15); }
  html.dark .meramu-parent{ color:#f4f4f5; border-bottom-color:rgba(255,255,255,.1); }
  html.dark .meramu-child{ color:#d4d4d8; }
  html.dark .meramu-kontak-row{ color:#f4f4f5; }
  html.dark .meramu-handle{ color:#a3a3a3; }
  html.dark .meramu-arrow{ color:#a3a3a3; }
  html.dark .meramu-mmenu-foot{ border-top-color:rgba(255,255,255,.1); }
  html.dark .meramu-mmenu-foot a,html.dark .meramu-foot-theme{ color:#f4f4f5; }
  html.dark .scrim{ background: rgba(0,0,0,.5); }
  @media (min-width:769px){
    .meramu-mmenu{ right:max(16px, calc((100vw - 768px)/2 + 16px)); width:380px; }
  }
  @media (prefers-reduced-motion: reduce){
    .meramu-mmenu, .scrim, .meramu-sub, .meramu-chev{ transition: none; }
  }
  @media(max-width:640px){.head nav{display:none}.head-actions{margin-left:auto}}
</style>
</head>
<body>
<div class="accent"></div>
<header><div class="head"><a href="/" class="brand-link"><div class="badge">M</div><div class="brand">MERAMU<small>Gagasan, kultur, cerita — diramu jadi satu.</small></div></a><nav><a href="/">Beranda</a><a href="https://instagram.com/meramufeed">Instagram</a></nav><div class="head-actions"><button type="button" class="meramu-theme-btn" aria-label="Mode gelap"><span class="theme-icon-moon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span><span class="theme-icon-sun"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></span></button><button type="button" class="meramu-menu-btn" aria-label="Menu" aria-expanded="false"><span class="icon-burger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg></span><span class="icon-x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></span></button></div></div><nav class="meramu-mmenu"><div class="meramu-mmenu-scroll"><a class="meramu-parent" href="/">Beranda<span class="meramu-arrow">→</span></a><button type="button" class="meramu-parent meramu-parent-btn" aria-expanded="false" aria-controls="meramu-sub-rubrik">Rubrik<span class="meramu-chev"></span></button><div class="meramu-sub" id="meramu-sub-rubrik"><div><div class="meramu-cols"><a class="meramu-child" href="/kategori/pop-culture"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3L14.5 8.5L20.5 9.3L16.1 13.5L17.2 19.5L12 16.6L6.8 19.5L7.9 13.5L3.5 9.3L9.5 8.5Z"/></svg></span>Pop Culture</a><a class="meramu-child" href="/kategori/ekonomi-kreatif"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0-3.3 11c.7.5 1.3 1.3 1.3 2h4c0-.7.6-1.5 1.3-2A6 6 0 0 0 12 3z"/><path d="M10 18.5h4M10 21h4"/></svg></span>Ekonomi Kreatif</a><a class="meramu-child" href="/kategori/musik"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor" stroke="none"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor" stroke="none"/></svg></span>Musik</a><a class="meramu-child" href="/kategori/entertainment"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg></span>Entertainment</a><a class="meramu-child" href="/kategori/lifestyle"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20s-7-4.5-9-9c-1.5-3.5 1-7 4.5-7 2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 22.5 7.5 21 11c-2 4.5-9 9-9 9z"/></svg></span>Lifestyle</a><a class="meramu-child" href="/kategori/tech"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 6V3M15 6V3M9 18v3M15 18v3M6 9H3M6 15H3M18 9h3M18 15h3"/></svg></span>Tech</a><a class="meramu-child" href="/kategori/berita-umum"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h5M8 12h5M8 15h3"/><rect x="14" y="8.5" width="3.5" height="3.5" fill="currentColor" stroke="none"/></svg></span>Berita Umum</a><a class="meramu-child" href="/kategori/sports"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4c-3 5-3 11 0 16M4.5 9.5c4 2 11 2 15 0"/></svg></span>Sports</a><a class="meramu-child" href="/kategori/esports"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10a5 5 0 0 1 5 5c0 2.5-1.5 4-3.5 4-1.5 0-2-.8-3-1.5h-7c-1 .7-1.5 1.5-3 1.5C3.5 16 2 14.5 2 12a5 5 0 0 1 5-5z"/><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M15 11v2M14 12h2"/></svg></span>Esports</a><a class="meramu-child" href="/kategori/politik"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10l9-5 9 5M4 20h16M6 20v-7M10 20v-7M14 20v-7M18 20v-7"/></svg></span>Politik</a><a class="meramu-child" href="/"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="6" height="6" rx="1.5"/><rect x="13" y="5" width="6" height="6" rx="1.5"/><rect x="5" y="13" width="6" height="6" rx="1.5"/><rect x="13" y="13" width="6" height="6" rx="1.5"/></svg></span>Semua</a></div></div></div><button type="button" class="meramu-parent meramu-parent-btn" aria-expanded="false" aria-controls="meramu-sub-kontak">Kontak<span class="meramu-chev"></span></button><div class="meramu-sub" id="meramu-sub-kontak"><div><a class="meramu-kontak-row" href="https://instagram.com/meramufeed"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none"/></svg></span>Instagram<span class="meramu-handle">@meramufeed</span></a><a class="meramu-kontak-row" href="https://www.threads.net/@meramufeed"><span class="meramu-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17.5" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor" font-family="Arial, Helvetica, sans-serif">@</text></svg></span>Threads<span class="meramu-handle">@meramufeed</span></a><a class="meramu-kontak-row" href="https://x.com/meramudotco"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg></span>X / Twitter<span class="meramu-handle">@meramudotco</span></a><a class="meramu-kontak-row" href="mailto:sapa@meramu.site"><span class="meramu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 7l8 6 8-6"/></svg></span>Email redaksi<span class="meramu-handle">sapa@meramu.site</span></a></div></div><a class="meramu-parent" href="/tentang">Tentang<span class="meramu-arrow">→</span></a><a class="meramu-parent" href="/privasi">Privasi<span class="meramu-arrow">→</span></a><a class="meramu-parent" href="/tentang">Redaksi<span class="meramu-arrow">→</span></a></div><div class="meramu-mmenu-foot"><a href="/cari">Cari</a><button type="button" class="meramu-foot-theme">Mode gelap</button></div></nav></header><div class="scrim" aria-hidden="true"></div><script>(function(){var themeBtn=document.querySelector('.meramu-theme-btn');var menuBtn=document.querySelector('.meramu-menu-btn');var menu=document.querySelector('.meramu-mmenu');function syncTheme(){if(!themeBtn)return;var dark=document.documentElement.classList.contains('dark');themeBtn.setAttribute('aria-label',dark?'Mode terang':'Mode gelap');var footTheme=document.querySelector('.meramu-foot-theme');if(footTheme)footTheme.textContent=dark?'Mode terang':'Mode gelap';}syncTheme();if(themeBtn){themeBtn.addEventListener('click',function(){var dark=document.documentElement.classList.toggle('dark');try{localStorage.setItem('meramu-theme',dark?'dark':'light');}catch(e){}syncTheme();});}if(menuBtn&&menu){var scrim=document.querySelector('.scrim');var subBtns=menu.querySelectorAll('.meramu-parent-btn');function setSub(btn,open){var sub=document.getElementById(btn.getAttribute('aria-controls'));if(sub)sub.classList.toggle('open',open);btn.setAttribute('aria-expanded',open?'true':'false');}function closeSubs(){subBtns.forEach(function(b){setSub(b,false);});}function setMenu(open){menu.classList.toggle('open',open);menuBtn.classList.toggle('open',open);if(scrim)scrim.classList.toggle('open',open);menuBtn.setAttribute('aria-expanded',open?'true':'false');if(!open)closeSubs();}menuBtn.addEventListener('click',function(){setMenu(!menu.classList.contains('open'));});if(scrim){scrim.addEventListener('click',function(){setMenu(false);});}subBtns.forEach(function(btn){btn.addEventListener('click',function(){var sub=document.getElementById(btn.getAttribute('aria-controls'));var willOpen=sub&&!sub.classList.contains('open');closeSubs();setSub(btn,!!willOpen);});});menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){setMenu(false);});});var footTheme=menu.querySelector('.meramu-foot-theme');if(footTheme&&themeBtn){footTheme.addEventListener('click',function(){themeBtn.click();});}document.addEventListener('keydown',function(e){if(e.key==='Escape')setMenu(false);});}})();</script>
<main>${body}</main>
<footer>MERAMU — Portal Berita<br /><a href="/">Beranda</a> • <a href="/tentang">Tentang</a> • <a href="/privasi">Privasi</a> • <a href="/kontak">Kontak</a> • <a href="/pedoman">Pedoman</a> • <a href="/koreksi">Koreksi</a> • <a href="/beriklan">Beriklan</a></footer>
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
      description: 'Rubrik yang kamu cari tidak ada di Meramu.',
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
    .filter((d) => strField(d.fields, 'category') === category || strField(d.fields, 'secondaryCategory') === category)
    .sort((a, b) => msField(b.fields, 'createdAt') - msField(a.fields, 'createdAt'));
  // Card links use article slugs (Oct 2026); the list fetch already has
  // every title + createdAt needed for the deterministic assignment.
  const slugMap = assignSlugs(docs.map((d) => ({ id: d.id, title: strField(d.fields, 'title'), createdMs: msField(d.fields, 'createdAt') })));

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
      ? `<img src="${escapeHtml(wikimediaThumb(imageUrl, 320))}"${imgFallback(imageUrl, 320, false)} alt="${escapeHtml(title)}" width="96" height="96" loading="lazy" decoding="async" />`
      : `<div class="ph">M</div>`;
    const slug = slugMap.get(d.id) || d.id;
    return `<a class="card" href="/berita/${slug}">${thumb}<div><h2>${escapeHtml(title)}</h2>${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ''}<div class="meta">${escapeHtml(meta)}</div></div></a>`;
  }).join('\n');

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(shell({
    title: `Rubrik: ${category}`,
    description: `Berita terbaru rubrik ${category} di Meramu.`,
    canonical: `${SITE_URL}/kategori/${slug}`,
    body: `<a class="back" style="margin:0 0 20px" href="/">&larr; Beranda</a>
<div style="margin-top:20px"><span class="chip">Rubrik</span></div>
<h1>${escapeHtml(category)}</h1>
<p class="count">${items.length} Artikel Tersedia</p>
${cards || `<p class="count">Belum ada berita di rubrik ini.</p>`}
<a class="back" href="/">&larr; Kembali ke Beranda</a>`,
  }));
}
