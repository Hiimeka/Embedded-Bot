# Embed Fixer

Discord bot untuk memperbaiki embed link media sosial (Instagram, Facebook, TikTok, Twitter/X, Reddit, YouTube) — video otomatis dikirim langsung sebagai attachment yang bisa diputar di Discord, bukan cuma link mentah.

## Fitur

- Deteksi otomatis link Instagram, Facebook, TikTok, Twitter/X, Reddit, dan YouTube di chat
- Video dikirim sebagai **attachment** (bisa diputar langsung di Discord), bukan sekadar embed link
- Fallback ke Open Graph scraping untuk situs yang tidak dikenali
- Embed bergaya kartu (author, like, komentar, share, waktu posting)
- Ekstraksi video pakai [yt-dlp](https://github.com/yt-dlp/yt-dlp) — jauh lebih reliable dibanding scraping HTML manual

## Requirement

| Kebutuhan | Keterangan |
|---|---|
| Node.js | v18 ke atas |
| yt-dlp | wajib, untuk ekstraksi & download video Instagram/Facebook/TikTok |
| ffmpeg | disarankan, dipakai yt-dlp untuk merge audio+video kalau perlu |

## Instalasi

```bash
npm install
```

### Install yt-dlp

**Di VPS/PC biasa (ada akses pip/apt):**
```bash
pip install -U yt-dlp
```

**Di hosting terbatas seperti Pterodactyl (tanpa akses install system-wide):**
```bash
mkdir -p bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
chmod +x bin/yt-dlp
```
Lalu set `YTDLP_PATH=./bin/yt-dlp` di file `.env` (lihat `.env.example`).

## Konfigurasi

Copy `.env.example` menjadi `.env`, lalu isi:

```env
DISCORD_TOKEN=token_bot_discord_kamu
DISCORD_CLIENT_ID=client_id_bot_kamu

# Opsional — kosongkan kalau yt-dlp sudah ada di PATH sistem
YTDLP_PATH=
```

## Menjalankan bot

```bash
npm start
```

Mode development (auto-restart saat ada perubahan file):
```bash
npm run dev
```

Saat bot online, cek log console — akan muncul status apakah yt-dlp terdeteksi atau tidak.

## Struktur folder

```
src/
  index.js                  # entry point, message handler, logika kirim attachment
  config.js                 # baca variabel dari .env
  services/
    embedFixer.js            # router URL ke handler platform yang sesuai
    platforms/
      instagram.js            # yt-dlp + fallback scraping
      facebook.js              # yt-dlp + fallback scraping
      tiktok.js                # yt-dlp + fallback scraping
      twitter.js               # via API vxtwitter
      reddit.js                # via Reddit .json API
      youtube.js               # via oEmbed API
  utils/
    ytdlp.js                  # wrapper child_process ke binary yt-dlp
    logger.js                 # logger ke console + file
    ascii.js                  # tampilan ASCII art di console
```

## Cara kerja singkat

1. Bot mendeteksi URL di pesan Discord.
2. URL dicocokkan ke platform yang sesuai (`embedFixer.js`).
3. Handler platform (Instagram/Facebook/TikTok) coba ambil data lewat **yt-dlp** dulu; kalau gagal atau yt-dlp tidak ada, fallback ke scraping Open Graph/HTML.
4. Kalau kontennya video, bot download videonya (lewat yt-dlp atau langsung dari URL CDN, tergantung platform) lalu upload sebagai attachment ke channel.
5. Kalau video terlalu besar (>25MB, limit default Discord), bot kirim embed biasa dengan link ke sumber asli.

## Batasan yang perlu diketahui

- Limit ukuran file Discord (biasanya 25MB tanpa Nitro) tetap berlaku — video besar tidak akan diupload sebagai attachment.
- Konten privat/login-only (akun private, grup tertutup, dsb.) tidak bisa diakses tanpa cookie/login, baik lewat yt-dlp maupun scraping biasa.
- Instagram/Facebook/TikTok bisa saja mengubah struktur situs mereka kapan saja; kalau ekstraksi mulai gagal, cek dulu apakah ada update `yt-dlp` (`yt-dlp -U` atau `pip install -U yt-dlp`) sebelum melapor sebagai bug.

## Troubleshooting

**Video tidak pernah terkirim sebagai attachment, cuma embed teks biasa**
→ Cek log: kemungkinan yt-dlp tidak terdeteksi. Pastikan `yt-dlp --version` (atau path di `YTDLP_PATH`) berjalan di server.

**Bot jalan tapi tidak merespons link sama sekali**
→ Pastikan Message Content Intent diaktifkan di [Discord Developer Portal](https://discord.com/developers/applications) untuk bot kamu.

**Error "yt-dlp keluar dengan kode 1" di log**
→ Biasanya konten private/dihapus, atau yt-dlp perlu update ke versi terbaru.
