const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');
const ytdlp = require('../../utils/ytdlp');

// Helper function untuk clean text
function cleanText(text) {
  if (!text) return '';
  return text.replace(/[^\w\s\-.,!?()'"@#$%^&*+=]/g, '').trim();
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

// Extract video URL dari TikTok
function extractVideoUrl(html) {
  try {
    const patterns = [
      /"videoUrl":"(https:[^"]+\.mp4[^"]*)"/,
      /"downloadAddr":"(https:[^"]+\.mp4[^"]*)"/,
      /"playAddr":"(https:[^"]+\.mp4[^"]*)"/,
      /<video[^>]+src="(https:[^"]+\.mp4[^"]*)"/,
      /"video":\{"url":"(https:[^"]+\.mp4[^"]*)"/
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        let url = match[1].replace(/\\/g, '');
        if (url.startsWith('//')) url = 'https:' + url;
        if (isValidUrl(url)) {
          return url;
        }
      }
    }

    // Coba dari JSON di HTML
    const jsonMatch = html.match(/<script[^>]*>window\.__INITIAL_STATE__\s*=\s*({.*?});?<\/script>/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        // Navigasi ke video URL
        const videoUrl = data?.videoData?.itemInfos?.video?.urls?.[0];
        if (videoUrl && isValidUrl(videoUrl)) {
          return videoUrl;
        }
      } catch (e) {}
    }

    return null;
  } catch (error) {
    logger.logError(error, 'Extracting TikTok video URL');
    return null;
  }
}

// Check if post is video
function isVideoPost(html) {
  try {
    const indicators = [
      /"video":/,
      /"videoUrl":/,
      /"playAddr":/,
      /<video/,
      /"content_type":"video"/
    ];

    for (const indicator of indicators) {
      if (indicator.test(html)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
}

async function fetchData(url) {
  // Metode utama: yt-dlp, jauh lebih reliable daripada regex terhadap HTML
  // yang mudah berubah struktur/di-obfuscate oleh TikTok.
  try {
    const available = await ytdlp.checkYtDlpAvailable();
    if (available) {
      const info = await ytdlp.getInfo(url);
      const embedData = ytdlp.infoToEmbedData(info, 'tiktok', 'TikTok', url);
      if (embedData) {
        logger.info(`TikTok data via yt-dlp berhasil (video: ${embedData.isVideo})`);
        return embedData;
      }
    } else {
      logger.warning('yt-dlp tidak ditemukan di sistem, fallback ke scraping HTML (kurang reliable untuk TikTok)');
    }
  } catch (error) {
    logger.debug(`yt-dlp gagal untuk TikTok, fallback ke scraping: ${error.message}`);
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    let title = $('meta[property="og:title"]').attr('content') || 'TikTok Video';
    let description = $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content');
    const siteName = $('meta[property="og:site_name"]').attr('content') || 'TikTok';
    const type = $('meta[property="og:type"]').attr('content') || '';

    title = cleanText(title);
    description = cleanText(description);

    let author = 'TikTok User';
    const authorMatch = html.match(/"uniqueId":"([^"]+)"/);
    if (authorMatch) {
      author = cleanText(authorMatch[1]);
    }

    const isVideo = isVideoPost(html) || type.includes('video');
    let videoUrl = null;

    if (isVideo) {
      videoUrl = extractVideoUrl(html);
      logger.info(`TikTok video detected, URL: ${videoUrl ? 'found' : 'not found'}`);
    }

    if (isVideo && !videoUrl) {
      videoUrl = $('meta[property="og:video"]').attr('content');
      if (videoUrl && !videoUrl.includes('.mp4')) {
        videoUrl = null;
      }
    }

    return {
      title: title || 'TikTok Video',
      description: description.substring(0, 200),
      image: isValidUrl(image) ? image : null,
      siteName: siteName,
      author: author,
      url: url,
      timestamp: new Date().toISOString(),
      platform: 'TikTok',
      isVideo: isVideo,
      videoUrl: isValidUrl(videoUrl) ? videoUrl : null,
      videoThumbnail: isValidUrl(image) ? image : null
    };

  } catch (error) {
    logger.logError(error, 'TikTok handler');
    return null;
  }
}

module.exports = { fetchData };