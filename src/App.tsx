import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Search, 
  SquarePen, 
  Sparkles, 
  Clock, 
  Share2, 
  ArrowLeft, 
  AtSign,
  Trash, 
  PenLine, 
  Check, 
  Plus, 
  Palette, 
  Star, 
  Eye, 
  Globe, 
  ChevronRight, 
  BookOpen,
  Image as ImageIcon,
  X,
  TrendingUp,
  Layers,
  Copy,
  ExternalLink,
  CircleAlert
} from 'lucide-react';

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
// Without apiKey + projectId the site runs in demo mode: local seed
// articles, no sign-in, no Firestore writes. Admin login needs Firebase
// plus an admin user created in the Firebase console (see README).
const FIREBASE_READY = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const app = FIREBASE_READY ? initializeApp(firebaseConfig) : null;
const auth = FIREBASE_READY ? getAuth(app) : null;
const db = FIREBASE_READY ? getFirestore(app) : null;
// Firestore namespace for this site's articles & brand settings.
const appId = 'meramu-site-app';

// ==========================================
// CONSTANTS & INITIAL SEED DATA
// ==========================================
const CATEGORIES = [
  'Semua',
  'Pop Culture',
  'Ekonomi Kreatif',
  'Musik & Komedi',
  'Lifestyle',
  'Tech',
  'Berita Umum'
];

// Every section has its own address: category tabs link to real pages.
const CATEGORY_SLUGS = {
  'Pop Culture': 'pop-culture',
  'Ekonomi Kreatif': 'ekonomi-kreatif',
  'Musik & Komedi': 'musik-komedi',
  'Lifestyle': 'lifestyle',
  'Tech': 'tech',
  'Berita Umum': 'berita-umum'
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
    noResults: 'Belum ada berita yang cocok dengan filter atau pencarian ini.',
    follow: 'Ikuti',
    followSub: 'Update visual harian di Instagram',
    newsroom: 'Dapur Redaksi',
    viewSite: 'Lihat Website',
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
    noResults: 'No news matches this filter or search.',
    follow: 'Follow',
    followSub: 'Daily visual updates on Instagram',
    newsroom: 'Newsroom',
    viewSite: 'View Website',
    justNow: 'Just now',
    minRead: 'Min Read',
  },
};

// Category names stay Indonesian in data; only the displayed label switches.
const CATEGORY_LABELS_EN = {
  'Semua': 'All',
  'Ekonomi Kreatif': 'Creative Economy',
  'Musik & Komedi': 'Music & Comedy',
  'Berita Umum': 'General News',
};

const PRESET_COLORS = [
  { name: 'Meramu Royal Blue', hex: '#0D1B8C' },
  { name: 'Meramu Deep Navy', hex: '#081059' },
  { name: 'Electric Cobalt', hex: '#1D4ED8' },
  { name: 'Editorial Black', hex: '#111827' },
  { name: 'Meramu Terracotta', hex: '#C2410C' },
  { name: 'Emerald Sage', hex: '#047857' }
];

const UNSPLASH_PRESETS = [
  { label: 'Konser / Musik', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Kopi / Lifestyle', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Kreatif / Studio', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Tech / Gadget', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Komedi / Mic', url: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1200&q=80' }
];

const INITIAL_ARTICLES = [
  {
    id: 'seed-1',
    title: 'Geliat Skena Stand-Up Comedy Independen: Dari Kafe Sempit Menuju Tur Nasional',
    excerpt: 'Bagaimana kolektif komika lokal membangun ekosistem pertunjukan mandiri yang tiketnya selalu ludes terjual dalam hitungan menit.',
    category: 'Musik & Komedi',
    author: 'Redaksi Meramu',
    readTime: '5 Menit Baca',
    imageUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1200&q=80',
    imageCaption: 'Suasana open mic dan pertunjukan spesial komedi tunggal di sudut kota Jakarta.',
    isFeatured: true,
    isTrending: true,
    createdAt: Date.now() - 3600000 * 2,
    content: `Dalam beberapa tahun terakhir, panggung komedi tunggal atau stand-up comedy di Indonesia mengalami pergeseran yang sangat menarik. Jika dulu tolok ukur kesuksesan seorang komika adalah seberapa sering ia tampil di layar kaca televisi nasional, kini panggung-panggung intim di kafe, gedung kesenian, hingga ruang kreatif alternatif justru menjadi primadona utama.

Fenomena ini tidak lepas dari keberanian para komika dan kolektif kreatif dalam memproduksi pertunjukan spesial (special show) mereka sendiri. Dengan mengandalkan promosi organik di media sosial seperti Instagram dan potongan klip pendek, kedekatan antara penampil dan penonton terbangun jauh lebih solid.

## Ekonomi Baru di Balik Tawa

Bukan sekadar hiburan malam akhir pekan, ekosistem pertunjukan komedi independen kini telah memutar roda ekonomi kreatif yang serius. Mulai dari kru produksi panggung, desainer poster, videografer dokumentasi, hingga penjualan merchandise eksklusif maupun rilisan digital (digital download) yang memberikan pemasukan berkelanjutan bagi kreatornya.

> "Penonton sekarang datang bukan cuma mau ketawa, tapi ingin merasakan pengalaman kolektif dan mendukung kejujuran karya komika favorit mereka secara langsung," ungkap salah satu produser pertunjukan lokal.

Ke depannya, kolaborasi antara musisi indie dan komika dalam satu rangkaian tur lintas kota diprediksi akan semakin marak, menciptakan format festival pop-culture baru yang segar bagi anak muda.`
  },
  {
    id: 'seed-2',
    title: 'Era Baru Brand Lokal: Ketika Storytelling Lebih Kuat dari Sekadar Diskon Besar',
    excerpt: 'Konsumen muda kini lebih memilih produk dengan narasi komunitas yang autentik dibandingkan perang harga di marketplace.',
    category: 'Ekonomi Kreatif',
    author: 'Dimas Pratama',
    readTime: '4 Menit Baca',
    imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    imageCaption: 'Studio kreatif tempat perancangan identitas visual dan narasi produk lokal.',
    isFeatured: false,
    isTrending: true,
    createdAt: Date.now() - 3600000 * 8,
    content: `Persaingan brand lokal di sektor fesyen, kuliner, hingga produk perawatan diri kini memasuki babak pendewasaan. Strategi bakar uang lewat potongan harga ekstrem perlahan ditinggalkan karena terbukti tidak membangun loyalitas jangka panjang.

Sebagai gantinya, studio-studio kreatif dan pemilik jenama lokal mulai berinvestasi serius pada storytelling atau penceritaan. Mereka meramu identitas visual yang rapi, zine cetak terbatas, hingga aktivasi komunitas luring seperti klub lari atau sesi diskusi sore.

## Komunitas Sebagai Fondasi

Ketika sebuah brand mampu merepresentasikan nilai dan gaya hidup audiensnya, produk yang mereka rilis otomatis menjadi medium ekspresi diri. Inilah alasan mengapa perilisan koleksi kapsul kolaborasi antara brand pakaian lokal dengan ilustrator atau musisi independen selalu memicu antusiasme tinggi.`
  },
  {
    id: 'seed-3',
    title: 'Mengapa Kamera Digital Saku Era 2000-an Kembali Diburu Generasi Muda?',
    excerpt: 'Di tengah gempuran kamera smartphone beresolusi tinggi, estetika foto low-fi dari digicam lawas justru menjadi simbol gaya baru.',
    category: 'Pop Culture',
    author: 'Nadia Larasati',
    readTime: '3 Menit Baca',
    imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
    imageCaption: 'Kamera saku digital yang kembali populer di kalangan pecinta fotografi jalanan.',
    isFeatured: false,
    isTrending: true,
    createdAt: Date.now() - 3600000 * 18,
    content: `Jika kamu membuka linimasa Instagram belakangan ini, kamu mungkin sering menemukan unggahan foto dengan warna sedikit pudar, kontras flash yang tajam, dan tekstur grain khas sensor CCD awal tahun 2000-an. Tren ini membuat harga kamera digital saku (digicam) bekas di pasar barang antik melonjak drastis.

Bagi banyak anak muda, kesempurnaan algoritma pemrosesan gambar di ponsel pintar terkadang terasa terlalu klinis. Digicam menawarkan ketidaksempurnaan yang terasa hangat, spontan, dan penuh nostalgia.

Selain faktor visual, pengalaman memotret tanpa terganggu notifikasi pesan masuk juga menjadi daya tarik tersendiri dalam menikmati momen bersama teman-teman.`
  },
  {
    id: 'seed-4',
    title: 'AI untuk Kreator Independen: Alat Bantu Riset atau Pengganti Imajinasi?',
    excerpt: 'Menilik bagaimana penulis, desainer, dan pekerja media meramu teknologi kecerdasan buatan tanpa kehilangan sentuhan manusiawi.',
    category: 'Tech',
    author: 'Raka Wijaya',
    readTime: '6 Menit Baca',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    imageCaption: 'Perkembangan teknologi komputasi modern dalam alur kerja kreatif.',
    isFeatured: false,
    isTrending: false,
    createdAt: Date.now() - 3600000 * 28,
    content: `Kehadiran berbagai perangkat kecerdasan buatan (AI) generatif telah mengubah cara ruang redaksi dan studio desain bekerja. Tugas-tugas administratif seperti transkripsi wawancara, pengelompokan data riset, hingga pembuatan purwarupa kode kini bisa diselesaikan dalam hitungan detik.

Namun, di tengah efisiensi tersebut, nilai dari kurasi manusia justru semakin mahal. Pembaca dan penikmat karya seni tetap mencari sudut pandang personal, empati, serta humor kontekstual yang hanya bisa lahir dari pengalaman hidup nyata.

Kuncinya terletak pada bagaimana kreator memposisikan teknologi sebagai asisten teknis di dapur produksi, sementara kemudi utama rasa dan gagasan tetap dipegang penuh oleh manusia.`
  },
  {
    id: 'seed-5',
    title: 'Budaya Slow Morning: Tren Kafe Pagi dan Ruang Ketiga di Tengah Hiruk Pikuk Kota',
    excerpt: 'Alih-alih begadang hingga larut malam, semakin banyak pekerja urban memilih memulai hari dengan kopi pagi dan obrolan santai.',
    category: 'Lifestyle',
    author: 'Redaksi Meramu',
    readTime: '4 Menit Baca',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    imageCaption: 'Secangkir kopi pagi sebelum memulai rutinitas harian.',
    isFeatured: false,
    isTrending: false,
    createdAt: Date.now() - 3600000 * 42,
    content: `Ada pemandangan berbeda di berbagai kedai kopi lokal pukul tujuh pagi. Kursi-kursi sudah mulai terisi oleh mereka yang baru selesai berolahraga pagi atau pekerja lepas yang sengaja mencari suasana tenang sebelum jam sibuk dimulai.

Gaya hidup 'slow morning' ini menjadi respons alami terhadap kelelahan bekerja di depan layar sepanjang hari. Menikmati sarapan ringan, membaca berita terkini, dan berbincang tanpa terburu-buru di kedai kopi lingkungan sekitar terbukti membantu menjaga kewarasan mental di tengah ritme kota yang serba cepat.`
  }
];

const DEFAULT_BRAND = {
  siteName: 'MERAMU.CO',
  tagline: 'Meramu gagasan, kultur pop, dan cerita kreatif terkini.',
  domain: 'meramu.site',
  instagram: 'meramudotco',
  accentColor: '#0D1B8C',
  logoStyle: 'badge', // 'badge' | 'minimal'
  logoUrl: ''
};

// ==========================================
// OFFICIAL MERAMU.CO LOGO COMPONENT
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
            style={{
              color: bgColor,
              fontFamily: "'Inter', 'Helvetica Neue', 'Arial Black', sans-serif"
            }}
            className="text-2xl sm:text-3xl font-black tracking-wider uppercase block leading-none"
          >
            {brandSettings.siteName}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold block mt-0.5">
            Digital Media & Culture
          </span>
        </div>
      </div>
    );
  }

  // Default: Official Royal Blue Box Badge Logo matching uploaded image
  return (
    <div className="flex items-center gap-3">
      <div
        style={{ backgroundColor: bgColor }}
        className={`${
          size === 'sm'
            ? 'px-3 py-1.5'
            : 'px-4 sm:px-5 py-2 sm:py-2.5'
        } inline-flex items-center justify-center shadow-xs transition-transform group-hover:scale-[1.02] select-none`}
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
      {size !== 'sm' && (
        <div className="hidden md:flex flex-col justify-center self-stretch border-l border-neutral-200 pl-3">
          <span
            style={{ color: bgColor }}
            className="text-lg sm:text-xl font-extrabold uppercase tracking-widest leading-tight"
          >
            Official Portal
          </span>
          <span className="text-sm sm:text-base text-neutral-400 font-medium leading-tight mt-0.5">
            {brandSettings.domain}
          </span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  // Auth & Database State
  const [user, setUser] = useState(null);
  const [articles, setArticles] = useState([]);
  const [brandSettings, setBrandSettings] = useState(DEFAULT_BRAND);
  const [isLoading, setIsLoading] = useState(true);
  const [seedingInProgress, setSeedingInProgress] = useState(false);

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
  const [toastMessage, setToastMessage] = useState(null);

  // Admin CMS State
  const [adminTab, setAdminTab] = useState('articles'); // 'articles' | 'editor' | 'brand'
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState(null);
  // Admin = signed in with email, not the anonymous reader session.
  const isAdmin = Boolean(user && !user.isAnonymous);
  const [editingArticle, setEditingArticle] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Article Editor Form State
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    category: 'Pop Culture',
    author: 'Redaksi Meramu',
    readTime: '4 Menit Baca',
    imageUrl: '',
    imageCaption: '',
    isFeatured: false,
    isTrending: false,
    content: ''
  });

  // Helper to show toast notifications
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 1. Firebase Auth Effect
  useEffect(() => {
    // Demo mode: no Firebase, no sign-in. Readers still see seed articles.
    if (!FIREBASE_READY || !auth) return;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error('Auth initialization error:', err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Firestore Data Sync Effect
  useEffect(() => {
    // Demo mode: serve local seed articles, no Firestore listeners.
    if (!FIREBASE_READY || !db) {
      setArticles(INITIAL_ARTICLES);
      setIsLoading(false);
      return;
    }
    if (!user) return;

    const articlesRef = collection(db, 'artifacts', appId, 'public', 'data', 'articles');
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'brand');

    // Listen to Articles Collection
    const unsubArticles = onSnapshot(
      articlesRef,
      async (snapshot) => {
        if (snapshot.empty && !seedingInProgress) {
          // Empty collection: show local seeds immediately so readers never
          // hang on loading. Only a signed-in admin can write seeds to
          // Firestore (locked rules); anonymous readers just see the local
          // seeds until an admin seeds once.
          setArticles(INITIAL_ARTICLES);
          setIsLoading(false);
          if (!user || user.isAnonymous) return;
          setSeedingInProgress(true);
          try {
            for (const item of INITIAL_ARTICLES) {
              const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'articles', item.id);
              await setDoc(docRef, item);
            }
          } catch (seedErr) {
            console.error('Error seeding initial articles:', seedErr);
          } finally {
            setSeedingInProgress(false);
          }
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
        // Fallback to local seed if Firestore fails
        setArticles(INITIAL_ARTICLES);
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
  }, [user]);

  // Derived Data for Public View
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchesCategory = selectedCategory === 'Semua' || art.category === selectedCategory;
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

  const trendingArticles = useMemo(() => {
    const trending = articles.filter((a) => a.isTrending);
    return trending.length > 0 ? trending.slice(0, 4) : articles.slice(0, 4);
  }, [articles]);

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
  // Public article reading lives on real separate pages (/berita/<id>);
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

  // Admin Handlers
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminError(null);
    if (!FIREBASE_READY || !auth) {
      setAdminError('Firebase belum terhubung. Mode demo tidak bisa login admin.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      setAdminPassword('');
    } catch (err) {
      console.error('Admin login error:', err);
      setAdminError('Email atau password admin salah, atau akun admin belum dibuat di Firebase.');
    }
  };

  const handleAdminLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      await signInAnonymously(auth);
      navigateToHome();
    } catch (err) {
      console.error('Admin logout error:', err);
    }
  };
  const startCreateNewArticle = () => {
    setEditingArticle(null);
    setFormData({
      title: '',
      excerpt: '',
      category: 'Pop Culture',
      author: 'Redaksi Meramu',
      readTime: '4 Menit Baca',
      imageUrl: UNSPLASH_PRESETS[0].url,
      imageCaption: '',
      isFeatured: false,
      isTrending: true,
      content: ''
    });
    setAdminTab('editor');
  };

  const startEditArticle = (article) => {
    setEditingArticle(article);
    setFormData({
      title: article.title || '',
      excerpt: article.excerpt || '',
      category: article.category || 'Pop Culture',
      author: article.author || 'Redaksi Meramu',
      readTime: article.readTime || '4 Menit Baca',
      imageUrl: article.imageUrl || '',
      imageCaption: article.imageCaption || '',
      isFeatured: Boolean(article.isFeatured),
      isTrending: Boolean(article.isTrending),
      content: article.content || ''
    });
    setAdminTab('editor');
  };

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.title.trim() || !formData.content.trim()) {
      showToast('Judul dan Isi Berita wajib diisi!');
      return;
    }

    try {
      // Calculate estimated read time automatically if needed
      const wordCount = formData.content.trim().split(/\s+/).length;
      const calcMinutes = Math.max(2, Math.ceil(wordCount / 160));
      const payload = {
        ...formData,
        readTime: `${calcMinutes} Menit Baca`,
        updatedAt: Date.now()
      };

      // If marked as featured, un-feature other articles first
      if (payload.isFeatured) {
        const currentlyFeatured = articles.filter((a) => a.isFeatured && a.id !== editingArticle?.id);
        for (const item of currentlyFeatured) {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'articles', item.id);
          await updateDoc(ref, { isFeatured: false });
        }
      }

      if (editingArticle) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'articles', editingArticle.id);
        await updateDoc(docRef, payload);
        showToast('Berita berhasil diperbarui!');
      } else {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'articles');
        await addDoc(colRef, {
          ...payload,
          createdAt: Date.now()
        });
        showToast('Berita baru berhasil diterbitkan!');
      }

      setAdminTab('articles');
      setEditingArticle(null);
    } catch (error) {
      console.error('Error saving article:', error);
      showToast('Gagal menyimpan berita. Coba lagi.');
    }
  };

  const handleDeleteArticle = async (id) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'articles', id);
      await deleteDoc(docRef);
      setDeleteConfirmId(null);
      showToast('Berita berhasil dihapus.');
    } catch (error) {
      console.error('Error deleting article:', error);
      showToast('Gagal menghapus berita.');
    }
  };

  const handleToggleFeatured = async (article) => {
    if (!user) return;
    try {
      // Unset others
      for (const item of articles) {
        if (item.isFeatured && item.id !== article.id) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'articles', item.id), {
            isFeatured: false
          });
        }
      }
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'articles', article.id), {
        isFeatured: !article.isFeatured
      });
      showToast(`"${article.title.slice(0, 28)}..." dijadikan Headline Utama.`);
    } catch (error) {
      console.error('Error toggling featured:', error);
    }
  };

  const handleSaveBrandSettings = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'brand');
      await setDoc(settingsRef, brandSettings);
      showToast('Identitas & Warna Brand berhasil disimpan!');
    } catch (error) {
      console.error('Error saving brand settings:', error);
      showToast('Gagal menyimpan pengaturan brand.');
    }
  };

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
          <h3 key={index} className="text-xl font-bold text-neutral-900 mt-6 mb-3">
            {trimmed.replace('## ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote
            key={index}
            style={{ borderLeftColor: brandSettings.accentColor }}
            className="my-4 pl-4 italic text-neutral-700 border-l-4 font-serif text-lg bg-neutral-50 py-2.5 pr-4 rounded-r-xl"
          >
            "{trimmed.replace('> ', '')}"
          </blockquote>
        );
      }
      return (
        <p key={index} className="my-3 text-neutral-700 leading-relaxed text-base sm:text-lg">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col font-sans selection:bg-[#0D1B8C] selection:text-white">
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
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200">
        {/* Top Royal Blue Brand Accent Line */}
        <div
          style={{ backgroundColor: brandSettings.accentColor }}
          className="h-1.5 w-full"
        />

        {/* Top Utility Strip */}
        <div className="border-b border-neutral-100 bg-neutral-50/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-full border border-neutral-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => switchLang('id')}
                  style={lang === 'id' ? { backgroundColor: brandSettings.accentColor, color: '#ffffff' } : {}}
                  className="px-2.5 py-1 text-[11px] font-bold cursor-pointer text-neutral-600"
                >
                  ID
                </button>
                <button
                  type="button"
                  onClick={() => switchLang('en')}
                  style={lang === 'en' ? { backgroundColor: brandSettings.accentColor, color: '#ffffff' } : {}}
                  className="px-2.5 py-1 text-[11px] font-bold cursor-pointer text-neutral-600"
                >
                  EN
                </button>
              </div>
              <span className="hidden sm:inline text-neutral-300">|</span>
              <span className="hidden sm:inline truncate max-w-xs">{brandSettings.tagline}</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={`https://instagram.com/${brandSettings.instagram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: brandSettings.accentColor }}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity font-bold"
              >
                <InstagramIcon className="w-3.5 h-3.5" />
                <span>@{brandSettings.instagram.replace('@', '')}</span>
              </a>
              <span className="text-neutral-300">|</span>
              <a
                href="https://www.threads.net/@meramudotco"
                target="_blank"
                rel="noreferrer"
                style={{ color: brandSettings.accentColor }}
                className="hidden sm:flex items-center gap-1.5 hover:opacity-80 transition-opacity font-bold"
              >
                <AtSign className="w-3.5 h-3.5" />
                <span>@meramudotco</span>
              </a>
              <span className="text-neutral-300">|</span>
              <span className="flex items-center gap-1 text-neutral-700 font-semibold">
                <Globe className="w-3.5 h-3.5" />
                {brandSettings.domain}
              </span>
              <span className="text-neutral-300">|</span>
              {activeView === 'admin' ? (
                <a
                  href="/"
                  className="font-semibold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  {t.viewSite}
                </a>
              ) : (
                <a
                  href="/dapur-redaksi"
                  className="font-semibold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  {t.newsroom}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Main Brand & Action Navbar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          {/* Official Brand Logo / Wordmark */}
          <a
            href="/"
            className="flex items-center gap-3 text-left group focus:outline-none cursor-pointer"
          >
            <MeramuLogo brandSettings={brandSettings} size="md" />
          </a>

          {/* Search & Admin Switcher */}
          <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
            {activeView !== 'admin' && (
              <form action="/cari" method="get" className="relative w-40 sm:w-64">
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
                  className="w-full pl-9 pr-7 py-1.5 bg-neutral-100 hover:bg-neutral-200/60 focus:bg-white text-sm rounded-full border border-transparent focus:border-[#0D1B8C] focus:outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>
            )}

          </div>
        </div>

        {/* Category Navigation Bar (Only on Reader Views) */}
        {activeView !== 'admin' && (
          <div className="border-t border-neutral-100 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2.5">
              {CATEGORIES.map((category) => {
                const isActive = selectedCategory === category && activeView === 'home';
                return (
                  <a
                    key={category}
                    href={categoryHref(category)}
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
                        : 'text-neutral-600 hover:text-[#0D1B8C] hover:bg-blue-50/60'
                    }`}
                  >
                    {catLabel(category)}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* ========================================== */}
      {/* MAIN CONTENT AREA                          */}
      {/* ========================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-neutral-400">
            <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">{t.loading}</p>
          </div>
        ) : activeView === 'home' ? (
          /* ========================================== */
          /* VIEW 1: PUBLIC READER HOME                 */
          /* ========================================== */
          <div className="space-y-12">
            {/* Search / Category Filter Status Banner */}
            {(selectedCategory !== 'Semua' || searchQuery.trim() !== '') && (
              <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-neutral-500">{t.showing}</span>
                  <span className="font-bold text-neutral-900">{catLabel(selectedCategory)}</span>
                  {searchQuery && (
                    <span className="text-neutral-600">
                      {t.forKeyword} <strong>"{searchQuery}"</strong>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedCategory('Semua');
                    setSearchQuery('');
                  }}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 underline"
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
                  href={`/berita/${featuredArticle.id}`}
                  className="lg:col-span-8 block group cursor-pointer bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs hover:shadow-md transition-all"
                >
                  <div className="relative aspect-16/9 w-full overflow-hidden bg-neutral-100">
                    <img
                      src={featuredArticle.imageUrl}
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
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/95 text-neutral-900 backdrop-blur-xs shadow-sm">
                        {featuredArticle.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 sm:p-8">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight leading-tight group-hover:underline decoration-2 underline-offset-4">
                      {featuredArticle.title}
                    </h1>
                    <p className="mt-3 text-neutral-600 text-base sm:text-lg leading-relaxed line-clamp-3">
                      {featuredArticle.excerpt}
                    </p>
                    <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-800">{featuredArticle.author}</span>
                        <span>•</span>
                        <span>{formatDate(featuredArticle.createdAt)}</span>
                      </div>
                      <span className="flex items-center gap-1 font-medium text-neutral-600">
                        <Clock className="w-3.5 h-3.5" />
                        {readTimeLabel(featuredArticle.readTime)}
                      </span>
                    </div>
                  </div>
                </a>

                {/* Pilihan Redaksi / Trending Sidebar (4 cols) */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-2xs">
                  <div className="flex items-center gap-2 pb-4 mb-5 border-b border-neutral-100">
                    <TrendingUp
                      style={{ color: brandSettings.accentColor }}
                      className="w-5 h-5"
                    />
                    <h2 className="text-base font-extrabold uppercase tracking-wider text-neutral-900">
                      {t.editorsPicks}
                    </h2>
                  </div>

                  <div className="divide-y divide-neutral-100">
                    {trendingArticles.map((item, idx) => (
                      <a
                        key={item.id}
                        href={`/berita/${item.id}`}
                        className="py-4 first:pt-0 last:pb-0 group cursor-pointer flex gap-4 items-start"
                      >
                        <span className="text-2xl font-black text-neutral-200 group-hover:text-neutral-900 transition-colors leading-none select-none">
                          0{idx + 1}
                        </span>
                        <div className="space-y-1.5 flex-1">
                          <span
                            style={{ color: brandSettings.accentColor }}
                            className="text-[11px] font-bold uppercase tracking-wider block"
                          >
                            {item.category}
                          </span>
                          <h3 className="text-sm font-bold text-neutral-900 leading-snug group-hover:underline">
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
                            src={item.imageUrl}
                            alt={item.title}
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
                  <div className="mt-6 pt-5 border-t border-neutral-100">
                    <a
                      href={`https://instagram.com/${brandSettings.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ backgroundColor: `${brandSettings.accentColor}08` }}
                      className="flex items-center justify-between p-3.5 rounded-xl hover:opacity-90 border border-neutral-200/80 transition-all group"
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
                          <span className="text-[11px] text-neutral-500 block">
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
              </section>
            )}

            {/* LATEST NEWS GRID SECTION */}
            <section>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-neutral-200">
                <div className="flex items-center gap-2.5">
                  <span
                    style={{ backgroundColor: brandSettings.accentColor }}
                    className="w-2.5 h-2.5 rounded-full"
                  />
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-neutral-900">
                    {selectedCategory === 'Semua' ? t.latest : `${t.section} ${catLabel(selectedCategory)}`}
                  </h2>
                </div>
                <span className="text-xs text-neutral-500 font-medium">
                  {filteredArticles.length} {t.articlesAvailable}
                </span>
              </div>

              {gridArticles.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center">
                  <p className="text-neutral-500 font-medium">
                    {t.noResults}
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCategory('Semua');
                      setSearchQuery('');
                    }}
                    className="mt-4 px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold"
                  >
                    {t.showAllNews}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gridArticles.map((article) => (
                    <a
                      key={article.id}
                      href={`/berita/${article.id}`}
                      className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs hover:shadow-md transition-all group cursor-pointer flex flex-col"
                    >
                      <div className="relative aspect-16/10 w-full bg-neutral-100 overflow-hidden">
                        <img
                          src={article.imageUrl}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/95 text-neutral-900 shadow-xs">
                          {article.category}
                        </span>
                      </div>
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900 leading-snug group-hover:underline decoration-1 underline-offset-4">
                            {article.title}
                          </h3>
                          <p className="mt-2 text-sm text-neutral-600 line-clamp-2 leading-relaxed">
                            {article.excerpt}
                          </p>
                        </div>
                        <div className="mt-5 pt-3.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400">
                          <span className="font-medium text-neutral-700">{article.author}</span>
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
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900 mb-6 group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Kembali ke Beranda</span>
            </button>

            <article className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden p-6 sm:p-10 lg:p-12">
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
                <span className="text-xs font-medium text-neutral-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {currentArticle.readTime}
                </span>
              </div>

              {/* Main Title */}
              <h1 className="text-2xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight leading-tight">
                {currentArticle.title}
              </h1>

              {/* Excerpt / Lead */}
              <p className="mt-4 text-base sm:text-xl text-neutral-600 leading-relaxed font-normal">
                {currentArticle.excerpt}
              </p>

              {/* Author & Share Bar */}
              <div className="mt-6 pt-6 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: brandSettings.accentColor }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  >
                    {currentArticle.author?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-neutral-900 block">
                      {currentArticle.author}
                    </span>
                    <span className="text-xs text-neutral-500 block">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Featured Image */}
              {currentArticle.imageUrl && (
                <figure className="my-8">
                  <div className="rounded-2xl overflow-hidden bg-neutral-100 aspect-16/9">
                    <img
                      src={currentArticle.imageUrl}
                      alt={currentArticle.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {currentArticle.imageCaption && (
                    <figcaption className="mt-2.5 text-xs text-neutral-500 text-center italic">
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
              <div className="mt-10 pt-6 border-t border-neutral-100 flex items-center justify-between">
                <div className="text-xs text-neutral-400">
                  © {new Date().getFullYear()} {brandSettings.siteName} ({brandSettings.domain})
                </div>
                {isAdmin && (
                <button
                  onClick={() => {
                    startEditArticle(currentArticle);
                    setActiveView('admin');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 cursor-pointer"
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
                <h3 className="text-lg font-extrabold text-neutral-900 mb-4">
                  Berita Terkait di {currentArticle.category}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {relatedArticles.map((rel) => (
                    <div
                      key={rel.id}
                      onClick={() => openArticle(rel.id)}
                      className="bg-white p-4 rounded-2xl border border-neutral-200/80 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="aspect-16/10 rounded-xl overflow-hidden bg-neutral-100 mb-3">
                        <img
                          src={rel.imageUrl}
                          alt={rel.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900 group-hover:underline line-clamp-2">
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
          /* VIEW 3: DAPUR REDAKSI (ADMIN CMS) */
          /* ========================================== */
          !isAdmin ? (
            <div className="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span
                  style={{ backgroundColor: brandSettings.accentColor }}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-white"
                >
                  Dapur Redaksi
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900">
                Login Admin {brandSettings.siteName}
              </h1>
              <p className="text-sm text-neutral-500 mt-1 mb-6">
                Masuk dengan akun admin untuk mengelola berita. Pembaca tidak perlu login.
              </p>
              {!FIREBASE_READY && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                  Mode demo: Firebase belum terhubung, jadi login admin belum bisa dipakai.
                  Hubungkan Firebase production dulu, baru akun admin bisa dibuat.
                </p>
              )}
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Email admin</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    placeholder="admin@meramu.site"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    placeholder="••••••••"
                  />
                </div>
                {adminError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {adminError}
                  </p>
                )}
                <button
                  type="submit"
                  style={{ backgroundColor: brandSettings.accentColor }}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                >
                  Masuk ke Dapur Redaksi
                </button>
                <button
                  type="button"
                  onClick={() => navigateToHome()}
                  className="w-full py-2.5 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-bold text-sm hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  Kembali ke Beranda
                </button>
              </form>
            </div>
          ) : (
          <div className="space-y-6">
            {/* Admin Header Banner */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    style={{ backgroundColor: brandSettings.accentColor }}
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-white"
                  >
                    CMS Cloud Aktif
                  </span>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900">
                    Dapur Redaksi {brandSettings.siteName}
                  </h1>
                </div>
                <p className="text-sm text-neutral-500 mt-1">
                  Kelola artikel berita, pilih headline utama, dan sesuaikan warna identitas serta logo @meramudotco.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={startCreateNewArticle}
                  style={{ backgroundColor: brandSettings.accentColor }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tulis Berita Baru</span>
                </button>
                <button
                  onClick={handleAdminLogout}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-neutral-200 text-neutral-700 text-xs sm:text-sm font-bold hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  <span>Keluar</span>
                </button>
              </div>
            </div>

            {/* Admin Sub-Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
              <button
                onClick={() => setAdminTab('articles')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  adminTab === 'articles'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Daftar Berita ({articles.length})</span>
              </button>

              <button
                onClick={() => {
                  if (adminTab !== 'editor') startCreateNewArticle();
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  adminTab === 'editor'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
                }`}
              >
                <SquarePen className="w-4 h-4" />
                <span>{editingArticle ? 'Edit Artikel' : 'Editor Berita'}</span>
              </button>

              <button
                onClick={() => setAdminTab('brand')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  adminTab === 'brand'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Identitas & Logo Brand</span>
              </button>
            </div>

            {/* TAB 1: MANAGE ARTICLES LIST */}
            {adminTab === 'articles' && (
              <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/70 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                        <th className="py-3.5 px-5">Artikel</th>
                        <th className="py-3.5 px-4">Kategori</th>
                        <th className="py-3.5 px-4">Status Headline</th>
                        <th className="py-3.5 px-4">Tanggal</th>
                        <th className="py-3.5 px-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-sm">
                      {articles.map((article) => (
                        <tr key={article.id} className="hover:bg-neutral-50/60 transition-colors">
                          <td className="py-4 px-5 max-w-md">
                            <div className="flex items-center gap-3.5">
                              <img
                                src={article.imageUrl}
                                alt={article.title}
                                className="w-14 h-10 rounded-lg object-cover bg-neutral-100 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-neutral-900 line-clamp-1">
                                  {article.title}
                                </div>
                                <div className="text-xs text-neutral-500 mt-0.5">
                                  Oleh {article.author} • {article.readTime}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800">
                              {article.category}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => handleToggleFeatured(article)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                                article.isFeatured
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                              }`}
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  article.isFeatured ? 'fill-amber-500 text-amber-500' : ''
                                }`}
                              />
                              <span>{article.isFeatured ? 'Headline Utama' : 'Jadikan Headline'}</span>
                            </button>
                          </td>
                          <td className="py-4 px-4 text-xs text-neutral-500 whitespace-nowrap">
                            {formatDate(article.createdAt)}
                          </td>
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => openArticle(article.id)}
                                title="Lihat Artikel"
                                className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => startEditArticle(article)}
                                title="Edit Artikel"
                                className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 cursor-pointer"
                              >
                                <PenLine className="w-4 h-4" />
                              </button>
                              {deleteConfirmId === article.id ? (
                                <div className="inline-flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                                  <button
                                    onClick={() => handleDeleteArticle(article.id)}
                                    className="text-xs font-bold text-rose-600 hover:underline px-1 cursor-pointer"
                                  >
                                    Hapus!
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="text-xs text-neutral-500 px-1 cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(article.id)}
                                  title="Hapus Artikel"
                                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: CREATE / EDIT ARTICLE FORM */}
            {adminTab === 'editor' && (
              <form
                onSubmit={handleSaveArticle}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
              >
                {/* Left Column: Main Content Editor (8 cols) */}
                <div className="lg:col-span-8 bg-white rounded-2xl border border-neutral-200/80 p-6 space-y-5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                    <h2 className="text-lg font-extrabold text-neutral-900">
                      {editingArticle ? 'Edit Artikel Berita' : 'Tulis Artikel Baru'}
                    </h2>
                    <span className="text-xs text-neutral-400">
                      Gunakan baris kosong (Enter 2x) untuk paragraf baru
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                      Judul Berita Utama *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Contoh: Geliat Skena Musik & Komedi Independen di Tahun Ini..."
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-base font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                      Ringkasan / Subtitle (Excerpt) *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={formData.excerpt}
                      onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                      placeholder="Ringkasan singkat 1-2 kalimat yang menarik pembaca untuk klik..."
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                        Isi Lengkap Berita *
                      </label>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                        <span>Tips: Awal dengan <strong>## Subjudul</strong> atau <strong>&gt; Kutipan</strong></span>
                      </div>
                    </div>
                    <textarea
                      rows={14}
                      required
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Tulis isi berita di sini... Pisahkan antar paragraf dengan menekan Enter dua kali."
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-sm leading-relaxed font-sans"
                    />
                  </div>
                </div>

                {/* Right Column: Metadata & Publishing Settings (4 cols) */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-neutral-200/80 p-6 space-y-5 shadow-2xs">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-900 border-b border-neutral-100 pb-3">
                    Pengaturan Publikasi
                  </h3>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                      Kategori / Rubrik
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-sm font-semibold bg-white"
                    >
                      {CATEGORIES.filter((c) => c !== 'Semua').map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                      Nama Penulis / Redaksi
                    </label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      placeholder="Redaksi Meramu"
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-sm"
                    />
                  </div>

                  {/* Image URL & Quick Presets */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                      URL Foto Thumbnail
                    </label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-xs"
                    />
                    <div className="mt-2">
                      <span className="text-[11px] text-neutral-400 block mb-1.5">
                        Atau pilih cepat foto ilustrasi:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {UNSPLASH_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setFormData({ ...formData, imageUrl: preset.url })}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formData.imageUrl && (
                      <div className="mt-3 rounded-xl overflow-hidden aspect-16/9 bg-neutral-100 border border-neutral-200">
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                      Caption Foto (Opsional)
                    </label>
                    <input
                      type="text"
                      value={formData.imageCaption}
                      onChange={(e) => setFormData({ ...formData, imageCaption: e.target.value })}
                      placeholder="Keterangan singkat di bawah foto..."
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-xs"
                    />
                  </div>

                  {/* Checkboxes for Headline & Pilihan Redaksi */}
                  <div className="space-y-2.5 pt-2 border-t border-neutral-100">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isFeatured}
                        onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                        className="w-4 h-4 rounded text-neutral-900 focus:ring-0"
                      />
                      <span className="text-xs font-bold text-neutral-800">
                        Jadikan Headline Utama (Hero Banner)
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isTrending}
                        onChange={(e) => setFormData({ ...formData, isTrending: e.target.checked })}
                        className="w-4 h-4 rounded text-neutral-900 focus:ring-0"
                      />
                      <span className="text-xs font-semibold text-neutral-700">
                        Masukkan ke Daftar "Pilihan Redaksi"
                      </span>
                    </label>
                  </div>

                  {/* Submit & Cancel Buttons */}
                  <div className="pt-4 flex flex-col gap-2">
                    <button
                      type="submit"
                      style={{ backgroundColor: brandSettings.accentColor }}
                      className="w-full py-3 rounded-xl text-white font-bold text-sm shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                    >
                      {editingArticle ? 'Simpan Perubahan Berita' : 'Terbitkan Berita Sekarang'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminTab('articles')}
                      className="w-full py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 3: BRAND IDENTITY & LOGO CUSTOMIZER */}
            {adminTab === 'brand' && (
              <form
                onSubmit={handleSaveBrandSettings}
                className="max-w-2xl bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 space-y-6 shadow-2xs"
              >
                <div>
                  <h2 className="text-lg font-extrabold text-neutral-900">
                    Pengaturan Identitas Visual & Logo (@meramudotco)
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    Logo dan warna otomatis menggunakan Meramu Royal Blue (#0D1B8C) sesuai identitas resmi kamu.
                  </p>
                </div>

                {/* Live Logo Preview Box */}
                <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                      Preview Logo Aktif
                    </span>
                    <MeramuLogo brandSettings={brandSettings} size="md" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBrandSettings({ ...brandSettings, logoStyle: 'badge' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        brandSettings.logoStyle !== 'minimal'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-600 border-neutral-200'
                      }`}
                    >
                      Box Biru Resmi
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrandSettings({ ...brandSettings, logoStyle: 'minimal' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        brandSettings.logoStyle === 'minimal'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-600 border-neutral-200'
                      }`}
                    >
                      Teks Minimalis
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                      Nama Brand / Header
                    </label>
                    <input
                      type="text"
                      value={brandSettings.siteName}
                      onChange={(e) =>
                        setBrandSettings({ ...brandSettings, siteName: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                      Username Instagram (Tanpa @)
                    </label>
                    <input
                      type="text"
                      value={brandSettings.instagram}
                      onChange={(e) =>
                        setBrandSettings({ ...brandSettings, instagram: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                    Tagline Media
                  </label>
                  <input
                    type="text"
                    value={brandSettings.tagline}
                    onChange={(e) =>
                      setBrandSettings({ ...brandSettings, tagline: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm"
                  />
                </div>

                {/* Custom Logo URL Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                    URL File Gambar Logo Kustom (Opsional)
                  </label>
                  <input
                    type="url"
                    value={brandSettings.logoUrl}
                    onChange={(e) =>
                      setBrandSettings({ ...brandSettings, logoUrl: e.target.value })
                    }
                    placeholder="Kosongkan untuk memakai Logo Box Biru Resmi MERAMU.CO di atas"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm"
                  />
                </div>

                {/* Brand Accent Color Picker */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2.5">
                    Warna Identitas Utama (Brand Color)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setBrandSettings({ ...brandSettings, accentColor: c.hex })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          brandSettings.accentColor === c.hex
                            ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <span
                          style={{ backgroundColor: c.hex }}
                          className="w-4 h-4 rounded-full border border-white/20"
                        />
                        <span>{c.name}</span>
                      </button>
                    ))}

                    <div className="flex items-center gap-2 ml-2">
                      <input
                        type="color"
                        value={brandSettings.accentColor}
                        onChange={(e) =>
                          setBrandSettings({ ...brandSettings, accentColor: e.target.value })
                        }
                        className="w-9 h-9 rounded-lg cursor-pointer border border-neutral-200"
                      />
                      <span className="text-xs font-mono text-neutral-500">
                        {brandSettings.accentColor}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100">
                  <button
                    type="submit"
                    style={{ backgroundColor: brandSettings.accentColor }}
                    className="px-6 py-3 rounded-xl text-white font-bold text-sm shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    Simpan Identitas Brand
                  </button>
                </div>
              </form>
            )}
          </div>
          )
        )}
      </main>

      {/* ========================================== */}
      {/* EDITORIAL FOOTER                           */}
      {/* ========================================== */}
      <footer className="bg-white border-t border-neutral-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <MeramuLogo brandSettings={brandSettings} size="sm" />
            <p className="text-xs text-neutral-500 mt-3 max-w-sm">
              {brandSettings.tagline} Hadir secara resmi di <strong>{brandSettings.domain}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-neutral-600">
            {CATEGORIES.slice(1).map((cat) => (
              <button
                key={cat}
                onClick={() => goHome(cat)}
                className="hover:text-[#0D1B8C] transition-colors cursor-pointer"
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="text-xs text-neutral-400">
            © {new Date().getFullYear()} {brandSettings.siteName}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}