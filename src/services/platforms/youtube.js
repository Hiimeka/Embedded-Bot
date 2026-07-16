const axios = require('axios');
const logger = require('../../utils/logger');

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

function extractYoutubeId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchData(url) {
  try {
    const videoId = extractYoutubeId(url);
    
    // Gunakan oembed YouTube
    if (videoId) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const oembedResponse = await axios.get(oembedUrl, {
          timeout: 10000
        });

        if (oembedResponse.data) {
          const data = oembedResponse.data;
          
          // Ambil statistik dari API YouTube (opsional)
          let likes = 0;
          let comments = 0;
          try {
            const statsUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${process.env.YOUTUBE_API_KEY || ''}&part=statistics`;
            const statsResponse = await axios.get(statsUrl);
            if (statsResponse.data && statsResponse.data.items && statsResponse.data.items[0]) {
              const stats = statsResponse.data.items[0].statistics;
              likes = parseInt(stats.likeCount) || 0;
              comments = parseInt(stats.commentCount) || 0;
            }
          } catch (e) {
            // API key tidak tersedia, skip
          }

          return {
            author: cleanText(data.author_name) || 'YouTube',
            authorUrl: null,
            authorAvatar: null,
            description: cleanText(data.title) || 'YouTube Video',
            image: data.thumbnail_url || null,
            videoUrl: `https://www.youtube.com/embed/${videoId}`,
            isVideo: true,
            likes: likes,
            comments: comments,
            shares: 0,
            timestamp: new Date().toISOString(),
            platform: 'youtube',
            siteName: 'YouTube',
            url: url
          };
        }
      } catch (e) {
        logger.debug('Oembed failed, using HTML fallback');
      }
    }

    // Fallback: Open Graph
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    let title = $('meta[property="og:title"]').attr('content') || 'YouTube Video';
    const description = $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content');

    let author = 'YouTube';
    const channelMatch = $('meta[itemprop="name"]').attr('content');
    if (channelMatch) author = cleanText(channelMatch);

    return {
      author: author,
      authorUrl: null,
      authorAvatar: null,
      description: cleanText(title) || 'YouTube Video',
      image: isValidUrl(image) ? image : null,
      videoUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : null,
      isVideo: true,
      likes: 0,
      comments: 0,
      shares: 0,
      timestamp: new Date().toISOString(),
      platform: 'youtube',
      siteName: 'YouTube',
      url: url
    };

  } catch (error) {
    logger.logError(error, 'YouTube handler');
    return null;
  }
}

// Tambahkan cheerio untuk fallback
const cheerio = require('cheerio');

module.exports = { fetchData };