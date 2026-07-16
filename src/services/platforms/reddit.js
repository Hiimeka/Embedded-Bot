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
    const jsonUrl = url.includes('?') ? `${url}&.json` : `${url}.json`;
    
    const response = await axios.get(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (response.data && response.data[0] && response.data[0].data) {
      const post = response.data[0].data.children[0]?.data;
      
      if (post) {
        // Cek apakah ada video
        const isVideo = post.is_video || 
                       (post.media && post.media.reddit_video) ||
                       (post.url && post.url.includes('.mp4'));
        let videoUrl = null;
        
        if (post.media && post.media.reddit_video) {
          videoUrl = post.media.reddit_video.fallback_url;
        } else if (isVideo && post.url && post.url.includes('.mp4')) {
          videoUrl = post.url;
        }

        // Cek apakah ada gambar
        let imageUrl = null;
        if (post.url && !post.url.includes('.mp4') && !post.url.includes('youtube')) {
          if (post.url.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
            imageUrl = post.url;
          }
        }
        if (!imageUrl && post.thumbnail && post.thumbnail.startsWith('http')) {
          imageUrl = post.thumbnail;
        }

        return {
          author: post.author || 'Unknown',
          authorUrl: `https://reddit.com/user/${post.author}`,
          authorAvatar: null,
          description: cleanText(post.title || 'Reddit Post'),
          image: isValidUrl(imageUrl) ? imageUrl : null,
          videoUrl: isValidUrl(videoUrl) ? videoUrl : null,
          isVideo: isVideo,
          likes: post.score || 0,
          comments: post.num_comments || 0,
          shares: 0,
          timestamp: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString(),
          platform: 'reddit',
          siteName: `r/${post.subreddit}`,
          url: `https://reddit.com${post.permalink}`
        };
      }
    }
    
    return null;
  } catch (error) {
    logger.logError(error, 'Reddit handler');
    return null;
  }
}

module.exports = { fetchData };