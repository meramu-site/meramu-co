// Vercel Serverless Function: the homepage as real server-rendered HTML.
// / is rewritten (vercel.json) to /api/index. The SPA homepage was an
// empty shell (<div id="root">) until a ~1 MB bundle + a Firestore fetch
// finished (mobile FCP 5.8s vs 0.8s for server-rendered articles), so
// crawlers and first-time visitors saw nothing. This page renders the SAME
// content as the SPA default view (category Semua, no search, page 1):
// headline hero, Lagi Viral, Pilihan Redaksi, Terbaru grid, category nav,
// search form. The SPA itself still exists at /home and /dapur-redaksi;
// in-app SPA navigation is state-based and unaffected.
// Reads live from the same public Firestore collection the portal CMS
// writes to (articles + brand settings), so a new publish appears here
// within the cache window. No Firestore writes. NOTE: fetches up to 100
// articles per call; add pagination if the portal ever grows past 100
// published articles.

const PROJECT_ID = 'meramu-site';
const APP_ID = 'meramu-site-app';
const SITE_URL = 'https://meramu.site';
const ACCENT = '#0D1B8C';
const GA_ID = 'G-J3BTYYC4X8';
const GRID_PAGE_SIZE = 6;

const CATEGORY_NAV = [
  ['Semua', '/'],
  ['Pop Culture', '/kategori/pop-culture'],
  ['Ekonomi Kreatif', '/kategori/ekonomi-kreatif'],
  ['Musik', '/kategori/musik'],
  ['Entertainment', '/kategori/entertainment'],
  ['Lifestyle', '/kategori/lifestyle'],
  ['Tech', '/kategori/tech'],
  ['Berita Umum', '/kategori/berita-umum'],
  ['Sports', '/kategori/sports'],
  ['Esports', '/kategori/esports'],
  ['Politik', '/kategori/politik'],
];

const DEFAULT_BRAND = {
  siteName: 'MERAMU',
  tagline: 'Meramu gagasan, kultur pop, dan cerita kreatif terkini.',
  domain: 'meramu.site',
  instagram: 'meramufeed',
  accentColor: '#0D1B8C',
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

function boolField(fields, name) {
  const v = fields?.[name];
  if (!v) return false;
  if (v.booleanValue === true) return true;
  if (v.stringValue === 'true') return true;
  return false;
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

// Same helper as api/berita.js, api/kategori.js, api/cari.js and src/App.tsx
// (duplicated on purpose so a serverless file never breaks on a bundling
// miss). See api/berita.js for the full explanation, including the
// per-language-wiki FilePath fix (Oct 2026).
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
// and src/App.tsx (no shared import). See api/berita.js for the full rules.
function slugifyTitle(title) {
  const s = String(title || '').toLowerCase().replace(/[''']/g, '').replace(/[–—]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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

function shell({ brand, body, heroImage, heroSrcset = '', heroSizes = '', canonicalUrl = SITE_URL + '/' }) {
  const accent = brand.accentColor || ACCENT;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Meramu',
        url: SITE_URL,
        logo: `${SITE_URL}/favicon.svg`,
        description: 'Baca berita secukupnya, lanjut kerja lagi.',
        foundingDate: '2026-10-28',
        sameAs: ['https://instagram.com/meramufeed', 'https://www.threads.net/@meramufeed'],
      },
      { '@type': 'WebSite', name: 'Meramu', url: SITE_URL, inLanguage: 'id-ID' },
    ],
  }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Meramu — Portal Berita</title>
<meta name="description" content="MERAMU — portal berita pop culture, ekonomi kreatif, musik, lifestyle, dan tech." />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<link rel="icon" href="/favicon.ico" />
${heroImage ? `<link rel="preload" as="image" href="${escapeHtml(heroImage)}"${heroSrcset ? ` imagesrcset="${escapeHtml(heroSrcset)}" imagesizes="${escapeHtml(heroSizes)}"` : ''} fetchpriority="high" />` : ''}
<meta name="robots" content="max-image-preview:large" />
<meta property="og:title" content="Meramu — Portal Berita" />
<meta property="og:description" content="Baca berita secukupnya, lanjut kerja lagi." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta property="og:image" content="${SITE_URL}/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Meramu — Portal Berita" />
<meta name="twitter:description" content="Baca berita secukupnya, lanjut kerja lagi." />
<meta name="twitter:image" content="${SITE_URL}/og-image.png" />
<script type="application/ld+json">${jsonLd}</script>
<script>(function(){function meramuLoadGtag(){window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag('js',new Date());window.gtag('config','${GA_ID}');var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';document.head.appendChild(s);}if(document.readyState==='complete'){meramuLoadGtag();}else{window.addEventListener('load',meramuLoadGtag);}})();</script>
<script>(function(){try{if(localStorage.getItem('meramu-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();</script>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:ui-sans-system,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#171717;background:#fff}
  a{color:${accent}} .accent{height:6px;background:${accent}}
  header{border-bottom:1px solid #e5e5e5} .head{max-width:1152px;margin:0 auto;padding:16px 20px;display:flex;align-items:center;gap:12px}
  .brand-link{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit}
  .badge{width:36px;height:36px;border-radius:10px;background:${accent};color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}
  .brand{font-weight:900;letter-spacing:.02em} .brand small{display:block;font-size:10px;letter-spacing:.18em;color:#737373}
  .head nav{margin-left:auto;display:flex;gap:16px;font-size:14px} .head nav a{color:#171717;text-decoration:none;font-weight:600}
  .catnav{max-width:1152px;margin:0 auto;padding:14px 20px 0;display:flex;gap:8px;flex-wrap:wrap}
  .catnav a{display:inline-block;padding:7px 14px;border-radius:999px;border:1px solid #e5e5e5;font-size:13px;font-weight:600;text-decoration:none;color:#404040}
  .catnav a.active{background:#0D1B8C;color:#fff;border-color:#0D1B8C}
  form.search{max-width:1152px;margin:0 auto;padding:16px 20px 0;display:flex;gap:8px}
  form.search input{flex:1;padding:11px 16px;border-radius:999px;border:1px solid #e5e5e5;font-size:15px;outline:none}
  form.search button{padding:11px 20px;border-radius:999px;border:none;background:${accent};color:#fff;font-weight:700;font-size:14px;cursor:pointer}
  main{max-width:1152px;margin:0 auto;padding:24px 20px 56px}
  .hero{display:grid;grid-template-columns:2fr 1fr;gap:24px;align-items:start}
  .hero-card{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid #e5e5e5;border-radius:16px;overflow:hidden}
  .hero-img{position:relative;aspect-ratio:16/9;width:100%;overflow:hidden;background:#f5f5f5}
  .hero-img img{width:100%;height:100%;object-fit:cover;display:block}
  .hero-badges{position:absolute;top:16px;left:16px;display:flex;gap:8px}
  .hero-badges span{padding:5px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .hero-badges .main{background:${accent};color:#fff}
  .hero-badges .cat{background:rgba(255,255,255,.95);color:#171717}
  .hero-body{padding:24px}
  .hero-body h1{font-size:30px;line-height:1.2;letter-spacing:-.02em;margin:0 0 12px}
  .hero-body p{font-size:16px;line-height:1.6;color:#525252;margin:0}
  .hero-meta{margin-top:20px;padding-top:16px;border-top:1px solid #f5f5f5;display:flex;justify-content:space-between;font-size:12px;color:#737373}
  .hero-meta b{color:#171717}
  .side{display:flex;flex-direction:column;gap:16px}
  .box{background:#fff;border:1px solid #e5e5e5;border-radius:16px;overflow:hidden}
  .box-head{background:${accent};color:#fff;padding:10px 16px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
  .viral-list{padding:12px 16px}
  .viral-list a{display:block;text-decoration:none;color:#171717;font-size:14px;font-weight:700;line-height:1.4;padding:8px 0;border-bottom:1px solid #f5f5f5}
  .viral-list a:last-child{border-bottom:0}
  .trend{padding:20px}
  .trend h2{font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${accent};margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #f5f5f5}
  .trend a{display:flex;gap:14px;align-items:flex-start;text-decoration:none;color:inherit;padding:12px 0;border-bottom:1px solid #f5f5f5}
  .trend a:first-of-type{padding-top:0} .trend a:last-child{border-bottom:0;padding-bottom:0}
  .trend .num{font-size:22px;font-weight:900;color:#a3a3a3;line-height:1}
  .trend .tt{flex:1} .trend .tt span{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${accent}}
  .trend .tt b{display:block;font-size:14px;line-height:1.4;margin:4px 0;color:#171717}
  .trend .tt small{font-size:11px;color:#a3a3a3}
  .trend img,.trend .ph{width:80px;height:80px;border-radius:12px;object-fit:cover;flex:none;background:#f5f5f5}
  .trend .ph{display:flex;align-items:center;justify-content:center;background:${accent};color:#fff;font-weight:900;font-size:20px}
  .ig-cta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border-radius:12px;border:1px solid #e5e5e5;text-decoration:none;color:inherit}
  .ig-cta b{display:block;font-size:12px;font-weight:800;color:${accent}}
  .ig-cta span{display:block;font-size:11px;color:#737373}
  .grid-head{display:flex;align-items:center;justify-content:space-between;margin:48px 0 20px;padding-bottom:12px;border-bottom:1px solid #e5e5e5}
  .grid-head h2{font-size:20px;margin:0;display:flex;align-items:center;gap:10px}
  .grid-head h2 i{width:10px;height:10px;border-radius:50%;background:${accent};display:inline-block}
  .grid-head span{font-size:12px;color:#737373}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  .card{display:flex;flex-direction:column;text-decoration:none;color:inherit;background:#fff;border:1px solid #e5e5e5;border-radius:16px;overflow:hidden}
  .card-img{position:relative;aspect-ratio:16/10;width:100%;overflow:hidden;background:#f5f5f5}
  .card-img img{width:100%;height:100%;object-fit:cover;display:block}
  .card-img span{position:absolute;top:12px;left:12px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(255,255,255,.95);color:#171717}
  .card-body{padding:20px;flex:1;display:flex;flex-direction:column;justify-content:space-between}
  .card-body h3{font-size:18px;line-height:1.35;margin:0 0 8px}
  .card-body p{font-size:14px;line-height:1.6;color:#525252;margin:0}
  .card-bar{margin:20px -20px -20px;padding:14px 20px;background:${accent};color:#fff;display:flex;justify-content:space-between;font-size:12px}
  .pager{margin-top:32px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
  .pager a,.pager span{display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:36px;padding:0 12px;border-radius:999px;border:1px solid #e5e5e5;font-size:13px;font-weight:700;text-decoration:none;color:#404040}
  .pager a.current{background:${accent};color:#fff;border-color:${accent}}
  .pager span.disabled{opacity:.4}
  .empty{background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:48px;text-align:center;color:#737373}
  footer{border-top:1px solid #e5e5e5;padding:24px;text-align:center;font-size:13px;color:#737373}
  @media(max-width:900px){.hero{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.hero-body h1{font-size:26px}}
  html.dark body{background:#09090b;color:#f4f4f5}
  html.dark header{border-bottom-color:rgba(255,255,255,.1)}
  html.dark .brand small{color:#a3a3a3}
  html.dark .head nav a{color:#f4f4f5}
  html.dark .catnav a{border-color:rgba(255,255,255,.15);color:#d4d4d8}
  html.dark .catnav a.active{background:#f4f4f5;color:#09090b}
  html.dark form.search input{background:#27272a;border-color:rgba(255,255,255,.15);color:#f4f4f5}
  html.dark .hero-card,html.dark .box,html.dark .card{background:#18181b;border-color:rgba(255,255,255,.1)}
  html.dark .hero-body p,html.dark .card-body p{color:#d4d4d8}
  html.dark .trend .tt b,html.dark .viral-list a{color:#f4f4f5}
  html.dark footer{border-top-color:rgba(255,255,255,.1);color:#a3a3a3}
  .head-actions{margin-left:0;display:flex;align-items:center;gap:8px;flex:none}
  .meramu-theme-btn,.meramu-menu-btn{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid #e5e5e5;background:#fff;color:#171717;cursor:pointer;padding:0}
  .meramu-theme-btn svg,.meramu-menu-btn svg{width:20px;height:20px;display:block}
  .meramu-theme-btn .theme-icon-sun{display:none}
  html.dark .meramu-theme-btn .theme-icon-sun{display:inline-flex}
  html.dark .meramu-theme-btn .theme-icon-moon{display:none}
  .meramu-mmenu{
    position: fixed; top: 62px; left: 10px; right: 10px; bottom: 18px;
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
    .meramu-mmenu{ left:auto; right:calc((100vw - 768px)/2 + 16px); width:380px; bottom:auto; max-height:min(70vh, 640px); }
  }
  @media (prefers-reduced-motion: reduce){
    .meramu-mmenu, .scrim, .meramu-sub, .meramu-chev{ transition: none; }
  }
  @media(max-width:640px){.head nav{display:none}.head-actions{margin-left:auto}}
</style>
</head>
<body>
<div class="accent"></div>
<header><div class="head"><a href="/" class="brand-link"><div class="badge">M</div><div class="brand">${escapeHtml(brand.siteName)}<small>${escapeHtml(brand.tagline)}</small></div></a><nav><a href="/">Beranda</a><a href="https://instagram.com/${escapeHtml(brand.instagram.replace('@', ''))}">Instagram</a></nav><div class="head-actions"><button type="button" class="meramu-theme-btn" aria-label="Mode gelap"><span class="theme-icon-moon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span><span class="theme-icon-sun"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></span></button><button type="button" class="meramu-menu-btn" aria-label="Menu" aria-expanded="false"><span class="icon-burger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg></span><span class="icon-x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></span></button></div></div><nav class="meramu-mmenu"><div class="meramu-mmenu-scroll"><a class="meramu-parent" href="/">Beranda<span class="meramu-arrow">→</span></a><button type="button" class="meramu-parent meramu-parent-btn" aria-expanded="false" aria-controls="meramu-sub-rubrik">Rubrik<span class="meramu-chev"></span></button><div class="meramu-sub" id="meramu-sub-rubrik"><div><div class="meramu-cols"><a class="meramu-child" href="/kategori/pop-culture"><span class="meramu-ico">PC</span>Pop Culture</a><a class="meramu-child" href="/kategori/ekonomi-kreatif"><span class="meramu-ico">EK</span>Ekonomi Kreatif</a><a class="meramu-child" href="/kategori/musik"><span class="meramu-ico">MU</span>Musik</a><a class="meramu-child" href="/kategori/entertainment"><span class="meramu-ico">EN</span>Entertainment</a><a class="meramu-child" href="/kategori/lifestyle"><span class="meramu-ico">LI</span>Lifestyle</a><a class="meramu-child" href="/kategori/tech"><span class="meramu-ico">TC</span>Tech</a><a class="meramu-child" href="/kategori/berita-umum"><span class="meramu-ico">BU</span>Berita Umum</a><a class="meramu-child" href="/kategori/sports"><span class="meramu-ico">SP</span>Sports</a><a class="meramu-child" href="/kategori/esports"><span class="meramu-ico">ES</span>Esports</a><a class="meramu-child" href="/kategori/politik"><span class="meramu-ico">PO</span>Politik</a><a class="meramu-child" href="/"><span class="meramu-ico">SE</span>Semua</a></div></div></div><button type="button" class="meramu-parent meramu-parent-btn" aria-expanded="false" aria-controls="meramu-sub-kontak">Kontak<span class="meramu-chev"></span></button><div class="meramu-sub" id="meramu-sub-kontak"><div><a class="meramu-kontak-row" href="https://instagram.com/${escapeHtml(brand.instagram.replace('@', ''))}"><span class="meramu-ico">IG</span>Instagram<span class="meramu-handle">@meramufeed</span></a><a class="meramu-kontak-row" href="https://www.threads.net/@meramufeed"><span class="meramu-ico">TH</span>Threads<span class="meramu-handle">@meramufeed</span></a><a class="meramu-kontak-row" href="https://x.com/meramudotco"><span class="meramu-ico">X</span>X / Twitter<span class="meramu-handle">@meramudotco</span></a><span class="meramu-kontak-row"><span class="meramu-ico">✉</span>Email redaksi<span class="meramu-handle">contact@meramu.site</span></span></div></div><a class="meramu-parent" href="/tentang">Tentang<span class="meramu-arrow">→</span></a><a class="meramu-parent" href="/privasi">Privasi<span class="meramu-arrow">→</span></a><a class="meramu-parent" href="/tentang">Redaksi<span class="meramu-arrow">→</span></a></div><div class="meramu-mmenu-foot"><a href="/cari">Cari</a><button type="button" class="meramu-foot-theme">Mode gelap</button></div></nav></header><div class="scrim" aria-hidden="true"></div><script>(function(){var themeBtn=document.querySelector('.meramu-theme-btn');var menuBtn=document.querySelector('.meramu-menu-btn');var menu=document.querySelector('.meramu-mmenu');function syncTheme(){if(!themeBtn)return;var dark=document.documentElement.classList.contains('dark');themeBtn.setAttribute('aria-label',dark?'Mode terang':'Mode gelap');var footTheme=document.querySelector('.meramu-foot-theme');if(footTheme)footTheme.textContent=dark?'Mode terang':'Mode gelap';}syncTheme();if(themeBtn){themeBtn.addEventListener('click',function(){var dark=document.documentElement.classList.toggle('dark');try{localStorage.setItem('meramu-theme',dark?'dark':'light');}catch(e){}syncTheme();});}if(menuBtn&&menu){var scrim=document.querySelector('.scrim');var subBtns=menu.querySelectorAll('.meramu-parent-btn');function setSub(btn,open){var sub=document.getElementById(btn.getAttribute('aria-controls'));if(sub)sub.classList.toggle('open',open);btn.setAttribute('aria-expanded',open?'true':'false');}function closeSubs(){subBtns.forEach(function(b){setSub(b,false);});}function setMenu(open){menu.classList.toggle('open',open);menuBtn.classList.toggle('open',open);if(scrim)scrim.classList.toggle('open',open);menuBtn.setAttribute('aria-expanded',open?'true':'false');if(!open)closeSubs();}menuBtn.addEventListener('click',function(){setMenu(!menu.classList.contains('open'));});if(scrim){scrim.addEventListener('click',function(){setMenu(false);});}subBtns.forEach(function(btn){btn.addEventListener('click',function(){var sub=document.getElementById(btn.getAttribute('aria-controls'));var willOpen=sub&&!sub.classList.contains('open');closeSubs();setSub(btn,!!willOpen);});});menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){setMenu(false);});});var footTheme=menu.querySelector('.meramu-foot-theme');if(footTheme&&themeBtn){footTheme.addEventListener('click',function(){themeBtn.click();});}document.addEventListener('keydown',function(e){if(e.key==='Escape')setMenu(false);});}})();</script>
<nav class="catnav">${CATEGORY_NAV.map(([label, href]) => `<a href="${href}"${label === 'Semua' ? ' class="active"' : ''}>${escapeHtml(label)}</a>`).join('')}</nav>
<form class="search" action="/cari" method="get"><input type="text" name="q" placeholder="Cari topik, berita..." /><button type="submit">Cari</button></form>
<main>${body}</main>
<footer>MERAMU — Portal Berita<br /><a href="/">Beranda</a> • <a href="/tentang">Tentang</a> • <a href="/privasi">Privasi</a> • <a href="/kontak">Kontak</a></footer>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    return res.status(500).send(shell({
      brand: DEFAULT_BRAND,
      body: `<div class="empty"><h1>Beranda belum bisa dibuka</h1><p>Terjadi kendala konfigurasi di server. Coba lagi nanti.</p></div>`,
    }));
  }

  // Articles + brand settings in parallel; a brand failure falls back to
  // defaults (the page must still render), an articles failure is a 500.
  const listUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/articles?pageSize=100&key=${apiKey}`;
  const brandUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/settings/brand?key=${apiKey}`;
  let docs = null;
  let brand = { ...DEFAULT_BRAND };
  try {
    const [lr, br] = await Promise.all([fetch(listUrl), fetch(brandUrl)]);
    if (!lr.ok) throw new Error(`Firestore ${lr.status}`);
    const lj = await lr.json();
    docs = (lj.documents || []).map((d) => {
      const ff = d.fields || {};
      return {
        id: String(d.name || '').split('/').pop(),
        title: strField(ff, 'title'),
        excerpt: strField(ff, 'excerpt'),
        category: strField(ff, 'category'),
        author: strField(ff, 'author') || 'Redaksi Meramu',
        readTime: strField(ff, 'readTime'),
        imageUrl: strField(ff, 'imageUrl'),
        createdMs: msField(ff, 'createdAt'),
        isFeatured: boolField(ff, 'isFeatured'),
        isTrending: boolField(ff, 'isTrending'),
        isViral: boolField(ff, 'isViral'),
      };
    }).filter((a) => a.id && a.title);
    if (br.ok) {
      const bj = await br.json();
      const bf = bj.fields || {};
      // Same legacy upgrade as the SPA: old default black -> Royal Blue.
      const accent = strField(bf, 'accentColor');
      brand = {
        siteName: strField(bf, 'siteName') || DEFAULT_BRAND.siteName,
        tagline: strField(bf, 'tagline') || DEFAULT_BRAND.tagline,
        domain: strField(bf, 'domain') || DEFAULT_BRAND.domain,
        instagram: strField(bf, 'instagram') || DEFAULT_BRAND.instagram,
        accentColor: !accent || accent === '#111827' ? '#0D1B8C' : accent,
      };
    }
  } catch {
    return res.status(500).send(shell({
      brand,
      body: `<div class="empty"><h1>Beranda belum bisa dibuka</h1><p>Terjadi kendala saat mengambil daftar berita. Coba lagi nanti.</p></div>`,
    }));
  }

  // Mirror the SPA default view exactly: newest first; featured = first
  // isFeatured else newest; grid = all minus featured; trending = isTrending
  // max 4 else first 4; viral = isViral max 5 (static list here: the SPA
  // auto-rotates, but a server page cannot rotate without JS).
  docs.sort((a, b) => b.createdMs - a.createdMs);
  const slugMap = assignSlugs(docs);
  const href = (a) => `/berita/${slugMap.get(a.id) || a.id}`;
  const featured = docs.find((a) => a.isFeatured) || docs[0] || null;
  const gridAll = featured ? docs.filter((a) => a.id !== featured.id) : docs;
  const totalPages = Math.max(1, Math.ceil(gridAll.length / GRID_PAGE_SIZE));
  let page = parseInt(String(req.query.page || '1'), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > totalPages) {
    // Out-of-range pagination does not exist: 404 instead of silently
    // serving the last page as a duplicate (Oct 2026 crawl fix).
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Halaman tidak ditemukan — MERAMU</title></head><body><h1>404 — Halaman tidak ditemukan</h1><p>Halaman yang kamu cari tidak ada. <a href="/">Kembali ke beranda</a></p></body></html>');
  }
  // Self-referential canonical per page (Oct 2026 crawl fix): page 1 is
  // the homepage itself, page N canonicalizes to its own ?page=N URL.
  const canonicalUrl = page === 1 ? `${SITE_URL}/` : `${SITE_URL}/?page=${page}`;
  const paged = gridAll.slice((page - 1) * GRID_PAGE_SIZE, page * GRID_PAGE_SIZE);
  const trending = docs.filter((a) => a.isTrending).slice(0, 4);
  const trendingList = trending.length ? trending : docs.slice(0, 4);
  const viral = docs.filter((a) => a.isViral).slice(0, 5);
  const heroImage = featured?.imageUrl ? wikimediaThumb(featured.imageUrl, 1200) : '';
  const heroSrcset = featured?.imageUrl ? `${wikimediaThumb(featured.imageUrl, 800)} 800w, ${wikimediaThumb(featured.imageUrl, 1200)} 1200w` : '';
  const heroSizes = '(max-width: 900px) 100vw, 760px';

  const hero = featured ? `<section class="hero">
<a class="hero-card" href="${href(featured)}">
<div class="hero-img">${featured.imageUrl ? `<img src="${escapeHtml(wikimediaThumb(featured.imageUrl, 1200))}"${imgFallback(featured.imageUrl, 1200, true)} srcset="${escapeHtml(wikimediaThumb(featured.imageUrl, 800))} 800w, ${escapeHtml(wikimediaThumb(featured.imageUrl, 1200))} 1200w" sizes="(max-width: 900px) 100vw, 760px" width="1200" height="675" fetchpriority="high" decoding="async" alt="${escapeHtml(featured.title)}" />` : ''}<div class="hero-badges"><span class="main">Headline Utama</span><span class="cat">${escapeHtml(featured.category)}</span></div></div>
<div class="hero-body"><h1>${escapeHtml(featured.title)}</h1>${featured.excerpt ? `<p>${escapeHtml(featured.excerpt)}</p>` : ''}<div class="hero-meta"><span><b>${escapeHtml(featured.author)}</b> • ${formatDate(featured.createdMs)}</span><span>${escapeHtml(featured.readTime)}</span></div></div>
</a>
<div class="side">
${viral.length ? `<div class="box"><div class="box-head">Lagi Viral</div><div class="viral-list">${viral.map((a) => `<a href="${href(a)}">${escapeHtml(a.title)}</a>`).join('')}</div></div>` : ''}
<div class="box trend"><h2>Pilihan Redaksi</h2>${trendingList.map((item, idx) => `<a href="${href(item)}"><span class="num">0${idx + 1}</span><div class="tt"><span>${escapeHtml(item.category)}</span><b>${escapeHtml(item.title)}</b><small>${formatDate(item.createdMs)} • ${escapeHtml(item.readTime)}</small></div>${item.imageUrl ? `<img src="${escapeHtml(wikimediaThumb(item.imageUrl, 320))}"${imgFallback(item.imageUrl, 320, false)} alt="" width="80" height="80" loading="lazy" decoding="async" />` : `<div class="ph">M</div>`}</a>`).join('')}
<a class="ig-cta" href="https://instagram.com/${escapeHtml(brand.instagram.replace('@', ''))}" target="_blank" rel="noreferrer"><div><b>Ikuti @${escapeHtml(brand.instagram.replace('@', ''))}</b><span>Update visual harian di Instagram</span></div><span>↗</span></a></div>
</div></section>` : '';

  const cards = paged.map((a) => `<a class="card" href="${href(a)}">
<div class="card-img">${a.imageUrl ? `<img src="${escapeHtml(wikimediaThumb(a.imageUrl, 800))}"${imgFallback(a.imageUrl, 800, true)} srcset="${escapeHtml(wikimediaThumb(a.imageUrl, 400))} 400w, ${escapeHtml(wikimediaThumb(a.imageUrl, 800))} 800w" sizes="(max-width: 900px) 90vw, 360px" width="800" height="500" loading="lazy" decoding="async" alt="${escapeHtml(a.title)}" />` : ''}<span>${escapeHtml(a.category)}</span></div>
<div class="card-body"><div><h3>${escapeHtml(a.title)}</h3>${a.excerpt ? `<p>${escapeHtml(a.excerpt)}</p>` : ''}</div><div class="card-bar"><span>${escapeHtml(a.author)}</span><span>${formatDate(a.createdMs)} • ${escapeHtml(a.readTime)}</span></div></div>
</a>`).join('\n');

  let pager = '';
  if (totalPages > 1) {
    const pageHref = (p) => (p === 1 ? '/' : `/?page=${p}`);
    const nums = [];
    for (let p = 1; p <= totalPages; p++) {
      nums.push(p === page ? `<span class="current">${p}</span>` : `<a href="${pageHref(p)}">${p}</a>`);
    }
    pager = `<div class="pager">${page > 1 ? `<a href="${pageHref(page - 1)}">Sebelumnya</a>` : `<span class="disabled">Sebelumnya</span>`}${nums.join('')}${page < totalPages ? `<a href="/?page=${page + 1}">Selanjutnya</a>` : `<span class="disabled">Selanjutnya</span>`}</div>`;
  }

  const body = `${hero}
<section>
<div class="grid-head"><h2><i></i>Terbaru di Meramu</h2><span>${gridAll.length} Artikel Tersedia</span></div>
${cards ? `<div class="grid">${cards}</div>${pager}` : `<div class="empty"><p>Belum ada berita yang cocok.</p></div>`}
</section>`;

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(shell({ brand, body, heroImage, heroSrcset, heroSizes, canonicalUrl }));
}
