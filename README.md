# 漢字 Kanji Quizzer — JLPT N5–N1

Aplikasi web offline single-file untuk latihan **kanji** dan **kosakata** JLPT level N5 sampai N1.
Seluruh data (2.235 kanji + 6.367 vocab) sudah di-embed langsung ke `index.html` — tinggal buka, tidak perlu server atau internet.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![JLPT](https://img.shields.io/badge/JLPT-N5_~_N1-blue)
![Size](https://img.shields.io/badge/index.html-~2.5_MB-orange)

---

## Cara Pakai

1. Buka `index.html` di browser (double-click).
2. Pilih tab **Kanji** atau **Vocabulary**.
3. Pilih level JLPT (N5 / N4 / N3 / N2 / N1).
4. Mulai quiz.

Tidak perlu install, tidak perlu internet, tidak perlu build ulang.

---

## Fitur Lengkap

### Quiz Pilihan Ganda (3×3 grid)

- **9 pilihan jawaban** per soal
- Tiga mode soal:
  | Mode | Depan Kartu | Pilihan Jawaban |
  |---|---|---|
  | Kanji → Arti | Kanji/kata saja | Arti (ID/EN/Kana) |
  | Arti → Kanji | Arti saja | Kanji/kata |
  | Flashcard | Kanji/kata saja | Tidak ada — user balik kartu manual |
- Toggle bahasa jawaban: **Indonesia** · **English** · **Kana**
- Ganti bahasa / toggle mode **tidak mereset sesi** — skor tetap

### Kartu Flip 3D

Semua mode memakai sistem kartu flip yang sama:

- **Sebelum menjawab**: sisi depan abu-abu, hanya menampilkan kanji/kata/arti sesuai mode — **tidak ada kebocoran jawaban**
- **Setelah menjawab**: kartu berputar 3D (CSS `rotateY`, `perspective 1600px`, transisi 0.62s), menampilkan:
  - Arti Indonesia + English
  - Kun'yomi / On'yomi
  - Radikal, jumlah goresan, info kelas
  - **Kombinasi kata** (kanji) atau **Kanji pembentuk** (vocab)

### Furigana

- Tombol **Furigana** menampilkan bacaan kana **kecil di atas kata Jepang** (ruby annotation)
- Otomatis disembunyikan jika bacaan = jawaban (mode Kana) untuk mencegah bocor

### Animasi

- **Pop** saat jawaban benar
- **Shake** saat jawaban salah
- **Confetti** (30 partikel) di mode flashcard, di-anchor ke posisi kartu
- Semua animasi mengikuti `prefers-reduced-motion` — nonaktif jika OS mengaktifkan reduce motion

### Search / Dictionary

Mini dictionary internal untuk seluruh dataset:

- Cari berdasarkan: kanji, kata Jepang, kana, romaji, arti Indonesia, arti English, Kun'yomi, On'yomi
- Panel hasil (kiri) + panel detail (kanan)
- Detail menampilkan: furigana, romaji, arti ID/EN, Kun/On, radikal, goresan, JLPT, kanji pembentuk, kombinasi kata
- Bisa langsung **Favorite** atau **Tandai Sulit** dari hasil pencarian

### Bookmark / Favorite & My Collection

- Tombol **☆ Favorite** dan **⚠ Tandai Sulit** di setiap kartu dan hasil dictionary
- Data disimpan di `localStorage`
- Halaman **My Collection** dengan 4 tab:
  - Favorite Kanji
  - Favorite Vocabulary
  - Kanji Sulit
  - Vocabulary Sulit
- Aksi koleksi:
  - **Quiz Collection** — pilihan ganda dari item koleksi
  - **Review Collection** — flashcard dari item koleksi
  - **Random Collection** — quiz acak dari item koleksi

### Listening Quiz

- App memainkan suara Jepang via `speechSynthesis` (voice `ja-JP`)
- Teks Jepang **tidak ditampilkan** sampai user menjawab
- 9 pilihan kata Jepang
- Shortcut: `Space` = play · `R` = replay · `1–9` = pilih · `Enter` = soal baru

### JLPT Roadmap

Ringkasan perkembangan N5 sampai N1:

- Jumlah kanji & vocabulary per level
- Progress persen gabungan
- Statistik: Mastered · Learning · Review · New

### Diagnostic Test

Tes awal untuk mengetahui kondisi kemampuan per level:

- 50 soal mencakup: Kanji Recognition, Meaning, Reading, Vocabulary
- Hasil: persentase per kategori + rekomendasi materi review
- **Tidak mengubah progress utama**

### Achievements

Sistem pencapaian untuk memberi target tambahan:

- First Kanji · 100 Kanji · 500 Kanji · 1.000 Kanji
- 100 Vocabulary
- 90% Accuracy · Perfect Set
- 7 Day Streak · N5 Master
- Tiap achievement punya progress bar, status locked/unlocked
- **Tidak mempengaruhi mastery utama**

### Progress & Skor

- Topbar real-time: ✓ benar · ✗ salah · Remaining
- Modal hasil akhir:
  - Persentase akurat (berdasarkan `benar / (benar + salah)`)
  - Delta progress per level (+%)
  - Daftar kartu **PERLU DIULANG**
  - Tombol: Random Quiz · Restart · Choose Level
- Progress disimpan di `localStorage` per level per jenis

### Keyboard Shortcuts

| Key | Aksi |
|---|---|
| `1`–`9` | Pilih jawaban |
| `Enter` | Kartu berikutnya |
| `Space` | Balik kartu (flashcard) / Play (listening) |
| `1` / `2` | Benar / Salah (flashcard) |
| `F` | Toggle furigana |
| `R` | Replay (listening) |
| `Esc` | Tutup modal/menu |

### Menu Referensi Data

Menjelaskan sumber data yang dipakai:
- kanji.jepang.org — kanji JLPT & detail
- elzup/jlpt-word-list — daftar vocabulary
- kanji.jepang.org/kosakata — detail kosakata (fallback dari elzup jika halaman belum ada)

---

## Data

| Jenis | Jumlah | N5 | N4 | N3 | N2 | N1 |
|---|---|---|---|---|---|---|
| Kanji | 2.235 | 79 | 167 | 416 | 373 | 1.200 |
| Vocabulary | 6.367 | 519 | 513 | 1.791 | 1.283 | 2.216 |

**Kanji** — 1.806 arti unik, 0 gagal scrape. Tiap kanji punya: arti ID/EN, Kun/On, radikal, goresan, info kelas, dan sampai 8 kombinasi kata.

**Vocabulary** — dari 7.832 kata elzup, 6.367 berhasil scrape detail dari kanji.jepang.org. Sisanya (1.465 × 404) menggunakan arti fallback dari CSV elzup. Tiap vocab punya: kata, bacaan kana, romaji, arti ID/EN, kanji pembentuk.

Beberapa arti Indonesia sudah di-override manual untuk hasil yang lebih natural:
- 御飯 → nasi, makanan (bukan *cooked rice, meal*)
- 話 → cerita, pembicaraan, topik
- 話す → berbicara, bercakap-cakap, mengobrol
- dan lainnya (lihat `ID_OVERRIDES` di `scripts/build_data.py`)

### Sumber Data

| Sumber | Dipakai Untuk |
|---|---|
| [kanji.jepang.org](https://kanji.jepang.org) | List kanji per level, detail kanji, detail kosakata |
| [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) | Daftar vocabulary JLPT N5–N1 |

---

## Struktur Proyek

```
KanjiQuiz/
├── index.html              Output final (~2.5 MB, single-file, data embedded)
│
├── src/
│   ├── 01-head.html        <head> + seluruh CSS
│   ├── 02-body.html        Markup (topbar, drawer, semua screen, modal)
│   ├── 03-engine.js        Data/DB, state, buildCards, dealChoices, progress, session
│   └── 04-ui.js            Render, events, animasi, dictionary, collection, roadmap, dll
│
├── scripts/
│   ├── build_app.py        Build index.html dari src/ + data/
│   ├── build_data.py       Proses raw → data/kanji.json + data/vocab.json
│   ├── scrape_kanji.py     Scrape kanji dari kanji.jepang.org (resumable, rate-limited)
│   ├── scrape_vocab.py     Scrape vocab dari kanji.jepang.org (resumable, rate-limited)
│   └── check_coverage.py   Cek coverage kosakata dari halaman kanji
│
├── data/
│   ├── kanji.json          Data kanji siap embed (kompak)
│   ├── kanji_raw.json      Data kanji mentah dari scraper
│   ├── vocab.json          Data vocab siap embed (kompak)
│   └── vocab_raw.jsonl     Data vocab mentah dari scraper
│
├── assets/
│   └── fontawesome/        Font Awesome 6.7.2 (lokal, offline)
│
├── cache/                  Cache HTML scraper (detail_*.html, list_*.html, v_n*.csv)
└── _scratch/               Log scraper dan file temp
```

---

## Build Ulang

Jika ingin memperbarui data atau mengubah UI:

```bash
cd scripts

# 1. Rebuild data dari raw (tidak perlu scrape ulang)
python build_data.py

# 2. Build index.html dari src/ + data/
python build_app.py
```

Output:
```
kanji.json: 1437 KB {'N5': 79, 'N4': 167, 'N3': 416, 'N2': 373, 'N1': 1200}
vocab.json: 1023 KB {'N5': 519, 'N4': 513, 'N3': 1791, 'N2': 1283, 'N1': 2216}
index.html: 2537 KB | embed: 2460 KB
```

### Scrape Ulang (opsional)

```bash
# Scrape kanji (rate-limited, ~10 menit)
python scrape_kanji.py

# Scrape vocab (rate-limited, ~2-3 jam karena 7832 kata)
python scrape_vocab.py

# Lalu rebuild
python build_data.py && python build_app.py
```

> **Peringatan:** kanji.jepang.org menerapkan rate-limit agresif (HTTP 429).
> Scraper sudah dilengkapi throttle global, backoff 8–40 detik, dan mode resumable.
> Nama file cache memakai hex UTF-8 agar karakter CJK tidak bertabrakan.

---

## Teknologi

- **HTML / CSS / JavaScript** — vanilla, tanpa framework, tanpa dependency runtime
- **Font Awesome 6.7.2** — ikon, di-host lokal
- **CSS 3D Transform** — kartu flip (`perspective`, `rotateY`, `preserve-3d`)
- **Web Speech API** — `speechSynthesis` untuk TTS Jepang dan listening quiz
- **localStorage** — progress, sesi, favorite, koleksi, achievement
- **Python 3** — scraper dan build scripts (openpyxl tidak diperlukan untuk build)

---

## Browser

Diuji di browser modern (Chrome, Edge, Firefox).
Tidak memerlukan server — bisa dibuka langsung dari `file://`.

> **Catatan:** `localStorage` bisa `SecurityError` di `file://` pada beberapa browser.
> Jika terjadi, buka via server lokal: `python -m http.server 8080` lalu akses `localhost:8080`.

---

## Lisensi

Data kanji dari [kanji.jepang.org](https://kanji.jepang.org).
Daftar vocabulary dari [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) (MIT).
