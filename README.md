# MERAMU.CO — Portal Berita

Portal berita React + Vite + Tailwind + Firebase (Firestore + Auth).
File `src/App.tsx` berasal dari `portal_berita_meramu_co.tsx`, dengan perbaikan:

1. **Config Firebase dari env var** (`VITE_FIREBASE_*`), bukan variabel editor.
   Tanpa config, situs jalan dalam **mode demo**: artikel contoh lokal tampil,
   tanpa login dan tanpa tulis ke Firestore.
2. **Perbaikan loading tanpa akhir**: tanpa Firebase, halaman sempat stuck di
   loading selamanya. Sekarang langsung tampil artikel contoh.
3. **Dapur Redaksi digembok**: tadinya tombol admin bisa dibuka siapa saja dan
   (dengan rules longgar) siapa saja bisa hapus/edit berita. Sekarang CMS hanya
   terbuka setelah login admin pakai email + password. Pembaca tetap anonim.

## Menjalankan

```bash
npm install
npm run dev     # lokal
npm run build   # build production ke dist/
```

## Firebase production (langkah 3)

1. Buat proyek Firebase baru, aktifkan Firestore (Production mode) dan
   Authentication dengan provider **Anonymous** (pembaca) dan **Email/Password**
   (admin).
2. Buat satu akun admin di Authentication > Users (email + password).
3. Pasang config proyek ke env var (lokal: file `.env`; Vercel: Project Settings
   > Environment Variables) sesuai `.env.example`.
4. Rules Firestore yang disarankan — baca bebas, tulis hanya admin
   (provider `password`, bukan anonim):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/meramu-site-app/public/data/{doc=**} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.firebase.sign_in_provider == 'password';
    }
  }
}
```

## Deploy ke Vercel

Import repo ini di Vercel, pasang env var di atas, lalu hubungkan domain
`meramu.site` (DNS sudah mengarah ke Vercel).
