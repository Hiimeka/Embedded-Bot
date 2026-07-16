require('dotenv').config();
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const config = require('./config');
const { processLink } = require('./services/embedFixer');
const logger = require('./utils/logger');
const ascii = require('./utils/ascii');
const ytdlp = require('./utils/ytdlp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Daftar platform yang didukung
const SUPPORTED_PLATFORMS = ['instagram', 'facebook', 'twitter', 'youtube', 'tiktok', 'reddit'];

// Helper function untuk truncate text
function truncateText(text, maxLength = 200) {
  if (!text) return '';
  if (typeof text !== 'string') text = String(text);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Validasi URL
function isValidUrl(string) {
  try {
    if (!string) return false;
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Format angka
function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Dapatkan icon untuk setiap platform
function getPlatformIcon(platform) {
  const icons = {
    'instagram': '📸',
    'instagram_reel': '🎬',
    'facebook': '📘',
    'twitter': '🐦',
    'youtube': '▶️',
    'reddit': '🤖',
    'tiktok': '🎵',
    'fallback': '🔗'
  };
  return icons[platform] || '🔗';
}

// Dapatkan warna untuk setiap platform
function getPlatformColor(platform) {
  const colors = {
    'instagram': 0xE4405F,
    'instagram_reel': 0xE4405F,
    'facebook': 0x1877F2,
    'twitter': 0x1DA1F2,
    'youtube': 0xFF0000,
    'reddit': 0xFF4500,
    'tiktok': 0x000000,
    'fallback': 0x5865F2
  };
  return colors[platform] || 0x5865F2;
}

// Fungsi untuk menghitung waktu relatif
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffYear > 0) return `${diffYear}y ago`;
  else if (diffMonth > 0) return `${diffMonth}mo ago`;
  else if (diffWeek > 0) return `${diffWeek}w ago`;
  else if (diffDay > 0) return `${diffDay}d ago`;
  else if (diffHour > 0) return `${diffHour}h ago`;
  else if (diffMin > 0) return `${diffMin}m ago`;
  else return 'Just now';
}

// Download video ke temporary file (metode lama: axios stream dari URL langsung)
// Dipakai untuk platform yang sudah mengembalikan URL CDN langsung (mis. Reddit, Twitter/vxtwitter)
async function downloadVideoAxios(videoUrl) {
  try {
    logger.info(`Downloading video from: ${videoUrl.substring(0, 100)}...`);
    
    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.instagram.com/',
      }
    });

    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let ext = '.mp4';
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('webm')) ext = '.webm';
    else if (contentType.includes('mov')) ext = '.mov';
    
    const fileName = `video_${Date.now()}${ext}`;
    const filePath = path.join(tempDir, fileName);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        const stats = fs.statSync(filePath);
        logger.info(`Video downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        resolve(filePath);
      });
      writer.on('error', reject);
      
      setTimeout(() => {
        writer.end();
        reject(new Error('Download timeout'));
      }, 60000);
    });
  } catch (error) {
    logger.logError(error, 'Downloading video');
    return null;
  }
}

// Download video ke temporary file menggunakan yt-dlp.
// Dipakai untuk Instagram/Facebook/TikTok karena yt-dlp menangani
// signature/header/cookie CDN yang tidak bisa ditiru axios biasa.
async function downloadVideoYtDlp(pageUrl) {
  try {
    const tempDir = path.join(__dirname, '../temp');
    const baseName = `video_${Date.now()}`;
    logger.info(`Downloading video via yt-dlp from: ${pageUrl.substring(0, 100)}...`);
    const filePath = await ytdlp.downloadVideo(pageUrl, tempDir, baseName);
    const stats = fs.statSync(filePath);
    logger.info(`Video downloaded via yt-dlp: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    return filePath;
  } catch (error) {
    logger.logError(error, 'Downloading video via yt-dlp');
    return null;
  }
}

// Wrapper: pilih metode download sesuai flag yang di-set oleh platform handler
async function downloadVideo(embedData) {
  if (embedData.useYtDlp) {
    return downloadVideoYtDlp(embedData.url);
  }
  return downloadVideoAxios(embedData.videoUrl);
}

// Buat embed dengan gaya seperti screenshot
function createStyledEmbed(embedData, message) {
  const platform = embedData.platform || 'fallback';
  const platformIcon = getPlatformIcon(platform);
  const color = getPlatformColor(platform);
  
  const embed = new EmbedBuilder()
    .setColor(color)
    .setURL(embedData.url || null)
    .setTimestamp(new Date(embedData.timestamp || Date.now()));

  const authorName = embedData.author || 'Unknown';
  embed.setAuthor({
    name: `${authorName}`,
    iconURL: embedData.authorAvatar || null,
    url: embedData.authorUrl || null
  });

  if (embedData.description) {
    embed.setDescription(truncateText(embedData.description, 4000));
  }

  if (embedData.image && isValidUrl(embedData.image)) {
    embed.setImage(embedData.image);
  }

  const timeAgo = getTimeAgo(new Date(embedData.timestamp || Date.now()));
  const footerText = `${platformIcon} ${embedData.siteName || platform.charAt(0).toUpperCase() + platform.slice(1)} • ${timeAgo}`;
  embed.setFooter({
    text: truncateText(footerText, 2000)
  });

  const fields = [];
  
  if (embedData.likes !== undefined && embedData.likes !== null && embedData.likes > 0) {
    fields.push({
      name: '❤️',
      value: formatNumber(embedData.likes),
      inline: true
    });
  }
  
  if (embedData.comments !== undefined && embedData.comments !== null && embedData.comments > 0) {
    fields.push({
      name: '💬',
      value: formatNumber(embedData.comments),
      inline: true
    });
  }
  
  if (embedData.shares !== undefined && embedData.shares !== null && embedData.shares > 0) {
    fields.push({
      name: '↗️',
      value: formatNumber(embedData.shares),
      inline: true
    });
  }

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

// Kirim video sebagai attachment
async function sendVideoAsAttachment(embedData, message) {
  try {
    if (!embedData.useYtDlp) {
      const videoUrl = embedData.videoUrl;
      if (!videoUrl || !isValidUrl(videoUrl)) {
        logger.warning('Invalid video URL');
        return false;
      }
    }

    const videoPath = await downloadVideo(embedData);
    
    if (!videoPath || !fs.existsSync(videoPath)) {
      logger.warning('Video download failed');
      return false;
    }

    const stats = fs.statSync(videoPath);
    const fileSizeMB = stats.size / 1024 / 1024;
    
    if (fileSizeMB > 25) {
      logger.warning(`Video too large: ${fileSizeMB.toFixed(2)}MB (max 25MB)`);
      
      const embed = createStyledEmbed(embedData, message);
      embed.setDescription(`🎬 Video terlalu besar (${fileSizeMB.toFixed(2)}MB) untuk diupload ke Discord\n[Klik untuk buka di ${embedData.platform || 'sumber'}](${embedData.url})`);

      await message.channel.send({
        content: `${getPlatformIcon(embedData.platform)} **${embedData.platform || 'Video'}** dari ${message.author}`,
        embeds: [embed]
      });

      fs.unlink(videoPath, () => {});
      return true;
    }

    const embed = createStyledEmbed(embedData, message);
    embed.setImage(null);

    const currentFooter = embed.data.footer?.text || '';
    embed.setFooter({
      text: `${currentFooter} • ${fileSizeMB.toFixed(1)}MB`,
      iconURL: embed.data.footer?.icon_url
    });

    await message.channel.send({
      content: `🎬 **${embedData.platform || 'Video'}** dari ${message.author}`,
      embeds: [embed],
      files: [{
        attachment: videoPath,
        name: `video_${Date.now()}.mp4`
      }]
    });

    fs.unlink(videoPath, (err) => {
      if (err) logger.warning('Failed to delete temp video:', err.message);
    });

    logger.success(`Video sent successfully: ${fileSizeMB.toFixed(2)}MB`);
    return true;

  } catch (error) {
    logger.logError(error, 'Sending video as attachment');
    return false;
  }
}

// ============================================
// BOT START - DENGAN ASCII ART KEREN
// ============================================

client.once(Events.ClientReady, async (c) => {
  // Tampilkan header dengan ASCII Art
  const botInfo = {
    name: config.bot.name || 'Embedded Bot',
    version: config.bot.version || '1.0.0',
    botTag: c.user.tag,
    guildCount: client.guilds.cache.size,
    platforms: SUPPORTED_PLATFORMS
  };
  
  await ascii.displayBotHeader(botInfo);
  
  // Tampilkan platform banner
  ascii.displayPlatformBanner(SUPPORTED_PLATFORMS);
  
  // Tampilkan info tambahan
  ascii.displaySuccess(`Bot online sebagai ${c.user.tag}`);
  ascii.displayInfo(`Terhubung ke ${client.guilds.cache.size} server`);
  ascii.displayInfo(`Menunggu link media sosial...`);

  const ytdlpOk = await ytdlp.checkYtDlpAvailable();
  if (ytdlpOk) {
    ascii.displaySuccess('yt-dlp terdeteksi — ekstraksi video Instagram/Facebook/TikTok aktif penuh');
  } else {
    ascii.displayWarning('yt-dlp TIDAK ditemukan di PATH! Install dengan "pip install -U yt-dlp" agar attachment video Instagram/Facebook/TikTok bisa berjalan (fallback scraping jauh kurang reliable).');
  }

  logger.info(`Bot online: ${c.user.tag}`);
});

// ============================================
// MESSAGE HANDLER
// ============================================

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = message.content.match(urlRegex);

  if (!urls) return;

  for (const url of urls) {
    try {
      if (url.includes('discord.com') || url.includes('cdn.discordapp.com')) continue;

      // Log dengan ASCII style
      ascii.displayInfo(`📥 Processing: ${url.substring(0, 50)}...`);

      const result = await processLink(url, message);

      if (result && result.embed) {
        const embedData = result.embed;

        if (embedData.isVideo && embedData.videoUrl) {
          logger.info(`Processing video from ${embedData.platform}: ${url}`);
          const sent = await sendVideoAsAttachment(embedData, message);
          
          if (sent) {
            ascii.displaySuccess(`✅ Video sent from ${embedData.platform}`);
            logger.success(`Video sent: ${url}`);
            break;
          }
        }

        const embed = createStyledEmbed(embedData, message);
        if (!embed) continue;

        const platformIcon = getPlatformIcon(embedData.platform || 'fallback');
        const platformName = embedData.platform || embedData.siteName || 'Link';

        await message.channel.send({
          content: `${platformIcon} **${platformName}** dari ${message.author}`,
          embeds: [embed]
        });

        ascii.displaySuccess(`✅ Fixed embed from ${embedData.platform || 'fallback'}`);
        logger.success(`Fixed embed for: ${url}`);
        break;
      }
    } catch (error) {
      ascii.displayError(error);
      logger.logError(error, `Processing URL: ${url}`);
    }
  }
});

// ============================================
// ERROR HANDLING
// ============================================

client.on(Events.Error, (error) => {
  ascii.displayError(error);
  logger.logError(error, 'Discord client');
});

process.on('unhandledRejection', (error) => {
  ascii.displayError(error);
  logger.logError(error, 'Unhandled rejection');
});

// ============================================
// SHUTDOWN
// ============================================

process.on('SIGINT', () => {
  ascii.displayWarning('Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  ascii.displayWarning('Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// ============================================
// LOGIN
// ============================================

client.login(config.discord.token).catch((error) => {
  ascii.displayError(error);
  logger.logError(error, 'Login');
  console.error('❌ Gagal login! Cek token bot Anda.');
});