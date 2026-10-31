import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Search, 
  Sparkles, 
  Clock, 
  Share2, 
  ArrowLeft, 
  AtSign,
  PenLine, 
  Check, 
  ChevronRight,
  ChevronDown, 
  BookOpen,
  Image as ImageIcon,
  X,
  TrendingUp,
  Copy,
  ExternalLink,
  CircleAlert,
  Moon,
  Sun
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Dapur Redaksi (admin CMS) loads lazily: the public bundle must not contain
// admin code (bundle split, Oct 2026). The chunk is only fetched when the
// admin view renders. Firebase Auth lives ONLY in this chunk (AdminPanel.tsx
// imports firebase/auth); the public bundle never imports it, so no auth
// iframe loads on public pages. AdminPanel reports its admin state back via
// onAuthChange so the reader quick-edit button keeps its exact gating.
const AdminPanel = lazy(() => import('./AdminPanel'));

// ==========================================
// FIREBASE INITIALIZATION
// ==========================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
// Without apiKey + projectId the site runs in demo mode: no demo
// articles, no sign-in, no Firestore writes. Admin login needs Firebase
// plus an admin user created in the Firebase console (see README).
const FIREBASE_READY = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const app = FIREBASE_READY ? initializeApp(firebaseConfig) : null;
const db = FIREBASE_READY ? getFirestore(app) : null;
// Firestore namespace for this site's articles & brand settings.
const appId = 'meramu-site-app';

// ==========================================
// CONSTANTS
// ==========================================
const CATEGORIES = [
  'Semua',
  'Pop Culture',
  'Ekonomi Kreatif',
  'Musik',
  'Entertainment',
  'Lifestyle',
  'Tech',
  'Berita Umum',
  'Sports',
  'Esports',
  'Politik'
];

// Every section has its own address: category tabs link to real pages.
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
  'Politik': 'politik'
};
const categoryHref = (category) =>
  category === 'Semua' ? '/' : `/kategori/${CATEGORY_SLUGS[category] || ''}`;

// UI language toggle (public chrome only; article bodies, the admin CMS
// and server-rendered pages stay Indonesian for now).
const UI_STRINGS = {
  id: {
    searchPlaceholder: 'Cari topik, berita...',
    loading: 'Meramu berita terkini...',
    showing: 'Menampilkan:',
    forKeyword: 'dengan kata kunci',
    resetFilter: 'Reset Filter',
    mainHeadline: 'Headline Utama',
    editorsPicks: 'Pilihan Redaksi',
    latest: 'Terbaru di Meramu',
    section: 'Rubrik:',
    articlesAvailable: 'Artikel Tersedia',
    showAllNews: 'Tampilkan Semua Berita',
    prevPage: 'Sebelumnya',
    nextPage: 'Selanjutnya',
    noResults: 'Belum ada berita yang cocok dengan filter atau pencarian ini.',
    follow: 'Ikuti',
    followSub: 'Update visual harian di Instagram',
    newsroom: 'Dapur Redaksi',
    viewSite: 'Lihat Website',
    menuHome: 'Beranda',
    menuSearch: 'Cari Berita',
    menuCategories: 'Rubrik',
    menuAbout: 'Tentang Meramu',
    menuContact: 'Kontak',
    justNow: 'Baru saja',
    minRead: 'Menit Baca',
  },
  en: {
    searchPlaceholder: 'Search topics, news...',
    loading: 'Gathering the latest news...',
    showing: 'Showing:',
    forKeyword: 'for keyword',
    resetFilter: 'Reset Filter',
    mainHeadline: 'Main Headline',
    editorsPicks: "Editor's Picks",
    latest: 'Latest on Meramu',
    section: 'Section:',
    articlesAvailable: 'Articles Available',
    showAllNews: 'Show All News',
    prevPage: 'Previous',
    nextPage: 'Next',
    noResults: 'No news matches this filter or search.',
    follow: 'Follow',
    followSub: 'Daily visual updates on Instagram',
    newsroom: 'Newsroom',
    viewSite: 'View Website',
    menuHome: 'Home',
    menuSearch: 'Search News',
    menuCategories: 'Categories',
    menuAbout: 'About Meramu',
    menuContact: 'Contact',
    justNow: 'Just now',
    minRead: 'Min Read',
  },
};

// Category names stay Indonesian in data; only the displayed label switches.
const CATEGORY_LABELS_EN = {
  'Semua': 'All',
  'Ekonomi Kreatif': 'Creative Economy',
  'Musik': 'Music',
  'Entertainment': 'Entertainment',
  'Berita Umum': 'General News',
  'Sports': 'Sports',
  'Esports': 'Esports',
  'Politik': 'Politics',
};





const DEFAULT_BRAND = {
  siteName: 'MERAMU',
  tagline: 'Meramu gagasan, kultur pop, dan cerita kreatif terkini.',
  domain: 'meramu.site',
  instagram: 'meramufeed',
  accentColor: '#0D1B8C',
  logoStyle: 'badge', // 'badge' | 'minimal'
  logoUrl: ''
};

// Header motto (Kompasiana-style tagline under the wordmark, chosen by the
// user 2026-10-30). Hardcoded by design: it is a brand line, not CMS content
// — change it here, not in Dapur Redaksi.
const HEADER_TAGLINE = 'Gagasan, kultur, cerita — diramu jadi satu.';

// Resize Wikimedia images via Special:FilePath (PageSpeed fix, Oct 2026).
// Same helper as api/berita.js, api/kategori.js, api/cari.js and api/index.js
// (duplicated on purpose so a serverless file never breaks on a bundling
// miss). See api/berita.js for the full explanation: FilePath widths are
// verified working, direct /thumb/ widths are not. Per-language fix (Oct
// 2026): the old regex only matched commons, so a language-wiki file (e.g.
// wikipedia/id/.../Stadion_Kanjuruhan_Malang2.png, 1.8 MB) slipped through
// RAW; it now maps to <lang>.wikipedia.org FilePath (verified 200 + 132 KB
// at width=320 for the id file).
function wikimediaThumb(url: string, width: number): string {
  if (!url || typeof url !== 'string') return url;
  const up = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/([^/]+)\/(?!thumb\/)[^/]+\/[^/]+\/(.+)$/);
  if (up) {
    const host = up[1] === 'commons' ? 'commons.wikimedia.org' : `${up[1]}.wikipedia.org`;
    return `https://${host}/wiki/Special:FilePath/${up[2]}?width=${width}`;
  }
  const fp = url.match(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^?#]+)(\?.*)?$/);
  if (fp) return `https://commons.wikimedia.org/wiki/Special:FilePath/${fp[1]}${fp[2] ? '&' : '?'}width=${width}`;
  return url;
}

// Article slugs (SEO URLs, Oct 2026). Logic MUST stay identical to
// api/berita.js (see there for the full rules). Used for every public
// /berita/<slug> link the SPA renders (hero, viral, trending, grid).
function slugifyTitle(title: string): string {
  const s = String(title || '').toLowerCase().replace(/[''']/g, '').replace(/[–—]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'artikel';
}
function assignSlugs(docs: { id: string; title: string; createdMs: number }[]): Map<string, string> {
  const groups = new Map<string, { id: string; title: string; createdMs: number }[]>();
  for (const d of docs) {
    const base = slugifyTitle(d.title);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(d);
  }
  const out = new Map<string, string>();
  for (const [base, list] of groups) {
    list.sort((a, b) => (a.createdMs - b.createdMs) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    list.forEach((d, i) => out.set(d.id, i === 0 ? base : `${base}-${i + 1}`));
  }
  return out;
}

// ==========================================
// MERAMU LOGO COMPONENT (blue box + motto)
// ==========================================
// Instagram brand glyph in lucide's outline style (lucide-react v1
// removed brand icons, so the two IG buttons use this local component).
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function MeramuLogo({ brandSettings, size = 'md' }) {
  const bgColor = brandSettings.accentColor || '#0D1B8C';

  if (brandSettings.logoUrl) {
    return (
      <img
        src={brandSettings.logoUrl}
        alt={brandSettings.siteName}
        className={`${size === 'lg' ? 'h-11 sm:h-12' : 'h-9 sm:h-10'} w-auto object-contain`}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    );
  }

  if (brandSettings.logoStyle === 'minimal') {
    return (
      <div className="flex items-center gap-2.5">
        <span
          style={{ backgroundColor: bgColor }}
          className="w-3.5 h-8 rounded-xs inline-block"
        />
        <div>
          <span
            style={{ ['--brand-color' as string]: bgColor }}
            className="text-2xl sm:text-3xl font-black tracking-wider uppercase block leading-none text-[color:var(--brand-color)] dark:text-white"
          >
            {brandSettings.siteName}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold block mt-0.5">
            {HEADER_TAGLINE}
          </span>
        </div>
      </div>
    );
  }

  // Default: blue box + motto (white text on accent rectangle, like the
  // original logo, with the Kompasiana-style motto underneath)
  return (
    <div className="flex flex-col justify-start">
      <div
        style={{ backgroundColor: bgColor }}
        className={`${
          size === 'sm'
            ? 'px-3 py-1.5'
            : 'px-4 sm:px-5 py-2 sm:py-2.5'
        } inline-flex items-center justify-center shadow-xs transition-transform group-hover:scale-[1.02] select-none self-start`}
      >
        <span
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', 'Arial Black', sans-serif",
            letterSpacing: '0.06em'
          }}
          className={`${
            size === 'sm' ? 'text-base sm:text-lg' : 'text-lg sm:text-2xl'
          } font-black text-white uppercase leading-none`}
        >
          {brandSettings.siteName}
        </span>
      </div>
      <span
        className={`${
          size === 'sm' ? 'text-[10px]' : 'text-[11px] sm:text-xs'
        } text-neutral-500 dark:text-neutral-400 font-medium leading-tight mt-1`}
      >
        {HEADER_TAGLINE}
      </span>
    </div>
  );
}

// ==========================================
// MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  // Database State. Auth lives in AdminPanel (see lazy import note above);
  // App only keeps the last admin flag it reported (reader edit gating).
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingEditArticle, setPendingEditArticle] = useState(null);
  const [articles, setArticles] = useState([]);
  const [brandSettings, setBrandSettings] = useState(DEFAULT_BRAND);
  const [isLoading, setIsLoading] = useState(true);

  // Navigation & UI State
  const [activeView, setActiveView] = useState('home'); // 'home' | 'article' | 'admin'
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  // UI language: persisted, public chrome only (see UI_STRINGS).
  const [lang, setLang] = useState(() => {
    try {
      return window.localStorage.getItem('meramu-lang') === 'en' ? 'en' : 'id';
    } catch {
      return 'id';
    }
  });
  const t = UI_STRINGS[lang];
  const catLabel = (c) => (lang === 'en' ? (CATEGORY_LABELS_EN[c] || c) : c);
  const readTimeLabel = (rt) => (lang === 'en' ? String(rt || '').replace('Menit Baca', t.minRead) : rt);
  const switchLang = (l) => {
    setLang(l);
    try {
      window.localStorage.setItem('meramu-lang', l);
    } catch {}
  };
  // Theme: always light on first visit; a manual toggle choice persists
  // in localStorage and wins on later visits. The device setting is NOT read.
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem('meramu-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });
  useEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      window.localStorage.setItem('meramu-theme', theme);
    } catch {}
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  // Hamburger menu (top-right corner): the whole site nav in one place.
  const [menuOpen, setMenuOpen] = useState(false);
  // Rubrik section inside the menu card: collapsed by default, like a
  // dropdown row (reference: berkatpetani.com "Our Brands" row).
  const [rubrikOpen, setRubrikOpen] = useState(false);
  // Lock background scroll while the floating menu card is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [menuOpen]);
  const [toastMessage, setToastMessage] = useState(null);

  // Helper to show toast notifications
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 2. Firestore Data Sync Effect. Reads need no auth: the Firestore rules
  // allow public reads (the serverless pages already read unauthenticated
  // via REST), so the anonymous reader session is gone with Effect 1.
  // (If reads ever required auth, this effect would subscribe to nothing;
  // that is a live-verification item for the deploy, not a code guess.)
  useEffect(() => {
    // Demo mode: no demo articles — serve an empty list, no Firestore listeners.
    if (!FIREBASE_READY || !db) {
      setArticles([]);
      setIsLoading(false);
      return;
    }

    const articlesRef = collection(db, 'artifacts', appId, 'public', 'data', 'articles');
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'brand');

    // Listen to Articles Collection
    const unsubArticles = onSnapshot(
      articlesRef,
      async (snapshot) => {
        if (snapshot.empty) {
          // Empty collection: no demo content anymore — show an empty list.
          setArticles([]);
          setIsLoading(false);
        } else {
          const loaded = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
          }));
          // Sort in memory by newest first
          loaded.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setArticles(loaded);
          setIsLoading(false);
        }
      },
      (error) => {
        console.error('Firestore articles listener error:', error);
        // Fallback to an empty list if Firestore fails
        setArticles([]);
        setIsLoading(false);
      }
    );

    // Listen to Brand Settings Document
    const unsubSettings = onSnapshot(
      settingsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Upgrade legacy default black color to official Meramu Royal Blue (#0D1B8C)
          const resolvedColor =
            !data.accentColor || data.accentColor === '#111827'
              ? '#0D1B8C'
              : data.accentColor;
          setBrandSettings({
            ...DEFAULT_BRAND,
            ...data,
            accentColor: resolvedColor
          });
        } else {
          setDoc(settingsRef, DEFAULT_BRAND).catch((e) => console.error(e));
        }
      },
      (error) => {
        console.error('Firestore settings listener error:', error);
      }
    );

    return () => {
      unsubArticles();
      unsubSettings();
    };
  }, []);

  // Slug map for public article links (Oct 2026): every SPA link to an
  // article uses its slug, never the Firestore id.
  const slugMap = useMemo(() => assignSlugs(articles.map((a) => ({ id: a.id, title: a.title, createdMs: a.createdAt || 0 }))), [articles]);
  const articleHref = (a) => `/berita/${slugMap.get(a.id) || a.id}`;

  // Derived Data for Public View
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchesCategory = selectedCategory === 'Semua' || art.category === selectedCategory || art.secondaryCategory === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        art.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.category?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [articles, selectedCategory, searchQuery]);

  const featuredArticle = useMemo(() => {
    const explicitFeatured = filteredArticles.find((a) => a.isFeatured);
    return explicitFeatured || filteredArticles[0] || null;
  }, [filteredArticles]);

  const gridArticles = useMemo(() => {
    if (!featuredArticle) return filteredArticles;
    // Show remaining articles in grid when on 'Semua' & no search query
    if (selectedCategory === 'Semua' && !searchQuery.trim()) {
      return filteredArticles.filter((a) => a.id !== featuredArticle.id);
    }
    return filteredArticles;
  }, [filteredArticles, featuredArticle, selectedCategory, searchQuery]);

  // Homepage grid pagination: 6 articles per page, numbered pages.
  const GRID_PAGE_SIZE = 6;
  const [gridPage, setGridPage] = useState(1);
  const totalGridPages = Math.max(1, Math.ceil(gridArticles.length / GRID_PAGE_SIZE));
  const safeGridPage = Math.min(gridPage, totalGridPages);
  const pagedGridArticles = gridArticles.slice(
    (safeGridPage - 1) * GRID_PAGE_SIZE,
    safeGridPage * GRID_PAGE_SIZE
  );
  const goToGridPage = (p) => {
    setGridPage(p);
    document.getElementById('terbaru-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // Back to page 1 whenever the tab or the search query changes.
  useEffect(() => {
    setGridPage(1);
  }, [selectedCategory, searchQuery]);

  const trendingArticles = useMemo(() => {
    const trending = articles.filter((a) => a.isTrending);
    return trending.length > 0 ? trending.slice(0, 4) : articles.slice(0, 4);
  }, [articles]);

  // Lagi Viral: redaksi-curated via CMS isViral flag, max 5.
  // Auto-advance: satu judul tampil, tiap 4 detik geser naik ke judul berikut, looping.
  const viralArticles = useMemo(() => articles.filter((a) => a.isViral).slice(0, 5), [articles]);
  const [viralIndex, setViralIndex] = useState(0);
  const [viralNoAnim, setViralNoAnim] = useState(false);
  const [viralPaused, setViralPaused] = useState(false);
  useEffect(() => { setViralIndex(0); }, [viralArticles.length]);
  useEffect(() => {
    if (viralArticles.length <= 1 || viralPaused) return undefined;
    const id = setInterval(() => setViralIndex((i) => i + 1), 4000);
    return () => clearInterval(id);
  }, [viralArticles.length, viralPaused]);
  useEffect(() => {
    if (viralIndex !== viralArticles.length || viralArticles.length === 0) return undefined;
    const t = setTimeout(() => {
      setViralNoAnim(true);
      setViralIndex(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setViralNoAnim(false)));
    }, 600);
    return () => clearTimeout(t);
  }, [viralIndex, viralArticles.length]);

  const currentArticle = useMemo(() => {
    return articles.find((a) => a.id === selectedArticleId) || null;
  }, [articles, selectedArticleId]);

  const relatedArticles = useMemo(() => {
    if (!currentArticle) return [];
    return articles
      .filter((a) => a.id !== currentArticle.id && a.category === currentArticle.category)
      .slice(0, 3);
  }, [articles, currentArticle]);

  // Navigation Handlers.
  // Public article reading lives on real separate pages (/berita/<slug>);
  // this in-app reader is only the admin preview inside Dapur Redaksi.
  const openArticle = (articleId) => {
    setSelectedArticleId(articleId);
    setActiveView('article');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToHome = () => {
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goHome = (category = 'Semua') => {
    setSelectedCategory(category);
    navigateToHome();
  };

  // Landing directly on /dapur-redaksi opens the admin view.
  useEffect(() => {
    if (window.location.pathname === '/dapur-redaksi') {
      setActiveView('admin');
    }
  }, []);

  // Date Formatter (locale follows the UI language toggle)
  const formatDate = (timestamp) => {
    if (!timestamp) return t.justNow;
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(timestamp));
  };

  // Render Formatted Content Paragraphs
  const renderArticleContent = (rawText) => {
    if (!rawText) return null;
    const blocks = rawText.split('\n\n');
    return blocks.map((block, index) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={index} className="text-xl font-bold text-neutral-900 mt-6 mb-3 dark:text-neutral-100">
            {trimmed.replace('## ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote
            key={index}
            style={{ borderLeftColor: brandSettings.accentColor }}
            className="my-4 pl-4 italic text-neutral-700 border-l-4 font-serif text-lg bg-neutral-50 py-2.5 pr-4 rounded-r-xl dark:text-neutral-300 dark:bg-neutral-900"
          >
            "{trimmed.replace('> ', '')}"
          </blockquote>
        );
      }
      return (
        <p key={index} className="my-3 text-neutral-700 leading-relaxed text-base sm:text-lg dark:text-neutral-300">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col font-sans selection:bg-[#0D1B8C] selection:text-white dark:bg-neutral-950 dark:text-neutral-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{ backgroundColor: brandSettings.accentColor }}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 text-white px-4 py-3 rounded-xl shadow-xl border border-white/15 animate-bounce"
        >
          <Check className="w-4 h-4 text-emerald-300 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ========================================== */}
      {/* TOP BAR & EDITORIAL HEADER                 */}
      {/* ========================================== */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 dark:bg-neutral-950 dark:border-white/10">
        {/* Top Royal Blue Brand Accent Line */}
        <div
          style={{ backgroundColor: brandSettings.accentColor }}
          className="h-1.5 w-full"
        />

        {/* Top Utility Strip */}
        <div className="border-b border-neutral-100 bg-neutral-50/70 dark:border-white/10 dark:bg-neutral-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-full border border-neutral-200 overflow-hidden dark:border-white/10">
                <button
                  type="button"
                  onClick={() => switchLang('id')}
                  style={lang === 'id' ? { backgroundColor: brandSettings.accentColor, color: '#ffffff' } : {}}
                  className="px-2.5 py-1 text-[11px] font-bold cursor-pointer text-neutral-600 dark:text-neutral-400"
                >
                  ID
                </button>
                <button
                  type="button"
                  onClick={() => switchLang('en')}
                  style={lang === 'en' ? { backgroundColor: brandSettings.accentColor, color: '#ffffff' } : {}}
                  className="px-2.5 py-1 text-[11px] font-bold cursor-pointer text-neutral-600 dark:text-neutral-400"
                >
                  EN
                </button>
              </div>
              <span className="hidden sm:inline text-neutral-300">|</span>
              <span className="hidden sm:inline truncate max-w-xs">{brandSettings.tagline}</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://www.threads.net/@meramufeed"
                target="_blank"
                rel="noreferrer"
                style={{ color: brandSettings.accentColor }}
                className="hidden sm:flex items-center gap-1.5 hover:opacity-80 transition-opacity font-bold"
              >
                <AtSign className="w-3.5 h-3.5" />
                <span>@meramufeed</span>
              </a>
              {activeView === 'admin' && (
                <>
                  <span className="text-neutral-300">|</span>
                  <a
                    href="/"
                    className="font-semibold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer dark:text-neutral-400 dark:hover:text-white"
                  >
                    {t.viewSite}
                  </a>
                </>
              )}
              <span className="hidden sm:inline text-neutral-300">|</span>
              <button
                type="button"
                aria-label={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
                onClick={toggleTheme}
                className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-200/60 transition-colors cursor-pointer dark:text-neutral-400 dark:hover:bg-neutral-700"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Brand & Action Navbar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center gap-4">
          {/* Official Brand Logo / Wordmark */}
          <a
            href="/"
            className="flex items-center gap-3 text-left group focus:outline-none cursor-pointer order-1"
          >
            <MeramuLogo brandSettings={brandSettings} size="md" />
          </a>

          {/* Hamburger: mobile = sejajar logo (row 1, far right); desktop = far right after search */}
          {activeView !== 'admin' && (
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="order-2 ml-auto sm:order-3 sm:ml-0 w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-full hover:bg-neutral-100 transition-colors cursor-pointer flex-none dark:hover:bg-neutral-800"
            >
              {menuOpen ? (
                <X className="w-5 h-5 text-neutral-800 dark:text-neutral-100" />
              ) : (
                <>
                  <span className="block w-5 h-[2px] bg-neutral-800 rounded dark:bg-neutral-200" />
                  <span className="block w-5 h-[2px] bg-neutral-800 rounded dark:bg-neutral-200" />
                  <span className="block w-5 h-[2px] bg-neutral-800 rounded dark:bg-neutral-200" />
                </>
              )}
            </button>
          )}
          {/* Search: mobile = full-width row 2; desktop = row 1 before the hamburger */}
          {activeView !== 'admin' && (
            <form action="/cari" method="get" className="relative w-full sm:w-64 order-3 sm:order-2 sm:ml-auto">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                name="q"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeView !== 'home') navigateToHome();
                }}
                placeholder={t.searchPlaceholder}
                className="w-full pl-9 pr-7 py-1.5 bg-neutral-100 hover:bg-neutral-200/60 focus:bg-white text-sm rounded-full border border-transparent focus:border-[#0D1B8C] focus:outline-none transition-all dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:focus:bg-neutral-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          )}
        </div>

        {/* Category Navigation Bar (Only on Reader Views) */}
        {activeView !== 'admin' && (
          <div className="border-t border-neutral-100 bg-white dark:border-white/10 dark:bg-neutral-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2.5">
              {CATEGORIES.map((category) => {
                const isActive = selectedCategory === category && activeView === 'home';
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => goHome(category)}
                    style={
                      isActive
                        ? {
                            backgroundColor: brandSettings.accentColor,
                            color: '#ffffff'
                          }
                        : {}
                    }
                    className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'shadow-xs'
                        : 'text-neutral-600 hover:text-[#0D1B8C] hover:bg-blue-50/60 dark:text-neutral-300 dark:hover:text-neutral-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {catLabel(category)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Hamburger menu: floating rounded-rectangle card over a dimmed backdrop
            (reference: berkatpetani.com menu). Reader views only; Dapur Redaksi lives here. */}
        {activeView !== 'admin' && menuOpen && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Tutup menu"
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-black/50 cursor-default"
            />
            <div className="relative px-4 pt-4">
              <div className="flex items-center justify-between">
                <MeramuLogo brandSettings={brandSettings} size="sm" />
                <button
                  type="button"
                  aria-label="Tutup menu"
                  onClick={() => setMenuOpen(false)}
                  className="w-11 h-11 rounded-full border-2 border-white/80 text-white flex items-center justify-center hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 rounded-[28px] bg-white shadow-2xl overflow-hidden max-h-[calc(100vh-110px)] overflow-y-auto dark:bg-neutral-900">
                <div className="px-6">
                  <div className="flex items-center justify-between py-4 border-b border-neutral-200/70 dark:border-white/10">
                    <span className="text-[17px] font-semibold text-neutral-800 dark:text-neutral-100">Bahasa</span>
                    <div className="flex items-center rounded-full border border-neutral-200 overflow-hidden dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => { switchLang('id'); setMenuOpen(false); }}
                        style={lang === 'id' ? { backgroundColor: brandSettings.accentColor, color: '#ffffff' } : {}}
                        className="px-3 py-1.5 text-xs font-bold cursor-pointer text-neutral-600 dark:text-neutral-400"
                      >
                        ID
                      </button>
                      <button
                        type="button"
                        onClick={() => { switchLang('en'); setMenuOpen(false); }}
                        style={lang === 'en' ? { backgroundColor: brandSettings.accentColor, color: '#ffffff' } : {}}
                        className="px-3 py-1.5 text-xs font-bold cursor-pointer text-neutral-600 dark:text-neutral-400"
                      >
                        EN
                      </button>
                    </div>
                  </div>
                  <nav className="divide-y divide-neutral-200/70 dark:divide-white/10">
                    <a href="/" className="block py-4 text-[17px] font-semibold text-neutral-800 dark:text-neutral-100">{t.menuHome}</a>
                    <a href="/cari" className="block py-4 text-[17px] font-semibold text-neutral-800 dark:text-neutral-100">{t.menuSearch}</a>
                    <a href="/tentang" className="block py-4 text-[17px] font-semibold text-neutral-800 dark:text-neutral-100">{t.menuAbout}</a>
                    <div>
                      <button
                        type="button"
                        aria-expanded={rubrikOpen}
                        onClick={() => setRubrikOpen((o) => !o)}
                        className="w-full flex items-center justify-between py-4 text-[17px] font-semibold text-neutral-800 cursor-pointer dark:text-neutral-100"
                      >
                        <span>{t.menuCategories}</span>
                        <ChevronDown className={`w-5 h-5 transition-transform ${rubrikOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {rubrikOpen && (
                        <div className="pb-3 pl-3">
                          {CATEGORIES.filter((c) => c !== 'Semua').map((category) => (
                            <a
                              key={category}
                              href={categoryHref(category)}
                              className="block py-2.5 text-[15px] font-semibold text-neutral-600 dark:text-neutral-300"
                            >
                              {catLabel(category)}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="py-4">
                      <div className="text-xs font-bold tracking-widest text-neutral-400 uppercase">{t.menuContact}</div>
                      <div className="mt-2 flex flex-col gap-1">
                        <a
                          href={`https://instagram.com/${brandSettings.instagram.replace('@', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 py-2 text-[15px] font-bold hover:opacity-80"
                          style={{ color: brandSettings.accentColor }}
                        >
                          <InstagramIcon className="w-4 h-4" />
                          <span>Instagram @{brandSettings.instagram.replace('@', '')}</span>
                        </a>
                        <a
                          href="https://www.threads.net/@meramufeed"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 py-2 text-[15px] font-bold hover:opacity-80"
                          style={{ color: brandSettings.accentColor }}
                        >
                          <AtSign className="w-4 h-4" />
                          <span>Threads @meramufeed</span>
                        </a>
                      </div>
                    </div>
                  </nav>
                  <div className="py-5 border-t border-neutral-200/70 dark:border-white/10">
                    <a
                      href="/kontak"
                      onClick={() => setMenuOpen(false)}
                      className="inline-flex px-6 py-3 rounded-full border-2 font-bold text-[15px] hover:opacity-80"
                      style={{ borderColor: brandSettings.accentColor, color: brandSettings.accentColor }}
                    >
                      Kontak Redaksi
                    </a>
                    <div className="mt-4">
                      <a
                        href="/dapur-redaksi"
                        className="text-sm font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"
                      >
                        {t.newsroom}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ========================================== */}
      {/* MAIN CONTENT AREA                          */}
      {/* ========================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isLoading ? (
          // CLS fix (Oct 2026): the old spinner block was ~200px tall, so the
          // footer jumped from near the viewport top to the bottom of the
          // fully loaded homepage. This skeleton mirrors the homepage
          // structure (hero + sidebar + 6-card grid) so the footer starts
          // near its final position. Only the loading view changes; the
          // loaded page is untouched.
          <div role="status" aria-label={t.loading} className="space-y-12 animate-pulse">
            <span className="sr-only">{t.loading}</span>
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-8 bg-white rounded-2xl border border-neutral-200/80 overflow-hidden dark:bg-neutral-900 dark:border-white/10">
                <div className="aspect-16/9 w-full bg-neutral-100 dark:bg-neutral-800" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-4 w-1/2 rounded bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-3 w-1/3 rounded bg-neutral-100 dark:bg-neutral-800" />
                </div>
              </div>
              <div className="lg:col-span-4 space-y-4">
                <div className="h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800" />
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4 items-start py-4 border-b border-neutral-100 last:border-0 dark:border-white/10">
                    <div className="w-20 h-20 rounded-xl bg-neutral-100 shrink-0 dark:bg-neutral-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-neutral-100 dark:bg-neutral-800" />
                      <div className="h-3 w-1/2 rounded bg-neutral-100 dark:bg-neutral-800" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden dark:bg-neutral-900 dark:border-white/10">
                  <div className="aspect-16/10 w-full bg-neutral-100 dark:bg-neutral-800" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 w-11/12 rounded bg-neutral-100 dark:bg-neutral-800" />
                    <div className="h-4 w-2/3 rounded bg-neutral-100 dark:bg-neutral-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeView === 'home' ? (
          /* ========================================== */
          /* VIEW 1: PUBLIC READER HOME                 */
          /* ========================================== */
          <div className="space-y-12">
            {/* Search / Category Filter Status Banner */}
            {(selectedCategory !== 'Semua' || searchQuery.trim() !== '') && (
              <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs dark:bg-neutral-900 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">{t.showing}</span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">{catLabel(selectedCategory)}</span>
                  {searchQuery && (
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {t.forKeyword} <strong>"{searchQuery}"</strong>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedCategory('Semua');
                    setSearchQuery('');
                  }}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 underline dark:text-neutral-400"
                >
                  {t.resetFilter}
                </button>
              </div>
            )}

            {/* HERO HEADLINE SECTION (Shown on 'Semua' & no search) */}
            {selectedCategory === 'Semua' && !searchQuery.trim() && featuredArticle && (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Main Featured Story (8 cols) */}
                <a
                  href={articleHref(featuredArticle)}
                  className="lg:col-span-8 block group cursor-pointer bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs hover:shadow-md transition-all dark:bg-neutral-900 dark:border-white/10"
                >
                  <div className="relative aspect-16/9 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <img
                      src={wikimediaThumb(featuredArticle.imageUrl, 1200)}
                      srcSet={`${wikimediaThumb(featuredArticle.imageUrl, 800)} 800w, ${wikimediaThumb(featuredArticle.imageUrl, 1200)} 1200w`}
                      sizes="(max-width: 1024px) 100vw, 840px"
                      width="1200"
                      height="675"
                      fetchPriority="high"
                      decoding="async"
                      alt={featuredArticle.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span
                        style={{ backgroundColor: brandSettings.accentColor }}
                        className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow-sm"
                      >
                        {t.mainHeadline}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/95 text-neutral-900 backdrop-blur-xs shadow-sm dark:text-neutral-100">
                        {featuredArticle.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 sm:p-8">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight leading-tight group-hover:underline decoration-2 underline-offset-4 dark:text-neutral-100">
                      {featuredArticle.title}
                    </h1>
                    <p className="mt-3 text-neutral-600 text-base sm:text-lg leading-relaxed line-clamp-3 dark:text-neutral-400">
                      {featuredArticle.excerpt}
                    </p>
                    <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-100">{featuredArticle.author}</span>
                        <span>•</span>
                        <span>{formatDate(featuredArticle.createdAt)}</span>
                      </div>
                      <span className="flex items-center gap-1 font-medium text-neutral-600 dark:text-neutral-400">
                        <Clock className="w-3.5 h-3.5" />
                        {readTimeLabel(featuredArticle.readTime)}
                      </span>
                    </div>
                  </div>
                </a>

                {/* Right column: Lagi Viral (auto) directly above Pilihan Redaksi, same width */}
                <div className="lg:col-span-4 space-y-4">
                  {viralArticles.length > 0 && (
                    <section
                      className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs dark:bg-neutral-900 dark:border-white/10"
                      onMouseEnter={() => setViralPaused(true)}
                      onMouseLeave={() => setViralPaused(false)}
                    >
                      <div
                        style={{ backgroundColor: brandSettings.accentColor }}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                          Lagi Viral
                        </span>
                        <span className="text-[11px] font-semibold text-white/80">
                          {Math.min(viralIndex + 1, viralArticles.length)} / {viralArticles.length}
                        </span>
                      </div>
                      <div className="px-4 py-3">
                      <div className="h-16 overflow-hidden">
                        <div
                          style={{
                            transform: `translateY(-${viralIndex * 4}rem)`,
                            transition: viralNoAnim ? 'none' : 'transform 0.5s ease',
                          }}
                        >
                          {[...viralArticles, viralArticles[0]].map((a, i) => (
                            <a
                              key={`${a.id}-${i}`}
                              href={articleHref(a)}
                              className="flex h-16 items-center text-sm font-bold leading-snug text-neutral-900 hover:underline line-clamp-2 dark:text-neutral-100"
                            >
                              {a.title}
                            </a>
                          ))}
                        </div>
                      </div>
                      </div>
                    </section>
                  )}
                  <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-2xs dark:bg-neutral-900 dark:border-white/10">
                  <div className="flex items-center gap-2 pb-4 mb-5 border-b border-neutral-100 dark:border-white/10">
                    <TrendingUp
                      style={{ color: brandSettings.accentColor }}
                      className="w-5 h-5"
                    />
                    <h2
                      style={{ color: brandSettings.accentColor }}
                      className="text-base font-extrabold uppercase tracking-wider"
                    >
                      {t.editorsPicks}
                    </h2>
                  </div>

                  <div className="divide-y divide-neutral-100 dark:divide-white/10">
                    {trendingArticles.map((item, idx) => (
                      <a
                        key={item.id}
                        href={articleHref(item)}
                        className="py-4 first:pt-0 last:pb-0 group cursor-pointer flex gap-4 items-start"
                      >
                        <span className="text-2xl font-black text-neutral-400 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors leading-none select-none">
                          0{idx + 1}
                        </span>
                        <div className="space-y-1.5 flex-1">
                          <span
                            style={{ color: brandSettings.accentColor }}
                            className="text-[11px] font-bold uppercase tracking-wider block"
                          >
                            {item.category}
                          </span>
                          <h3 className="text-sm font-bold text-neutral-900 leading-snug group-hover:underline dark:text-neutral-100">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                            <span>{formatDate(item.createdAt)}</span>
                            <span>•</span>
                            <span>{readTimeLabel(item.readTime)}</span>
                          </div>
                        </div>
                        {item.imageUrl ? (
                          <img
                            src={wikimediaThumb(item.imageUrl, 320)}
                            alt={item.title}
                            width="80"
                            height="80"
                            loading="lazy"
                            decoding="async"
                            className="w-20 h-20 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-20 h-20 rounded-xl shrink-0 flex items-center justify-center text-white text-xl font-black"
                            style={{ backgroundColor: brandSettings.accentColor }}
                          >
                            M
                          </div>
                        )}
                      </a>
                    ))}
                  </div>

                  {/* Quick Instagram CTA Box */}
                  <div className="mt-6 pt-5 border-t border-neutral-100 dark:border-white/10">
                    <a
                      href={`https://instagram.com/${brandSettings.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ backgroundColor: `${brandSettings.accentColor}08` }}
                      className="flex items-center justify-between p-3.5 rounded-xl hover:opacity-90 border border-neutral-200/80 transition-all group dark:border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          style={{ backgroundColor: brandSettings.accentColor }}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-2xs"
                        >
                          <InstagramIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <span
                            style={{ color: brandSettings.accentColor }}
                            className="text-xs font-extrabold block"
                          >
                            {t.follow} @{brandSettings.instagram.replace('@', '')}
                          </span>
                          <span className="text-[11px] text-neutral-500 block dark:text-neutral-400">
                            {t.followSub}
                          </span>
                        </div>
                      </div>
                      <ExternalLink
                        style={{ color: brandSettings.accentColor }}
                        className="w-4 h-4 opacity-70 group-hover:opacity-100"
                      />
                    </a>
                  </div>
                </div>
                </div>
              </section>
            )}

            {/* LATEST NEWS GRID SECTION */}
            <section id="terbaru-grid">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-neutral-200 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span
                    style={{ backgroundColor: brandSettings.accentColor }}
                    className="w-2.5 h-2.5 rounded-full"
                  />
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
                    {selectedCategory === 'Semua' ? t.latest : `${t.section} ${catLabel(selectedCategory)}`}
                  </h2>
                </div>
                <span className="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                  {filteredArticles.length} {t.articlesAvailable}
                </span>
              </div>

              {gridArticles.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center dark:bg-neutral-900 dark:border-white/10">
                  <p className="text-neutral-500 font-medium dark:text-neutral-400">
                    {t.noResults}
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCategory('Semua');
                      setSearchQuery('');
                    }}
                    className="mt-4 px-4 py-2 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold"
                  >
                    {t.showAllNews}
                  </button>
                </div>
              ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pagedGridArticles.map((article) => (
                    <a
                      key={article.id}
                      href={articleHref(article)}
                      className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs hover:shadow-md transition-all group cursor-pointer flex flex-col dark:bg-neutral-900 dark:border-white/10"
                    >
                      <div className="relative aspect-16/10 w-full bg-neutral-100 overflow-hidden dark:bg-neutral-800">
                        <img
                          src={wikimediaThumb(article.imageUrl, 800)}
                          srcSet={`${wikimediaThumb(article.imageUrl, 400)} 400w, ${wikimediaThumb(article.imageUrl, 800)} 800w`}
                          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 380px"
                          width="800"
                          height="500"
                          loading="lazy"
                          decoding="async"
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/95 text-neutral-900 shadow-xs dark:text-neutral-100">
                          {article.category}
                        </span>
                      </div>
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900 leading-snug group-hover:underline decoration-1 underline-offset-4 dark:text-neutral-100">
                            {article.title}
                          </h3>
                          <p className="mt-2 text-sm text-neutral-600 line-clamp-2 leading-relaxed dark:text-neutral-400">
                            {article.excerpt}
                          </p>
                        </div>
                        <div
                          style={{ backgroundColor: brandSettings.accentColor }}
                          className="-mx-5 -mb-5 mt-5 px-5 py-3.5 flex items-center justify-between text-xs text-white"
                        >
                          <span className="font-medium">{article.author}</span>
                          <div className="flex items-center gap-2">
                            <span>{formatDate(article.createdAt)}</span>
                            <span>•</span>
                            <span>{readTimeLabel(article.readTime)}</span>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
                {totalGridPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      disabled={safeGridPage === 1}
                      onClick={() => goToGridPage(safeGridPage - 1)}
                      className="px-3 py-2 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 disabled:opacity-40 dark:border-white/10 dark:text-neutral-300"
                    >
                      {t.prevPage}
                    </button>
                    {Array.from({ length: totalGridPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => goToGridPage(p)}
                        style={p === safeGridPage ? { backgroundColor: brandSettings.accentColor } : undefined}
                        className={`w-9 h-9 rounded-full text-xs font-bold ${p === safeGridPage ? 'text-white' : 'border border-neutral-200 text-neutral-700 dark:border-white/10 dark:text-neutral-300'}`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      disabled={safeGridPage === totalGridPages}
                      onClick={() => goToGridPage(safeGridPage + 1)}
                      className="px-3 py-2 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 disabled:opacity-40 dark:border-white/10 dark:text-neutral-300"
                    >
                      {t.nextPage}
                    </button>
                  </div>
                )}
                </>
              )}
            </section>
          </div>
        ) : activeView === 'article' && currentArticle ? (
          /* ========================================== */
          /* VIEW 2: ARTICLE READER VIEW                */
          /* ========================================== */
          <div className="max-w-3xl mx-auto">
            {/* Back Navigation */}
            <button
              onClick={() => navigateToHome()}
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900 mb-6 group cursor-pointer dark:text-neutral-400 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Kembali ke Beranda</span>
            </button>

            <article className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden p-6 sm:p-10 lg:p-12 dark:bg-neutral-900 dark:border-white/10">
              {/* Category & Meta Header */}
              <div className="flex flex-wrap items-center gap-2.5 mb-4">
                <button
                  onClick={() => goHome(currentArticle.category)}
                  style={{ backgroundColor: brandSettings.accentColor }}
                  className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
                >
                  {currentArticle.category}
                </button>
                <span className="text-neutral-300">•</span>
                <span className="text-xs font-medium text-neutral-500 flex items-center gap-1 dark:text-neutral-400">
                  <Clock className="w-3.5 h-3.5" />
                  {currentArticle.readTime}
                </span>
              </div>

              {/* Main Title */}
              <h1 className="text-2xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight leading-tight dark:text-neutral-100">
                {currentArticle.title}
              </h1>

              {/* Excerpt / Lead */}
              <p className="mt-4 text-base sm:text-xl text-neutral-600 leading-relaxed font-normal dark:text-neutral-400">
                {currentArticle.excerpt}
              </p>

              {/* Author & Share Bar */}
              <div className="mt-6 pt-6 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-4 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: brandSettings.accentColor }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  >
                    {currentArticle.author?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-neutral-900 block dark:text-neutral-100">
                      {currentArticle.author}
                    </span>
                    <span className="text-xs text-neutral-500 block dark:text-neutral-400">
                      Diterbitkan {formatDate(currentArticle.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Share Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href);
                      showToast('Tautan artikel berhasil disalin!');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link</span>
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${currentArticle.title} - Baca selengkapnya di ${brandSettings.domain}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Featured Image */}
              {currentArticle.imageUrl && (
                <figure className="my-8">
                  <div className="rounded-2xl overflow-hidden bg-neutral-100 aspect-16/9 dark:bg-neutral-800">
                    <img
                      src={wikimediaThumb(currentArticle.imageUrl, 800)}
                      alt={currentArticle.title}
                      width="800"
                      height="450"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {currentArticle.imageCaption && (
                    <figcaption className="mt-2.5 text-xs text-neutral-500 text-center italic dark:text-neutral-400">
                      {currentArticle.imageCaption}
                    </figcaption>
                  )}
                </figure>
              )}

              {/* Article Body Content */}
              <div className="mt-8 prose max-w-none">
                {renderArticleContent(currentArticle.content)}
              </div>

              {/* Footer Tag & Quick Edit Button for Admin */}
              <div className="mt-10 pt-6 border-t border-neutral-100 flex items-center justify-between dark:border-white/10">
                <div className="text-xs text-neutral-400">
                  © {new Date().getFullYear()} {brandSettings.siteName} ({brandSettings.domain})
                </div>
                {isAdmin && (
                <button
                  onClick={() => {
                    setPendingEditArticle(currentArticle);
                    setActiveView('admin');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 cursor-pointer dark:text-neutral-400"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>Edit Artikel Ini di Dapur Redaksi</span>
                </button>
                )}
              </div>
            </article>

            {/* Related Articles Section */}
            {relatedArticles.length > 0 && (
              <div className="mt-12">
                <h3 className="text-lg font-extrabold text-neutral-900 mb-4 dark:text-neutral-100">
                  Berita Terkait di {currentArticle.category}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {relatedArticles.map((rel) => (
                    <div
                      key={rel.id}
                      onClick={() => openArticle(rel.id)}
                      className="bg-white p-4 rounded-2xl border border-neutral-200/80 hover:shadow-md transition-all cursor-pointer group dark:bg-neutral-900 dark:border-white/10"
                    >
                      <div className="aspect-16/10 rounded-xl overflow-hidden bg-neutral-100 mb-3 dark:bg-neutral-800">
                        <img
                          src={wikimediaThumb(rel.imageUrl, 640)}
                          alt={rel.title}
                          width="640"
                          height="400"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900 group-hover:underline line-clamp-2 dark:text-neutral-100">
                        {rel.title}
                      </h4>
                      <span className="text-[11px] text-neutral-400 block mt-2">
                        {formatDate(rel.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================== */
          <Suspense fallback={<div className="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200/80 p-6 text-center text-sm text-neutral-500 dark:bg-neutral-900 dark:border-white/10">Memuat Dapur Redaksi…</div>}>
            <AdminPanel
              articles={articles}
              brandSettings={brandSettings}
              setBrandSettings={setBrandSettings}
              FIREBASE_READY={FIREBASE_READY}
              db={db}
              appId={appId}
              navigateToHome={navigateToHome}
              showToast={showToast}
              openArticle={openArticle}
              formatDate={formatDate}
              categories={CATEGORIES}
              MeramuLogo={MeramuLogo}
              pendingEditArticle={pendingEditArticle}
              onPendingEditConsumed={() => setPendingEditArticle(null)}
              onAuthChange={setIsAdmin}
            />
          </Suspense>
        )}
      </main>

      {/* ========================================== */}
      {/* EDITORIAL FOOTER                           */}
      {/* ========================================== */}
      <footer className="bg-white border-t border-neutral-200 mt-16 dark:bg-neutral-900 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <MeramuLogo brandSettings={brandSettings} size="sm" />
            <p className="text-xs text-neutral-500 mt-3 max-w-sm dark:text-neutral-400">
              {brandSettings.tagline} Hadir secara resmi di <strong>{brandSettings.domain}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-neutral-600 dark:text-neutral-400">
            {CATEGORIES.slice(1).map((cat) => (
              <button
                key={cat}
                onClick={() => goHome(cat)}
                className="hover:text-[#0D1B8C] dark:hover:text-white transition-colors cursor-pointer"
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-neutral-600 dark:text-neutral-400">
            <a href="/tentang" className="hover:text-[#0D1B8C] dark:hover:text-white transition-colors">Tentang</a>
            <a href="/privasi" className="hover:text-[#0D1B8C] dark:hover:text-white transition-colors">Privasi</a>
            <a href="/kontak" className="hover:text-[#0D1B8C] dark:hover:text-white transition-colors">Kontak</a>
          </div>

          <div className="text-xs text-neutral-400">
            © {new Date().getFullYear()} {brandSettings.siteName}. All rights reserved.
          </div>
        </div>
      </footer>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}