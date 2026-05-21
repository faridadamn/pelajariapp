# 📦 Sistem Pendaftaran Kursus — Panduan Lengkap
**Versi 2.0 · White Label · Google Sheets + Apps Script**

---

## Isi Paket (5 File)

| File | Fungsi | Untuk Siapa |
|---|---|---|
| `index.html` | Landing page + form pendaftaran 4 langkah | Calon siswa (publik) |
| `admin.html` | Dashboard verifikasi + editor materi | Admin / pemilik kursus |
| `belajar.html` | Portal materi + kuis interaktif | Siswa terverifikasi |
| `Code.gs` | Backend: database, email, token akses | Server (Apps Script) |
| `PANDUAN.md` | Dokumen ini | Developer / klien |

---

## Fitur Chat Siswa - Admin

Versi ini sudah mendukung chat sederhana antara siswa dan admin.

- Siswa membuka chat dari tombol **Chat Admin** di `belajar.html`
- Admin membalas dari menu **Chat** di `admin.html`
- Pesan disimpan di Google Sheets melalui `Code.gs`
- Sistem memakai polling otomatis, jadi pesan baru dicek berkala saat halaman dibuka
- Dua tab Sheet baru akan dibuat otomatis: **ChatThreads** dan **ChatMessages**

Setelah mengubah `Code.gs`, lakukan deploy ulang Apps Script agar endpoint chat aktif di website.

---

## Alur Sistem Lengkap

```
[Calon Siswa]                    [Google Sheets]              [Admin]
     │                                  │                        │
     ├─ Buka index.html                 │                        │
     ├─ Pilih kursus                    │                        │
     ├─ Isi data diri                   │                        │
     ├─ Upload bukti transfer           │                        │
     └─ Submit ──────────────────────► Baris baru di            │
                                        sheet Pendaftar          │
                                        + file bukti ke Drive    │
                                        + email konfirmasi       │
                                        ke siswa                 │
                                        + notif email ke ────────►
                                          admin                  │
                                                         Buka admin.html
                                                         Klik "Tinjau"
                                                         Lihat bukti
                                                         Klik "Verifikasi"
                                                                  │
                                        ◄── Status → verified ───┤
                                        Token dibuat              │
                                        Ditambah ke sheet Akses   │
                                        Email + token dikirim ────►
                                          ke siswa               │

[Siswa Terverifikasi]
     │
     ├─ Buka belajar.html
     ├─ Login: email + token
     ├─ Akses modul → Video / PDF / Teks
     ├─ Tandai selesai
     ├─ Ambil kuis (min 70% untuk lulus)
     └─ Progress tersimpan ke sheet Akses
```

---

## Setup Step-by-Step

### Langkah 1 — Buat Google Spreadsheet

1. Buka [sheets.google.com](https://sheets.google.com) → buat spreadsheet baru
2. Beri nama: **"Sistem Kursus [Nama Klien]"**
3. Catat **Spreadsheet ID** dari URL browser:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID_DI_SINI]/edit
   ```

---

### Langkah 2 — Setup Google Apps Script

1. Di Spreadsheet → klik **Extensions → Apps Script**
2. Hapus semua kode default
3. Paste seluruh isi `Code.gs`
4. Ganti bagian konfigurasi di paling atas:
   ```javascript
   const SPREADSHEET_ID = 'ID_SPREADSHEET_KAMU';    // ← dari langkah 1
   const ADMIN_EMAIL    = 'email@kamukamu.com';       // ← email penerima notif
   const BRAND_NAME     = 'NamaBrandKlien';           // ← nama klien
   const PORTAL_URL     = 'https://domain.com/belajar.html'; // ← setelah upload
   ```
5. Klik tombol **Save** (ikon disket)
6. Klik **Run → pilih fungsi `setupSpreadsheet`**
7. Izinkan akses Google (klik "Allow" saat diminta)
8. Cek Spreadsheet — 4 tab otomatis terbuat:
   - **Pendaftar** — data registrasi masuk
   - **Kursus** — daftar kursus (sudah ada 4 contoh)
   - **Materi** — konten modul (sudah ada 3 contoh)
   - **Akses** — data login siswa

---

### Langkah 3 — Deploy sebagai Web App

1. Klik **Deploy → New Deployment**
2. Klik ikon gear → pilih **Web App**
3. Isi pengaturan:
   ```
   Description  : Sistem Kursus v2
   Execute as   : Me (pilih akun Gmail kamu)
   Who has access : Anyone
   ```
4. Klik **Deploy**
5. Klik **Authorize access** → login → Allow
6. Salin **Web App URL** yang muncul, contoh:
   ```
   https://script.google.com/macros/s/AKfycbxXXXXXXXXX/exec
   ```

---

### Langkah 4 — Sambungkan HTML ke Script

Buka **ketiga file HTML**, cari `const CONFIG = {...}` dan isi `scriptUrl`:

**index.html:**
```javascript
const CONFIG = {
  brandName : 'NamaBrandKlien',
  email     : 'info@brand.com',
  whatsapp  : '628xxxxxxxxxx',
  scriptUrl : 'https://script.google.com/macros/s/SCRIPT_ID/exec',
  bankAccounts: [
    { bank:'BCA', rek:'1234 5678 90', an:'PT Nama Klien' },
  ]
};
```

**admin.html:**
```javascript
const CFG = {
  adminUser : 'admin',
  adminPass : 'GANTI_PASSWORD_INI',
  scriptUrl : 'https://script.google.com/macros/s/SCRIPT_ID/exec'
};
```

**belajar.html:**
```javascript
const CFG = {
  demoEmail : 'demo@brand.com',   // akun demo (opsional)
  demoToken : 'DEMO2025',
  scriptUrl : 'https://script.google.com/macros/s/SCRIPT_ID/exec'
};
```

---

### Langkah 5 — Upload ke Hosting

Upload 3 file HTML ke hosting klien:

| Platform | Cara Upload |
|---|---|
| **cPanel** | File Manager → `public_html` → Upload |
| **Netlify** | Drag & drop folder ke netlify.com/drop |
| **Vercel** | `vercel --prod` dari terminal |
| **GitHub Pages** | Push ke branch `main` → Settings → Pages |
| **Google Sites** | Embed sebagai iframe (fungsi terbatas) |

> ⚠️ Setelah upload, perbarui `PORTAL_URL` di `Code.gs` lalu **deploy ulang** Apps Script.

---

### Langkah 6 — Isi Data Kursus

Edit tab **Kursus** di Spreadsheet sesuai format:

| Kolom | Contoh | Keterangan |
|---|---|---|
| ID | C001 | Kode unik kursus |
| Emoji | 🎨 | Ikon kursus |
| Theme | thumb-t1 | t1=hijau, t2=kuning, t3=biru, t4=pink |
| Kategori | Design | Label kategori |
| Nama | UI/UX Bootcamp | Nama kursus |
| Deskripsi | Kuasai Figma... | 1-2 kalimat |
| Jumlah Modul | 10 modul | Teks bebas |
| Lama Akses | 3 bulan | Teks bebas |
| Harga | 299000 | Angka saja (tanpa Rp) |
| Harga Asli | 499000 | Harga coret |

---

### Langkah 7 — Isi Materi via Admin Editor

1. Login ke `admin.html` (default: `admin` / `admin123`)
2. Klik menu **Edit Materi** di sidebar
3. Pilih kursus dari dropdown
4. Klik modul yang ingin diedit, atau **+ Modul** untuk tambah baru
5. Isi form:
   - **Judul & Section** — judul modul dan nama bab
   - **URL Video** — format embed YouTube: `https://www.youtube.com/embed/VIDEO_ID`
   - **URL PDF** — Google Drive: share "Anyone with link" → salin URL
   - **Teks Konten** — HTML sederhana diperbolehkan (`<h3>`, `<p>`, `<ul>`, `<strong>`)
   - **Soal Kuis** — tambah soal, 4 pilihan A-D, tentukan jawaban benar, tulis penjelasan
6. Klik **Simpan Materi** → otomatis tersimpan ke Google Sheets

> 💡 Tip URL Video YouTube:
> ```
> URL biasa : https://www.youtube.com/watch?v=ABC123
> URL embed : https://www.youtube.com/embed/ABC123
> ```

---

## Kustomisasi Brand (White Label)

### Ganti Warna

Di setiap file HTML, cari `:root {` dan ubah variabel CSS:

```css
:root {
  --brand  : #1a6b4a;   /* Warna utama  */
  --brand2 : #2d9668;   /* Warna hover  */
  --bl     : #e8f5ee;   /* Background terang */
  --acc    : #f0a500;   /* Warna aksen/highlight */
}
```

Contoh tema warna populer:
| Tema | --brand | --brand2 | --acc |
|---|---|---|---|
| Hijau (default) | #1a6b4a | #2d9668 | #f0a500 |
| Biru profesional | #1a4a8a | #2d6bb8 | #f0a500 |
| Ungu modern | #5b21b6 | #7c3aed | #f59e0b |
| Merah energik | #b91c1c | #dc2626 | #0ea5e9 |

### Ganti Font

Ubah link Google Fonts di `<head>`:
```html
<!-- Contoh: pakai Outfit + Inter -->
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
```
Lalu update di CSS: `--fh:'Outfit',sans-serif; --fb:'Inter',sans-serif;`

### Ganti Nama Brand

Cari-ganti teks `AkademiPro` di semua file HTML dengan nama klien.

---

## Fitur Lengkap v2.0

### Portal Siswa (belajar.html)
- Login dengan email + token unik
- Sidebar modul dengan progress indicator
- Konten 3 format: Video embed, PDF download, Teks HTML
- **Kuis interaktif per modul:**
  - Soal satu per satu dengan timer progress bar
  - Feedback langsung benar/salah + penjelasan
  - Skor minimum 70% untuk lulus
  - Bisa ulangi kuis jika gagal
  - Modul berikutnya terkunci sampai kuis lulus
  - Ikon ★ di sidebar untuk modul yang sudah lulus kuis
- Progress tracking (tersimpan ke Sheets)
- Responsive mobile-friendly

### Dashboard Admin (admin.html)
- Login dengan username + password
- Statistik: total pendaftar, menunggu, verified, pendapatan
- Tabel pendaftar dengan filter & search
- Modal verifikasi pembayaran 1 klik
- Export data ke CSV
- **Editor Materi:**
  - Pilih kursus dari dropdown
  - Daftar modul di sidebar kiri
  - Tambah / hapus modul
  - Edit: judul, section, durasi, status terkunci
  - Edit URL video YouTube embed
  - Edit URL PDF Google Drive
  - Edit teks konten (HTML)
  - **Editor kuis:** tambah/hapus soal, 4 opsi A-D, jawaban benar, penjelasan
  - Simpan langsung ke Google Sheets

### Landing Page (index.html)
- Navbar sticky dengan smooth scroll
- Hero section dengan statistik
- Benefits bar
- Grid kursus dinamis dari Sheets
- Testimonial section
- Form 4 langkah: pilih kursus → data diri → pembayaran → sukses
- Kode unik pembayaran otomatis (cegah duplikat)
- Upload bukti transfer → disimpan ke Google Drive
- Notifikasi email otomatis (pendaftar + admin)

### Backend (Code.gs)
- 8 action endpoint (GET + POST)
- Generate token akses unik format XXXX-XXXX-XXXX
- Simpan bukti transfer ke Google Drive (per folder klien)
- Email template: konfirmasi, notif admin, akses siswa, penolakan
- Trigger harian: reminder jika ada pendaftar > 24 jam belum diverifikasi
- CRUD materi kursus (sync antara admin editor ↔ Sheets ↔ portal)

---

## FAQ

**Q: Berapa maksimal siswa yang bisa ditangani?**
A: Google Apps Script gratis cukup untuk 100–500 siswa aktif/bulan. Untuk lebih banyak, pertimbangkan Google Workspace Business.

**Q: Apakah kuis bisa diubah setelah siswa mengerjakan?**
A: Bisa diubah dari Admin Editor kapan saja. Skor kuis siswa yang sudah dikerjakan tidak terpengaruh (tersimpan di memory sesi).

**Q: Bagaimana siswa reset password/token?**
A: Admin buka tab Akses di Sheets → ubah Token → kirim manual ke siswa. Bisa juga buat halaman "Minta Token Baru" sebagai pengembangan lanjutan.

**Q: Bisakah satu siswa akses beberapa kursus?**
A: Ya. Setiap kombinasi email + kursusId mendapat token berbeda di sheet Akses. Siswa perlu token yang sesuai untuk tiap kursus.

**Q: Apakah bisa tambah fitur sertifikat otomatis?**
A: Ya, bisa dikembangkan di Apps Script menggunakan Google Slides sebagai template sertifikat, lalu generate PDF otomatis saat semua modul + kuis selesai.

**Q: Video tidak muncul di portal?**
A: Pastikan URL format embed (`/embed/VIDEO_ID`), bukan URL biasa. Video YouTube harus tidak di-restrict "embedding disabled".

---

## Checklist Sebelum Kirim ke Klien

- [ ] Ganti `SPREADSHEET_ID` di `Code.gs`
- [ ] Ganti `ADMIN_EMAIL` di `Code.gs`
- [ ] Jalankan `setupSpreadsheet()` sekali
- [ ] Deploy sebagai Web App → salin URL
- [ ] Tempel `scriptUrl` di ketiga file HTML
- [ ] Ganti `brandName`, warna, dan font sesuai klien
- [ ] Ganti rekening bank di `index.html`
- [ ] Ganti password admin di `admin.html`
- [ ] Upload file ke hosting klien
- [ ] Update `PORTAL_URL` di `Code.gs` → deploy ulang
- [ ] Test: daftar kursus → upload bukti → verifikasi admin → login portal → kuis
- [ ] Setup trigger harian `dailyReminder` (opsional)

---

*Dibuat untuk dijual kembali sebagai produk white-label. Sesuaikan harga jual berdasarkan biaya setup, kustomisasi, dan dukungan yang diberikan kepada klien.*
