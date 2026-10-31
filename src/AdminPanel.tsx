// Dapur Redaksi (admin CMS) — lazy chunk, Oct 2026.
// This file is the ONLY place that imports firebase/auth: it loads only when
// the admin view renders, so public pages never fetch auth code or the auth
// iframe. It also owns every Firestore write (article create/update/delete,
// featured toggles, brand settings); the public bundle only reads.
// Moved verbatim from src/App.tsx (state, handlers, VIEW 3 JSX) except:
// - no anonymous sign-in: the old App-level effect signed every visitor in
//   anonymously just to gate the Firestore subscription. Public reads need
//   no auth (rules allow public reads; serverless pages already read
//   unauthenticated via REST), and the admin signs in with email/password.
// - logout reports onAuthChange(false) explicitly before navigating home,
//   because navigating unmounts this panel and its auth listener with it.
// - the reader quick-edit button hands its article via pendingEditArticle;
//   this panel consumes it with startEditArticle, exactly as before.
import React, { useState, useEffect } from 'react';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import {
  Plus,
  Layers,
  SquarePen,
  Palette,
  Star,
  Eye,
  PenLine,
  Trash
} from 'lucide-react';

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

export default function AdminPanel(props) {
  const {
    articles,
    brandSettings,
    setBrandSettings,
    FIREBASE_READY,
    db,
    appId,
    navigateToHome,
    showToast,
    openArticle,
    formatDate,
    categories: CATEGORIES,
    MeramuLogo,
    pendingEditArticle,
    onPendingEditConsumed,
    onAuthChange,
  } = props;

  const auth = FIREBASE_READY ? getAuth() : null;
  const [user, setUser] = useState(null);

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
    secondaryCategory: '',
    author: 'Redaksi Meramu',
    readTime: '4 Menit Baca',
    imageUrl: '',
    imageCaption: '',
    isFeatured: false,
    isTrending: false,
    isViral: false,
    content: ''
  });


  // Admin auth session: subscribe only while this panel is mounted.
  useEffect(() => {
    if (!auth) return undefined;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      onAuthChange(Boolean(currentUser && !currentUser.isAnonymous));
    });
    return () => unsubscribe();
  }, [auth]);

  // Reader quick-edit handoff: the reader button sets pendingEditArticle
  // and switches to the admin view; consume it here with startEditArticle.
  useEffect(() => {
    if (pendingEditArticle) {
      startEditArticle(pendingEditArticle);
      onPendingEditConsumed();
    }
  }, [pendingEditArticle]);

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
      onAuthChange(false);
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
      secondaryCategory: '',
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
      secondaryCategory: article.secondaryCategory || '',
      author: article.author || 'Redaksi Meramu',
      readTime: article.readTime || '4 Menit Baca',
      imageUrl: article.imageUrl || '',
      imageCaption: article.imageCaption || '',
      isFeatured: Boolean(article.isFeatured),
      isTrending: Boolean(article.isTrending),
      isViral: Boolean(article.isViral),
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


  return (
          !isAdmin ? (
            <div className="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-sm dark:bg-neutral-900 dark:border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span
                  style={{ backgroundColor: brandSettings.accentColor }}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-white"
                >
                  Dapur Redaksi
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
                Login Admin {brandSettings.siteName}
              </h1>
              <p className="text-sm text-neutral-500 mt-1 mb-6 dark:text-neutral-400">
                Masuk dengan akun admin untuk mengelola berita. Pembaca tidak perlu login.
              </p>
              {!FIREBASE_READY && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 dark:text-amber-300 dark:bg-amber-950 dark:border-amber-800">
                  Mode demo: Firebase belum terhubung, jadi login admin belum bisa dipakai.
                  Hubungkan Firebase production dulu, baru akun admin bisa dibuat.
                </p>
              )}
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1 dark:text-neutral-300">Email admin</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-white/10"
                    placeholder="admin@meramu.site"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1 dark:text-neutral-300">Password</label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-white/10"
                    placeholder="••••••••"
                  />
                </div>
                {adminError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 dark:text-red-400 dark:bg-red-950 dark:border-red-800">
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
                  className="w-full py-2.5 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-bold text-sm hover:bg-neutral-50 transition-colors cursor-pointer dark:bg-neutral-900 dark:border-white/10 dark:text-neutral-300"
                >
                  Kembali ke Beranda
                </button>
              </form>
            </div>
          ) : (
          <div className="space-y-6">
            {/* Admin Header Banner */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs dark:bg-neutral-900 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    style={{ backgroundColor: brandSettings.accentColor }}
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-white"
                  >
                    CMS Cloud Aktif
                  </span>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
                    Dapur Redaksi {brandSettings.siteName}
                  </h1>
                </div>
                <p className="text-sm text-neutral-500 mt-1 dark:text-neutral-400">
                  Kelola artikel berita, pilih headline utama, dan sesuaikan warna identitas serta logo @meramufeed.
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-neutral-200 text-neutral-700 text-xs sm:text-sm font-bold hover:bg-neutral-50 transition-colors cursor-pointer dark:bg-neutral-900 dark:border-white/10 dark:text-neutral-300"
                >
                  <span>Keluar</span>
                </button>
              </div>
            </div>

            {/* Admin Sub-Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 dark:border-white/10">
              <button
                onClick={() => setAdminTab('articles')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  adminTab === 'articles'
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:border-white/10'
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
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:border-white/10'
                }`}
              >
                <SquarePen className="w-4 h-4" />
                <span>{editingArticle ? 'Edit Artikel' : 'Editor Berita'}</span>
              </button>

              <button
                onClick={() => setAdminTab('brand')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  adminTab === 'brand'
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:border-white/10'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Identitas & Logo Brand</span>
              </button>
            </div>

            {/* TAB 1: MANAGE ARTICLES LIST */}
            {adminTab === 'articles' && (
              <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs dark:bg-neutral-900 dark:border-white/10">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/70 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-400">
                        <th className="py-3.5 px-5">Artikel</th>
                        <th className="py-3.5 px-4">Kategori</th>
                        <th className="py-3.5 px-4">Status Headline</th>
                        <th className="py-3.5 px-4">Tanggal</th>
                        <th className="py-3.5 px-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-white/10 text-sm">
                      {articles.map((article) => (
                        <tr key={article.id} className="hover:bg-neutral-50/60 dark:hover:bg-white/5 transition-colors">
                          <td className="py-4 px-5 max-w-md">
                            <div className="flex items-center gap-3.5">
                              <img
                                src={article.imageUrl}
                                alt={article.title}
                                className="w-14 h-10 rounded-lg object-cover bg-neutral-100 shrink-0 dark:bg-neutral-800"
                              />
                              <div>
                                <div className="font-bold text-neutral-900 line-clamp-1 dark:text-neutral-100">
                                  {article.title}
                                </div>
                                <div className="text-xs text-neutral-500 mt-0.5 dark:text-neutral-400">
                                  Oleh {article.author} • {article.readTime}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
                              {article.category}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => handleToggleFeatured(article)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                                article.isFeatured
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700'
                                  : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
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
                          <td className="py-4 px-4 text-xs text-neutral-500 whitespace-nowrap dark:text-neutral-400">
                            {formatDate(article.createdAt)}
                          </td>
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => openArticle(article.id)}
                                title="Lihat Artikel"
                                className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer dark:text-neutral-400 dark:hover:bg-neutral-800"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => startEditArticle(article)}
                                title="Edit Artikel"
                                className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 cursor-pointer dark:text-blue-400 dark:hover:bg-blue-950"
                              >
                                <PenLine className="w-4 h-4" />
                              </button>
                              {deleteConfirmId === article.id ? (
                                <div className="inline-flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 dark:bg-rose-950 dark:border-rose-800">
                                  <button
                                    onClick={() => handleDeleteArticle(article.id)}
                                    className="text-xs font-bold text-rose-600 hover:underline px-1 cursor-pointer dark:text-rose-400"
                                  >
                                    Hapus!
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="text-xs text-neutral-500 px-1 cursor-pointer dark:text-neutral-400"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(article.id)}
                                  title="Hapus Artikel"
                                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer dark:text-rose-400 dark:hover:bg-rose-950"
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
                <div className="lg:col-span-8 bg-white rounded-2xl border border-neutral-200/80 p-6 space-y-5 shadow-2xs dark:bg-neutral-900 dark:border-white/10">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-white/10">
                    <h2 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">
                      {editingArticle ? 'Edit Artikel Berita' : 'Tulis Artikel Baru'}
                    </h2>
                    <span className="text-xs text-neutral-400">
                      Gunakan baris kosong (Enter 2x) untuk paragraf baru
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                      Judul Berita Utama *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Contoh: Geliat Skena Musik Independen di Tahun Ini..."
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-base font-bold dark:border-white/10 dark:focus:border-neutral-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                      Ringkasan / Subtitle (Excerpt) *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={formData.excerpt}
                      onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                      placeholder="Ringkasan singkat 1-2 kalimat yang menarik pembaca untuk klik..."
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-sm dark:border-white/10 dark:focus:border-neutral-100"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Isi Lengkap Berita *
                      </label>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span>Tips: Awal dengan <strong>## Subjudul</strong> atau <strong>&gt; Kutipan</strong></span>
                      </div>
                    </div>
                    <textarea
                      rows={14}
                      required
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Tulis isi berita di sini... Pisahkan antar paragraf dengan menekan Enter dua kali."
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-sm leading-relaxed font-sans dark:border-white/10 dark:focus:border-neutral-100"
                    />
                  </div>
                </div>

                {/* Right Column: Metadata & Publishing Settings (4 cols) */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-neutral-200/80 p-6 space-y-5 shadow-2xs dark:bg-neutral-900 dark:border-white/10">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-900 border-b border-neutral-100 pb-3 dark:text-neutral-100 dark:border-white/10">
                    Pengaturan Publikasi
                  </h3>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                      Kategori / Rubrik
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-sm font-semibold bg-white dark:border-white/10 dark:focus:border-neutral-100 dark:bg-neutral-900"
                    >
                      {CATEGORIES.filter((c) => c !== 'Semua').map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                      Kategori kedua (opsional)
                    </label>
                    <select
                      value={formData.secondaryCategory}
                      onChange={(e) => setFormData({ ...formData, secondaryCategory: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-sm font-semibold bg-white dark:border-white/10 dark:focus:border-neutral-100 dark:bg-neutral-900"
                    >
                      <option value="">— Tidak ada —</option>
                      {CATEGORIES.filter((c) => c !== 'Semua').map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                      Nama Penulis / Redaksi
                    </label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      placeholder="Redaksi Meramu"
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-sm dark:border-white/10 dark:focus:border-neutral-100"
                    />
                  </div>

                  {/* Image URL & Quick Presets */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                      URL Foto Thumbnail
                    </label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-xs dark:border-white/10 dark:focus:border-neutral-100"
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
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 cursor-pointer dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formData.imageUrl && (
                      <div className="mt-3 rounded-xl overflow-hidden aspect-16/9 bg-neutral-100 border border-neutral-200 dark:bg-neutral-800 dark:border-white/10">
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                      Caption Foto (Opsional)
                    </label>
                    <input
                      type="text"
                      value={formData.imageCaption}
                      onChange={(e) => setFormData({ ...formData, imageCaption: e.target.value })}
                      placeholder="Keterangan singkat di bawah foto..."
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-none text-xs dark:border-white/10 dark:focus:border-neutral-100"
                    />
                  </div>

                  {/* Checkboxes for Headline & Pilihan Redaksi */}
                  <div className="space-y-2.5 pt-2 border-t border-neutral-100 dark:border-white/10">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isFeatured}
                        onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                        className="w-4 h-4 rounded text-neutral-900 focus:ring-0 dark:text-neutral-100"
                      />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-100">
                        Jadikan Headline Utama (Hero Banner)
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isTrending}
                        onChange={(e) => setFormData({ ...formData, isTrending: e.target.checked })}
                        className="w-4 h-4 rounded text-neutral-900 focus:ring-0 dark:text-neutral-100"
                      />
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Masukkan ke Daftar "Pilihan Redaksi"
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isViral}
                        onChange={(e) => setFormData({ ...formData, isViral: e.target.checked })}
                        className="w-4 h-4 rounded text-neutral-900 focus:ring-0 dark:text-neutral-100"
                      />
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Tandai "Lagi Viral" (maks 5, tampil di atas Pilihan Redaksi)
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
                      className="w-full py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs cursor-pointer dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300"
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
                className="max-w-2xl bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 space-y-6 shadow-2xs dark:bg-neutral-900 dark:border-white/10"
              >
                <div>
                  <h2 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">
                    Pengaturan Identitas Visual & Logo (@meramufeed)
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1 dark:text-neutral-400">
                    Logo dan warna otomatis menggunakan Meramu Royal Blue (#0D1B8C) sesuai identitas resmi kamu.
                  </p>
                </div>

                {/* Live Logo Preview Box */}
                <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:bg-neutral-900 dark:border-white/10">
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
                          ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100'
                          : 'bg-white text-neutral-600 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-white/10'
                      }`}
                    >
                      Box Biru Resmi
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrandSettings({ ...brandSettings, logoStyle: 'minimal' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        brandSettings.logoStyle === 'minimal'
                          ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100'
                          : 'bg-white text-neutral-600 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-white/10'
                      }`}
                    >
                      Teks Minimalis
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                      Nama Brand / Header
                    </label>
                    <input
                      type="text"
                      value={brandSettings.siteName}
                      onChange={(e) =>
                        setBrandSettings({ ...brandSettings, siteName: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold dark:border-white/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                      Username Instagram (Tanpa @)
                    </label>
                    <input
                      type="text"
                      value={brandSettings.instagram}
                      onChange={(e) =>
                        setBrandSettings({ ...brandSettings, instagram: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm dark:border-white/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                    Tagline Media
                  </label>
                  <input
                    type="text"
                    value={brandSettings.tagline}
                    onChange={(e) =>
                      setBrandSettings({ ...brandSettings, tagline: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm dark:border-white/10"
                  />
                </div>

                {/* Custom Logo URL Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 dark:text-neutral-300">
                    URL File Gambar Logo Kustom (Opsional)
                  </label>
                  <input
                    type="url"
                    value={brandSettings.logoUrl}
                    onChange={(e) =>
                      setBrandSettings({ ...brandSettings, logoUrl: e.target.value })
                    }
                    placeholder="Kosongkan untuk memakai Logo Box Biru Resmi MERAMU di atas"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm dark:border-white/10"
                  />
                </div>

                {/* Brand Accent Color Picker */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2.5 dark:text-neutral-300">
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
                            ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
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
                        className="w-9 h-9 rounded-lg cursor-pointer border border-neutral-200 dark:border-white/10"
                      />
                      <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                        {brandSettings.accentColor}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 dark:border-white/10">
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
  );
}
