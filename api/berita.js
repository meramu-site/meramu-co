// Vercel Serverless Function: every article is its own real page.
// /berita/<slug> is rewritten (vercel.json) to /api/berita?id=<slug>.
// Old /berita/<id> URLs 301-redirect to the slug URL (see handler below),
// so links shared before the slug migration keep working.
// The article is read live from the same public Firestore collection the
// portal CMS writes to, so a newly published article gets its own page
// immediately, with no site rebuild. No slug is ever written to Firestore:
// resolution is purely code (list fetch + slugify + collision rule).

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
  'Musik': 'musik',
  'Entertainment': 'entertainment',
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

// Resize + WebP images via images.weserv.nl, fallback Special:FilePath
// (PageSpeed fix, Oct 2026). Editors paste full-resolution Wikimedia
// originals as covers, and the site served them raw even as 96px
// thumbnails (one 13 MB PNG, several ~4 MB JPGs). weserv resizes and
// converts to WebP (verified live: 329KB JPEG -> 121KB WebP); if weserv
// fails, onerror swaps to the FilePath JPEG/PNG at the same width, so an
// image never breaks. FilePath inputs need ?width= inside the proxied
// URL (a plain FilePath without width 404s on weserv, verified Oct 2026).
// - upload.wikimedia.org/wikipedia/<lang>/<a>/<ab>/<file> -> weserv
// - <host>/wiki/Special:FilePath/<file> -> weserv with ?width= inside
// - https://meramu.site/<file> -> weserv (fallback: original local URL)
// - anything else (already-thumbed URLs such as
//   thumb.wikimedia.org/.../500px-..., Unsplash, other hosts) -> unchanged.
// NOTE: this helper is intentionally duplicated in api/kategori.js,
// api/cari.js, api/index.js and src/App.tsx (no shared import, so a
// serverless file can never break because of a bundling miss). Keep the
// copies in sync.
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

// og:image derivation (self-host migration, Nov 2026): X/Twitter link
// cards do not reliably support WebP, so a migrated /img/<base>.webp
// cover uses its -1200.jpg sibling for og:image/twitter:image. Any other
// URL keeps the existing raw-imageUrl behavior.
function ogImageFor(url) {
  if (!url || typeof url !== 'string') return url;
  const selfImg = url.match(/^(https:\/\/meramu\.site)?\/img\/([a-z0-9-]+)\.webp$/);
  if (selfImg) {
    const base = selfImg[2].replace(/-(500|800|1200)$/, '');
    return `https://meramu.site/img/${base}-1200.jpg`;
  }
  return url;
}

// Article slugs (SEO URLs, Oct 2026). slugifyTitle + assignSlugs MUST stay
// identical in api/berita.js, api/kategori.js, api/cari.js, api/feed.js,
// api/sitemap.js, api/index.js and src/App.tsx (no shared import, same
// reason as wikimediaThumb above). Rules: lowercase; apostrophes/quotes
// dropped; em/en dashes -> hyphen; any other run of non-[a-z0-9] -> one
// hyphen; edge hyphens trimmed; empty -> 'artikel'. Collision: within one
// base slug, sort by createdAt asc then id asc; the first keeps the bare
// slug, the rest get -2, -3, ... CreatedAt is set once at publish (the CMS
// never edits it), so assignments are stable. A slug can never equal a
// Firestore id: ids contain uppercase letters, slugs do not (verified
// against the live 33-article archive, Oct 2026: zero collisions, zero
// slug==id matches, no 'artikel' fallback used).
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

// True dimensions of a Wikimedia image, for CLS-free figure rendering
// (PageSpeed fix, Oct 2026). The serverless article figure previously had
// no width/height or aspect-ratio, so its box was 0px tall until the image
// loaded and everything below it (lead, body, share, related) shifted down.
// This resolves the ORIGINAL file's dimensions via the hosting wiki's API
// (action=query, prop=imageinfo, iiprop=size) and the figure then reserves
// that exact ratio: no crop, no distortion, no invented numbers.
// Non-Wikimedia URLs, already-thumbed URLs and any failure (network,
// timeout, unknown file) return null and keep the previous unreserved
// behavior; the page still renders. Results are cached per warm instance;
// a file revision's dimensions do not change, so the cache needs no TTL.
const wikimediaSizeCache = new Map();
// Self-hosted /img/ covers are the exception to the null case above: their
// dimensions are known statically (measured from the generated -1200.webp
// variants; all variants of one cover share the same aspect), so the figure
// keeps fallback dimensions with no API call. (Since the Oct 2026 16:9
// standardization, the box itself is fixed 16:9 by CSS; these dims are only
// a fallback if the stylesheet fails to load.)
const IMG_DIMS = {
  'bahlil-lahadalia-at-the-indonesia-naik-kelas-book-launching-21-november-2025-30': { w: 1200, h: 801 },
  'battery-pack-of-an-ev': { w: 1200, h: 1600 },
  'bogor-ketoprak-indonesian-traditional-food': { w: 1200, h: 675 },
  'borobodur1': { w: 400, h: 210 },
  'bundaran-hi-transjakarta-brt-station': { w: 1200, h: 900 },
  'camp-nou-fc-barcelona-barcelona': { w: 1200, h: 900 },
  'columbia-city-cinema-main-hall': { w: 1200, h: 900 },
  'fatimah-azzahra-orasi': { w: 1170, h: 785 },
  'indonesiagelap-protests-1': { w: 1200, h: 900 },
  'jakarta-international-stadium-from-toll-road': { w: 1200, h: 703 },
  'jakarta-skyline-part-2': { w: 1200, h: 596 },
  'jay-idzes-indonesia-china-5-june-2025': { w: 1023, h: 575 },
  'kalibo-ati-atihan-festival-philippines': { w: 1200, h: 800 },
  'kantor-bank-mandiri-kcp-palembang': { w: 720, h: 1600 },
  'kelme-jersey': { w: 1080, h: 608 },
  'maliq-kabar-bahagia': { w: 1170, h: 659 },
  'prabowo-in-singapore': { w: 1200, h: 800 },
  'raisa-at-la-lights-music-project': { w: 533, h: 300 },
  'rans-carnival-poster': { w: 1200, h: 675 },
  'rans-poster-nologo': { w: 1200, h: 675 },
  'si-jalak-harupat-2023': { w: 1024, h: 576 },
  'smoke-haze-cuz-forest-fire-this-is-near-my-house': { w: 1200, h: 900 },
  'stadion-kanjuruhan-panoramio': { w: 640, h: 480 },
  'state-library-victoria-exterior': { w: 1200, h: 554 },
  'students-protest-in-jakarta': { w: 1200, h: 900 },
  'the-international-2014': { w: 1200, h: 800 },
  'three-finger-salute-flag': { w: 1200, h: 800 },
  'timnas-irfan-bachdim': { w: 428, h: 241 },
  'ye-live-in-jakarta-2026-at-gelora-bung-karno-stadium': { w: 1200, h: 900 },
};
function wikimediaImageSizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const up = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/([^/]+)\/(?!thumb\/)[^/]+\/[^/]+\/(.+)$/);
    if (up) {
      const wiki = up[1] === 'commons' ? 'commons.wikimedia.org' : `${up[1]}.wikipedia.org`;
      return { api: `https://${wiki}/w/api.php`, file: decodeURIComponent(up[2]) };
    }
    const fp = url.match(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^?#]+)/);
    if (fp) return { api: 'https://commons.wikimedia.org/w/api.php', file: decodeURIComponent(fp[1]) };
  } catch {
    return null;
  }
  return null;
}
async function wikimediaImageSize(url) {
  if (typeof url === 'string') {
    const local = url.match(/^(?:https:\/\/meramu\.site)?\/img\/([a-z0-9-]+)\.webp$/);
    if (local && IMG_DIMS[local[1]]) return IMG_DIMS[local[1]];
  }
  const parsed = wikimediaImageSizeUrl(url);
  if (!parsed) return null;
  const key = `${parsed.api}|${parsed.file}`;
  if (wikimediaSizeCache.has(key)) return wikimediaSizeCache.get(key);
  let dims = null;
  try {
    const title = parsed.file.replace(/ /g, '_');
    const apiUrl = `${parsed.api}?action=query&prop=imageinfo&iiprop=size&format=json&formatversion=2&titles=File:${encodeURIComponent(title)}`;
    const r = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Meramu/1.0 (https://meramu.site)' },
      // Generous for a normally ~100-400ms API, but bounded: on timeout the
      // page still renders, just without the reservation. The fetch runs in
      // parallel with the related-articles fetch, so it normally adds zero
      // latency (it is awaited only after that fetch completes).
      signal: AbortSignal.timeout(2000),
    });
    if (r.ok) {
      const j = await r.json();
      const info = j?.query?.pages?.[0]?.imageinfo?.[0];
      if (info && Number.isFinite(info.width) && Number.isFinite(info.height) && info.width > 0 && info.height > 0) {
        dims = { w: info.width, h: info.height };
      }
    }
  } catch {
    dims = null;
  }
  wikimediaSizeCache.set(key, dims);
  return dims;
}

function pageShell({ title, description, canonical, ogImage, body, status = 200, jsonLd = '', preloadImage = '', preloadSrcset = '', preloadSizes = '' }) {
  const shareImage = ogImage || DEFAULT_OG;
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — Meramu</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<link rel="icon" href="/favicon.ico" />
${preloadImage ? `<link rel="preload" as="image" href="${escapeHtml(preloadImage)}"${preloadSrcset ? ` imagesrcset="${escapeHtml(preloadSrcset)}" imagesizes="${escapeHtml(preloadSizes)}"` : ''} fetchpriority="high" />` : ''}
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
<script>(function(){function meramuLoadGtag(){window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag('js',new Date());window.gtag('config','${GA_ID}');var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';document.head.appendChild(s);}if(document.readyState==='complete'){meramuLoadGtag();}else{window.addEventListener('load',meramuLoadGtag);}})();</script>
<script>(function(){try{if(localStorage.getItem('meramu-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();</script>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:ui-sans-system,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#171717;background:#fff}
  a{color:${ACCENT}} .accent{height:6px;background:${ACCENT}}
  header{border-bottom:1px solid #e5e5e5} .head{max-width:768px;margin:0 auto;padding:16px;display:flex;align-items:center;gap:12px}
  .brand-link{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit}
  .badge{width:36px;height:36px;border-radius:10px;background:${ACCENT};color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}
  .brand{font-weight:900;letter-spacing:.02em} .brand small{display:block;font-size:10px;letter-spacing:.18em;color:#737373}
  .head nav{margin-left:auto;display:flex;gap:16px;font-size:14px} .head nav a{color:#171717;text-decoration:none;font-weight:600}
  main{max-width:768px;margin:0 auto;padding:28px 20px 56px}
  .chip{display:inline-block;background:${ACCENT};color:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:5px 12px;border-radius:999px}
  h1{font-size:30px;line-height:1.2;letter-spacing:-.02em;margin:16px 0 12px}
  .meta{font-size:13px;color:#737373;display:flex;gap:8px;flex-wrap:wrap;padding-bottom:20px;border-bottom:1px solid #f5f5f5}
  .meta b{color:#171717} figure{margin:24px 0} figure img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:16px;display:block;background:#f5f5f5}
  figcaption{font-size:12px;color:#737373;margin-top:8px} .lead{font-size:18px;line-height:1.7;color:#404040}
  article p{font-size:17px;line-height:1.8;color:#404040;margin:14px 0}
  article h2{font-size:21px;margin:26px 0 10px;color:#171717}
  article blockquote{margin:18px 0;padding:10px 18px;border-left:4px solid ${ACCENT};background:#fafafa;border-radius:0 12px 12px 0;font-style:italic;font-size:18px;color:#404040}
  .back{display:inline-block;margin-top:32px;font-weight:700;text-decoration:none}
  .share{margin-top:36px;border-top:1px solid #e5e5e5;padding-top:24px}
  .share-label{font-size:13px;font-weight:700;color:#737373;margin-bottom:12px}
  .share-row{display:flex;gap:10px;flex-wrap:wrap}
  .share-btn{display:inline-block;padding:10px 18px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;color:#fff;border:0;cursor:pointer;font-family:inherit}
  .share-btn.wa{background:#25D366}
  .share-btn.th{background:#000}
  .share-btn.ig{background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)}
  .share-btn.link{background:${ACCENT}}
  .related{margin-top:40px;border-top:1px solid #e5e5e5;padding-top:24px}
  .related h2{font-size:20px;margin:0 0 4px;color:#171717}
  .rel{display:flex;gap:14px;text-decoration:none;color:inherit;padding:12px 0;border-bottom:1px solid #f5f5f5;align-items:flex-start}
  .rel:last-child{border-bottom:0}
  .rel img{width:96px;height:64px;object-fit:cover;border-radius:10px;flex:none;background:#f5f5f5}
  .rel-text b{display:block;font-size:15px;line-height:1.4;color:#171717}
  .rel-text span{display:block;font-size:12px;color:#737373;margin-top:4px}
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
  html.dark .related{border-top-color:rgba(255,255,255,.1)}
  html.dark .share{border-top-color:rgba(255,255,255,.1)}
  html.dark .share-label{color:#a3a3a3}
  html.dark .related h2{color:#f4f4f5}
  html.dark .rel{border-bottom-color:rgba(255,255,255,.1)}
  html.dark .rel-text b{color:#f4f4f5}
  html.dark .rel-text span{color:#a3a3a3}
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
<header><div class="head"><a href="/" class="brand-link"><div class="badge">M</div><div class="brand">MERAMU<small>Gagasan, kultur, cerita — diramu jadi satu.</small></div></a><nav><a href="/">Beranda</a><a href="https://instagram.com/meramufeed">Instagram</a></nav><div class="head-actions"><button type="button" class="meramu-theme-btn" aria-label="Mode gelap"><span class="theme-icon-moon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span><span class="theme-icon-sun"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></span></button><button type="button" class="meramu-menu-btn" aria-label="Menu" aria-expanded="false"><span class="icon-burger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg></span><span class="icon-x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></span></button></div></div><nav class="meramu-mmenu"><div class="meramu-mmenu-scroll"><a class="meramu-parent" href="/">Beranda<span class="meramu-arrow">→</span></a><button type="button" class="meramu-parent meramu-parent-btn" aria-expanded="false" aria-controls="meramu-sub-rubrik">Rubrik<span class="meramu-chev"></span></button><div class="meramu-sub" id="meramu-sub-rubrik"><div><div class="meramu-cols"><a class="meramu-child" href="/kategori/pop-culture"><span class="meramu-ico">PC</span>Pop Culture</a><a class="meramu-child" href="/kategori/ekonomi-kreatif"><span class="meramu-ico">EK</span>Ekonomi Kreatif</a><a class="meramu-child" href="/kategori/musik"><span class="meramu-ico">MU</span>Musik</a><a class="meramu-child" href="/kategori/entertainment"><span class="meramu-ico">EN</span>Entertainment</a><a class="meramu-child" href="/kategori/lifestyle"><span class="meramu-ico">LI</span>Lifestyle</a><a class="meramu-child" href="/kategori/tech"><span class="meramu-ico">TC</span>Tech</a><a class="meramu-child" href="/kategori/berita-umum"><span class="meramu-ico">BU</span>Berita Umum</a><a class="meramu-child" href="/kategori/sports"><span class="meramu-ico">SP</span>Sports</a><a class="meramu-child" href="/kategori/esports"><span class="meramu-ico">ES</span>Esports</a><a class="meramu-child" href="/kategori/politik"><span class="meramu-ico">PO</span>Politik</a><a class="meramu-child" href="https://instagram.com/meramufeed"><span class="meramu-ico">IG</span>Instagram</a></div></div></div><button type="button" class="meramu-parent meramu-parent-btn" aria-expanded="false" aria-controls="meramu-sub-kontak">Kontak<span class="meramu-chev"></span></button><div class="meramu-sub" id="meramu-sub-kontak"><div><a class="meramu-kontak-row" href="https://instagram.com/meramufeed"><span class="meramu-ico">IG</span>Instagram<span class="meramu-handle">@meramufeed</span></a><a class="meramu-kontak-row" href="https://www.threads.net/@meramufeed"><span class="meramu-ico">TH</span>Threads<span class="meramu-handle">@meramufeed</span></a><a class="meramu-kontak-row" href="https://x.com/meramudotco"><span class="meramu-ico">X</span>X / Twitter<span class="meramu-handle">@meramudotco</span></a><a class="meramu-kontak-row" href="mailto:contact@meramu.site"><span class="meramu-ico">✉</span>Email redaksi<span class="meramu-handle">contact@meramu.site</span></a></div></div><a class="meramu-parent" href="/tentang">Tentang<span class="meramu-arrow">→</span></a></div><div class="meramu-mmenu-foot"><a href="/cari">Cari</a><button type="button" class="meramu-foot-theme">Mode gelap</button></div></nav></header><div class="scrim" aria-hidden="true"></div><script>(function(){var themeBtn=document.querySelector('.meramu-theme-btn');var menuBtn=document.querySelector('.meramu-menu-btn');var menu=document.querySelector('.meramu-mmenu');function syncTheme(){if(!themeBtn)return;var dark=document.documentElement.classList.contains('dark');themeBtn.setAttribute('aria-label',dark?'Mode terang':'Mode gelap');var footTheme=document.querySelector('.meramu-foot-theme');if(footTheme)footTheme.textContent=dark?'Mode terang':'Mode gelap';}syncTheme();if(themeBtn){themeBtn.addEventListener('click',function(){var dark=document.documentElement.classList.toggle('dark');try{localStorage.setItem('meramu-theme',dark?'dark':'light');}catch(e){}syncTheme();});}if(menuBtn&&menu){var scrim=document.querySelector('.scrim');var subBtns=menu.querySelectorAll('.meramu-parent-btn');function setSub(btn,open){var sub=document.getElementById(btn.getAttribute('aria-controls'));if(sub)sub.classList.toggle('open',open);btn.setAttribute('aria-expanded',open?'true':'false');}function closeSubs(){subBtns.forEach(function(b){setSub(b,false);});}function setMenu(open){menu.classList.toggle('open',open);menuBtn.classList.toggle('open',open);if(scrim)scrim.classList.toggle('open',open);menuBtn.setAttribute('aria-expanded',open?'true':'false');if(!open)closeSubs();}menuBtn.addEventListener('click',function(){setMenu(!menu.classList.contains('open'));});if(scrim){scrim.addEventListener('click',function(){setMenu(false);});}subBtns.forEach(function(btn){btn.addEventListener('click',function(){var sub=document.getElementById(btn.getAttribute('aria-controls'));var willOpen=sub&&!sub.classList.contains('open');closeSubs();setSub(btn,!!willOpen);});});menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){setMenu(false);});});var footTheme=menu.querySelector('.meramu-foot-theme');if(footTheme&&themeBtn){footTheme.addEventListener('click',function(){themeBtn.click();});}document.addEventListener('keydown',function(e){if(e.key==='Escape')setMenu(false);});}})();</script>
<main>${body}</main>
<footer>MERAMU — Portal Berita<br /><a href="/">Beranda</a> • <a href="/tentang">Tentang</a> • <a href="/privasi">Privasi</a> • <a href="/kontak">Kontak</a></footer>
</body>
</html>`;
  return { html, status };
}

export default async function handler(req, res) {
  const param = String(req.query.id || '').trim();

  if (!param || !/^[A-Za-z0-9_-]+$/.test(param)) {
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
      canonical: `${SITE_URL}/berita/${encodeURIComponent(param)}`,
      ogImage: '',
      body: `<h1>Berita belum bisa dibuka</h1><p class="lead">Terjadi kendala konfigurasi di server. Coba lagi nanti.</p><a class="back" href="/">&larr; Kembali ke Beranda</a>`,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(html);
  }

  // Slug resolution (no Firestore writes): fetch the article list first.
  // It powers both the id->slug 301 and the slug->article render, plus the
  // related-articles block, so the happy path costs one list fetch and no
  // single-doc fetch at all.
  let listDocs = null;
  try {
    const listUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/articles?pageSize=100&key=${apiKey}`;
    const lr = await fetch(listUrl);
    if (lr.ok) {
      const lj = await lr.json();
      listDocs = (lj.documents || []).map((d) => {
        const ff = d.fields || {};
        return {
          id: String(d.name || '').split('/').pop(),
          fields: ff,
          title: strField(ff, 'title'),
          category: strField(ff, 'category'),
          imageUrl: strField(ff, 'imageUrl'),
          createdMs: msField(ff, 'createdAt'),
        };
      }).filter((a) => a.id && a.title);
    }
  } catch {
    listDocs = null;
  }

  if (listDocs) {
    const slugMap = assignSlugs(listDocs);
    // (a) Exact doc-id match -> 301 to the current slug URL. ID URLs are
    // the ones shared before the slug migration; they keep working forever
    // (the 301 itself is edge-cached for 1h, not infinitely, so a future
    // title edit re-resolves instead of serving a stale permanent redirect).
    const byId = listDocs.find((a) => a.id === param);
    if (byId) {
      const slug = slugMap.get(byId.id);
      res.setHeader('Location', `/berita/${slug}`);
      res.setHeader('Cache-Control', 'public, s-maxage=3600');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(301).send(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Pindah ke ${slug}</title></head><body><p>Artikel ini pindah ke <a href="/berita/${slug}">/berita/${slug}</a>.</p></body></html>`);
    }
    // (b) Assigned-slug match -> 200 with canonical = slug URL.
    const hit = listDocs.find((a) => slugMap.get(a.id) === param);
    if (!hit) {
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
    // Related ("Baca Juga"): same-category first (newest first), backfilled
    // with the newest other articles so the block is never empty (several
    // categories still have only one article).
    const others = listDocs.filter((a) => a.id !== hit.id);
    const same = others.filter((a) => a.category === hit.category).sort((a, b) => b.createdMs - a.createdMs);
    const rest = others.filter((a) => a.category !== hit.category).sort((a, b) => b.createdMs - a.createdMs);
    const related = [...same, ...rest].slice(0, 3).map((r) => ({ ...r, slug: slugMap.get(r.id) }));
    return renderArticlePage({ doc: hit, id: hit.id, slug: slugMap.get(hit.id), related, res });
  }

  // Fallback: the list fetch failed. Single-doc fetch by param, ID canonical,
  // exactly as before the slug migration; related is omitted (no list).
  // This keeps articles reachable during a transient list-fetch failure.
  let doc;
  try {
    const docPath = `artifacts/${APP_ID}/public/data/articles/${encodeURIComponent(param)}`;
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?key=${apiKey}`;
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
  return renderArticlePage({ doc, id: param, slug: null, related: [], res });
}

async function renderArticlePage({ doc, id, slug, related, res }) {
    const f = doc.fields || {};
    const title = strField(f, 'title') || 'Tanpa judul';
    const excerpt = strField(f, 'excerpt');
    const content = strField(f, 'content');
    const category = strField(f, 'category');
    const secondaryCategory = strField(f, 'secondaryCategory');
    const author = strField(f, 'author') || 'Redaksi Meramu';
    const readTime = strField(f, 'readTime');
    const imageUrl = strField(f, 'imageUrl');
    const imageCaption = strField(f, 'imageCaption');
    // True figure dimensions (for CLS-free rendering); awaited at figure
    // build time.
    const figureDimsPromise = imageUrl ? wikimediaImageSize(imageUrl) : Promise.resolve(null);
    const createdMs = msField(f, 'createdAt');
    const updatedMs = msField(f, 'updatedAt') || createdMs;
    const dateStr = formatDate(createdMs);
    const canonical = slug ? `${SITE_URL}/berita/${slug}` : `${SITE_URL}/berita/${encodeURIComponent(id)}`;
    const categorySlug = CATEGORY_SLUGS[category] || '';
    const secondarySlug = CATEGORY_SLUGS[secondaryCategory] || '';

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
    // Share row (bottom of the article): WhatsApp + Threads open their share
    // intents with the article title + URL. Instagram has no web share intent,
    // so its button uses the device's native share sheet (navigator.share) and
    // falls back to copying the link. "Salin Link" copies the article URL.
    const shareText = encodeURIComponent(`${title} ${canonical}`);
    const waHref = `https://wa.me/?text=${shareText}`;
    const threadsHref = `https://www.threads.net/intent/post?text=${shareText}`;
    const shareSection = `<section class="share"><div class="share-label">Bagikan artikel ini</div><div class="share-row"><a class="share-btn wa" href="${waHref}" target="_blank" rel="noopener">WhatsApp</a><a class="share-btn th" href="${threadsHref}" target="_blank" rel="noopener">Threads</a><button class="share-btn ig" type="button" data-title="${escapeHtml(title)}" data-url="${escapeHtml(canonical)}" onclick="meramuShareIG(this)">Instagram</button><button class="share-btn link" type="button" id="meramu-copy-btn" data-url="${escapeHtml(canonical)}" onclick="meramuCopyLink(this)">Salin Link</button></div></section><script>
  function meramuCopyLink(btn){
    var url = btn.getAttribute('data-url');
    var done = function(){ var old = btn.textContent; btn.textContent = 'Link tersalin!'; setTimeout(function(){ btn.textContent = old; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function(){ meramuCopyFallback(url, done); });
    } else { meramuCopyFallback(url, done); }
  }
  function meramuCopyFallback(url, done){
    try {
      var ta = document.createElement('textarea');
      ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) {}
    done();
  }
  function meramuShareIG(btn){
    var url = btn.getAttribute('data-url');
    var title = btn.getAttribute('data-title');
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function(){});
    } else {
      meramuCopyLink(document.getElementById('meramu-copy-btn'));
    }
  }
  </script>`;
    // Figure thumbnail (max 768px container): 800w covers 1x; if the original
    // is narrower, FilePath returns the original itself, so this never upscales.
    const figureThumb = imageUrl ? wikimediaThumb(imageUrl, 800) : '';
    const figureDims = await figureDimsPromise;
    // Standard figure box (SOP, Oct 2026): fixed 16:9 for every article, so
    // figures are uniform. The CSS rule (aspect-ratio:16/9 + object-fit:cover)
    // governs the box and center-crops any non-16:9 photo (mandatory crop);
    // the width/height attrs below are a fallback only and never set the box.
    const figureAttrs = figureDims
      ? ` width="${figureDims.w}" height="${figureDims.h}"`
      : '';
    const body = `<a class="back" style="margin:0 0 20px" href="/">&larr; Beranda</a>
  ${category ? `<div style="margin-top:20px">${categorySlug ? `<a class="chip" style="text-decoration:none" href="/kategori/${categorySlug}">${escapeHtml(category)}</a>` : `<span class="chip">${escapeHtml(category)}</span>`}</div>` : ''}
  ${secondaryCategory ? `<div style="margin-top:8px">${secondarySlug ? `<a class="chip" style="text-decoration:none" href="/kategori/${secondarySlug}">${escapeHtml(secondaryCategory)}</a>` : `<span class="chip">${escapeHtml(secondaryCategory)}</span>`}</div>` : ''}
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${metaBits.map((b, i) => (i === 0 ? `<b>${b}</b>` : `<span>•</span><span>${b}</span>`)).join('')}</div>
  ${figureThumb ? `<figure><img src="${escapeHtml(figureThumb)}" srcset="${escapeHtml(wikimediaThumb(imageUrl, 500))} 500w, ${escapeHtml(figureThumb)} 800w" sizes="(max-width: 808px) calc(100vw - 40px), 768px"${imgFallback(imageUrl, 800, true)} alt="${escapeHtml(title)}"${figureAttrs} fetchpriority="high" decoding="async" />${imageCaption ? `<figcaption>${escapeHtml(imageCaption)}</figcaption>` : ''}</figure>` : ''}
  ${excerpt ? `<p class="lead">${escapeHtml(excerpt)}</p>` : ''}
  <article>${renderContent(content)}</article>
  ${shareSection}
  ${related.length ? `<section class="related"><h2>Baca Juga</h2>${related.map((r) => `<a class="rel" href="/berita/${escapeHtml(r.slug || r.id)}">${r.imageUrl ? `<img src="${escapeHtml(wikimediaThumb(r.imageUrl, 320))}"${imgFallback(r.imageUrl, 320, false)} alt="" width="96" height="64" loading="lazy" decoding="async" />` : ''}<div class="rel-text"><b>${escapeHtml(r.title)}</b>${r.createdMs ? `<span>${formatDate(r.createdMs)}</span>` : ''}</div></a>`).join('')}</section>` : ''}
  <a class="back" href="/">&larr; Kembali ke Beranda</a>`;

    const { html } = pageShell({
      title,
      description: excerpt || title,
      canonical,
      ogImage: ogImageFor(imageUrl),
      body,
      jsonLd,
      preloadImage: figureThumb,
      preloadSrcset: imageUrl ? `${wikimediaThumb(imageUrl, 500)} 500w, ${figureThumb} 800w` : '',
      preloadSizes: '(max-width: 808px) calc(100vw - 40px), 768px',
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
}
