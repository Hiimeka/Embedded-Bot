const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');
const ytdlp = require('../../utils/ytdlp');

function cleanText(text) {
  if (!text) return '';
  return text.replace(/[^\w\s\-.,!?()'"@#$%^&*+=]/g, '').trim();
}

function isValidUrl(string) {
  try {
    if (!string) return false;
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Extract video URL dari Facebook
function extractVideoUrl(html) {
  try {
    const patterns = [
      /"playable_url":"(https:[^"]+\.mp4[^"]*)"/,
      /"video_url":"(https:[^"]+\.mp4[^"]*)"/,
      /"playable_url_quality_hd":"(https:[^"]+\.mp4[^"]*)"/,
      /"browser_native_hd_url":"(https:[^"]+\.mp4[^"]*)"/,
      /<video[^>]+src="(https:[^"]+\.mp4[^"]*)"/,
      /"src":"(https:[^"]+\.mp4[^"]*)"/
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

    return null;
  } catch (error) {
    logger.logError(error, 'Extracting Facebook video URL');
    return null;
  }
}

// Check if post is video
function isVideoPost(html) {
  try {
    const indicators = [
      /"is_video":true/,
      /"playable_url":"https/,
      /"video_url":"https/,
      /<video/,
      /"type":"video"/
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
  // Metode utama: yt-dlp. Facebook sering menyajikan halaman versi
  // login-wall / lazy-load JS untuk request tanpa cookie, sehingga regex
  // manual terhadap HTML sering tidak menemukan video_url. yt-dlp jauh
  // lebih reliable untuk video/reels publik.
  try {
    const available = await ytdlp.checkYtDlpAvailable();
    if (available) {
      const info = await ytdlp.getInfo(url);
      const embedData = ytdlp.infoToEmbedData(info, 'facebook', 'Facebook', url);
      if (embedData) {
        logger.info(`Facebook data via yt-dlp berhasil (video: ${embedData.isVideo})`);
        return embedData;
      }
    } else {
      logger.warning('yt-dlp tidak ditemukan di sistem, fallback ke scraping HTML (kurang reliable untuk Facebook)');
    }
  } catch (error) {
    logger.debug(`yt-dlp gagal untuk Facebook, fallback ke scraping: ${error.message}`);
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      timeout: 15000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Ekstrak dari Open Graph
    let title = $('meta[property="og:title"]').attr('content') || 'Facebook Post';
    let description = $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content');
    const siteName = $('meta[property="og:site_name"]').attr('content') || 'Facebook';
    const type = $('meta[property="og:type"]').attr('content') || '';

    // Clean text
    title = cleanText(title);
    description = cleanText(description);

    // Ekstrak author dari title
    let author = 'Unknown User';
    if (title) {
      const titleMatch = title.match(/^(.*?)(?:\s*-\s*|$)/);
      if (titleMatch && titleMatch[1]) {
        author = cleanText(titleMatch[1]);
      }
    }

    // Cek apakah ini video
    const isVideo = isVideoPost(html) || type.includes('video');
    let videoUrl = null;

    if (isVideo) {
      videoUrl = extractVideoUrl(html);
      logger.info(`Facebook video detected, URL: ${videoUrl ? 'found' : 'not found'}`);
    }

    // Jika video URL tidak ditemukan, coba dari meta
    if (isVideo && !videoUrl) {
      videoUrl = $('meta[property="og:video"]').attr('content') || 
                 $('meta[property="og:video:url"]').attr('content');
      if (videoUrl && !videoUrl.includes('.mp4')) {
        videoUrl = null;
      }
    }

    // Ekstrak interaksi (like, comment, share) dari HTML
    let likes = 0;
    let comments = 0;
    let shares = 0;

    // Coba cari dari HTML
    const likeMatch = html.match(/"like_count":(\d+)/);
    if (likeMatch) likes = parseInt(likeMatch[1]);

    const commentMatch = html.match(/"comment_count":(\d+)/);
    if (commentMatch) comments = parseInt(commentMatch[1]);

    const shareMatch = html.match(/"share_count":(\d+)/);
    if (shareMatch) shares = parseInt(shareMatch[1]);

    // Ekstrak waktu
    let timestamp = new Date().toISOString();
    const timeMatch = html.match(/"publish_time":(\d+)/);
    if (timeMatch) {
      timestamp = new Date(parseInt(timeMatch[1]) * 1000).toISOString();
    }

    // Cari image yang valid
    let finalImage = image;
    if (!finalImage || !isValidUrl(finalImage)) {
      const imgRegex = /"url":"(https:\/\/[^"]+\.(jpg|jpeg|png|gif))"/gi;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        const imgUrl = match[1].replace(/\\/g, '');
        if (!imgUrl.includes('profile') && !imgUrl.includes('logo') && isValidUrl(imgUrl)) {
          finalImage = imgUrl;
          break;
        }
      }
    }

    return {
      author: author,
      authorUrl: null,
      authorAvatar: null,
      description: description || (title !== author ? title : ''),
      image: isValidUrl(finalImage) ? finalImage : null,
      videoUrl: isValidUrl(videoUrl) ? videoUrl : null,
      isVideo: isVideo,
      likes: likes,
      comments: comments,
      shares: shares,
      timestamp: timestamp,
      platform: 'facebook',
      siteName: 'Facebook',
      url: url
    };

  } catch (error) {
    logger.logError(error, 'Facebook handler');
    return null;
  }
}

module.exports = { fetchData };