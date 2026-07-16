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

async function fetchData(url) {
  try {
    const tweetId = url.match(/\/(?:status|statuses)\/(\d+)/);
    if (!tweetId) return null;
    
    const apiUrl = `https://api.vxtwitter.com/tweet/${tweetId[1]}`;
    
    const response = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.data) {
      const data = response.data;
      
      // Cek apakah ada video
      const isVideo = data.media_extended && data.media_extended.some(m => m.type === 'video');
      let videoUrl = null;
      let imageUrl = null;
      
      if (isVideo && data.media_extended) {
        const videoMedia = data.media_extended.find(m => m.type === 'video');
        if (videoMedia && videoMedia.url) {
          videoUrl = videoMedia.url;
        }
        if (videoMedia && videoMedia.thumbnail_url) {
          imageUrl = videoMedia.thumbnail_url;
        }
      } else if (data.media && data.media.media_url_https) {
        imageUrl = data.media.media_url_https;
      }

      return {
        author: data.user.name || 'Unknown',
        authorUrl: `https://twitter.com/${data.user.screen_name}`,
        authorAvatar: data.user.profile_image_url_https || null,
        description: cleanText(data.text).substring(0, 200),
        image: imageUrl || data.user.profile_image_url_https,
        videoUrl: isValidUrl(videoUrl) ? videoUrl : null,
        isVideo: isVideo,
        likes: data.likes || 0,
        comments: data.replies || 0,
        shares: data.retweets || 0,
        timestamp: data.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString(),
        platform: 'twitter',
        siteName: 'Twitter/X',
        url: url
      };
    }
    
    return null;
  } catch (error) {
    logger.logError(error, 'Twitter handler');
    return null;
  }
}

module.exports = { fetchData };