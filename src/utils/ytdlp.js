const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Path ke binary yt-dlp. Default 'yt-dlp' asumsi ada di PATH sistem.
// Kalau pakai hosting seperti Pterodactyl yang tidak punya akses install
// system-wide, set YTDLP_PATH di .env ke path binary standalone,
// misal: YTDLP_PATH=./bin/yt-dlp
function getBinPath() {
  return process.env.YTDLP_PATH || 'yt-dlp';
}

// Cek apakah binary yt-dlp tersedia di sistem
let ytdlpAvailableCache = null;
function checkYtDlpAvailable() {
  return new Promise((resolve) => {
    if (ytdlpAvailableCache !== null) return resolve(ytdlpAvailableCache);
    const proc = spawn(getBinPath(), ['--version']);
    proc.on('error', () => {
      ytdlpAvailableCache = false;
      resolve(false);
    });
    proc.on('close', (code) => {
      ytdlpAvailableCache = code === 0;
      resolve(ytdlpAvailableCache);
    });
  });
}

// Ambil metadata (tanpa download) menggunakan `yt-dlp -J`
function getInfo(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const args = [
      '-J',
      '--no-warnings',
      '--no-playlist',
      '--no-check-certificate',
      '--socket-timeout', '15',
      url
    ];

    const proc = spawn(getBinPath(), args);
    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        proc.kill('SIGKILL');
        reject(new Error('yt-dlp timeout saat mengambil metadata'));
      }
    }, timeoutMs);

    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      // ENOENT berarti binary yt-dlp tidak ditemukan di PATH
      reject(err);
    });

    proc.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code !== 0) {
        logger.debug(`yt-dlp -J exit ${code}: ${stderr.slice(0, 300)}`);
        return reject(new Error(stderr.split('\n')[0] || `yt-dlp keluar dengan kode ${code}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Download video langsung ke folder tujuan menggunakan yt-dlp.
// yt-dlp yang menangani header/cookie/signature CDN, jauh lebih reliable
// daripada axios manual terutama untuk Instagram & Facebook.
function downloadVideo(url, destDir, baseName, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const outputTemplate = path.join(destDir, `${baseName}.%(ext)s`);

    const args = [
      '-f', 'mp4[filesize<25M]/best[ext=mp4][filesize<25M]/best[ext=mp4]/best',
      '--no-warnings',
      '--no-playlist',
      '--no-check-certificate',
      '--max-filesize', '25M',
      '--socket-timeout', '20',
      '-o', outputTemplate,
      url
    ];

    const proc = spawn(getBinPath(), args);
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        proc.kill('SIGKILL');
        reject(new Error('yt-dlp timeout saat download video'));
      }
    }, timeoutMs);

    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      if (code !== 0) {
        logger.debug(`yt-dlp download exit ${code}: ${stderr.slice(0, 500)}`);
        return reject(new Error(stderr.split('\n').filter(Boolean).pop() || `yt-dlp keluar dengan kode ${code}`));
      }

      // Cari file hasil download (ekstensi bisa .mp4/.webm/.mkv tergantung sumber)
      const files = fs.readdirSync(destDir).filter(f => f.startsWith(baseName));
      if (files.length === 0) {
        return reject(new Error('yt-dlp tidak menghasilkan file output'));
      }
      resolve(path.join(destDir, files[0]));
    });
  });
}

// Mapping hasil `getInfo` ke struktur embedData yang dipakai bot ini
function infoToEmbedData(info, platform, siteName, url) {
  if (!info) return null;

  const hasVideo = Array.isArray(info.formats) && info.formats.some(f => f.vcodec && f.vcodec !== 'none');

  return {
    author: info.uploader || info.channel || info.uploader_id || `${siteName} User`,
    authorUrl: info.uploader_url || info.channel_url || null,
    authorAvatar: null,
    description: (info.description || info.title || '').toString().trim().substring(0, 300),
    image: info.thumbnail || (Array.isArray(info.thumbnails) && info.thumbnails.length ? info.thumbnails[info.thumbnails.length - 1].url : null),
    videoUrl: null, // sengaja null, download dilakukan lewat yt-dlp langsung (lihat useYtDlp)
    useYtDlp: true,
    isVideo: hasVideo || info.ext === 'mp4' || !!info.duration,
    likes: info.like_count || 0,
    comments: info.comment_count || 0,
    shares: info.repost_count || 0,
    timestamp: info.timestamp ? new Date(info.timestamp * 1000).toISOString() : new Date().toISOString(),
    platform: platform,
    siteName: siteName,
    url: info.webpage_url || url
  };
}

module.exports = {
  checkYtDlpAvailable,
  getInfo,
  downloadVideo,
  infoToEmbedData
};
