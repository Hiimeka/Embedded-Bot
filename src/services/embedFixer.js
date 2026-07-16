const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

// Import semua platform handlers
const platformHandlers = {
  facebook: require('./platforms/facebook'),
  twitter: require('./platforms/twitter'),
  instagram: require('./platforms/instagram'),
  reddit: require('./platforms/reddit'),
  tiktok: require('./platforms/tiktok'),
  youtube: require('./platforms/youtube'),
};

// Daftar pola URL untuk setiap platform
const platformPatterns = [
  {
    name: 'facebook',
    pattern: /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com)\/[^\s]+/,
    handler: platformHandlers.facebook
  },
  {
    name: 'twitter',
    pattern: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[^\s]+/,
    handler: platformHandlers.twitter
  },
  {
    name: 'instagram',
    pattern: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/[^\s]+/,
    handler: platformHandlers.instagram
  },
  {
    name: 'reddit',
    pattern: /(?:https?:\/\/)?(?:www\.)?(?:reddit\.com|redd\.it)\/[^\s]+/,
    handler: platformHandlers.reddit
  },
  {
    name: 'tiktok',
    pattern: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^\s]+\/video\/[^\s]+/,
    handler: platformHandlers.tiktok
  },
  {
    name: 'youtube',
    pattern: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+/,
    handler: platformHandlers.youtube
  }
];

// Fungsi utama untuk memproses tautan
async function processLink(url, message) {
  try {
    // Cari handler yang sesuai dengan URL
    for (const platform of platformPatterns) {
      if (platform.pattern.test(url)) {
        logger.info(`Processing ${platform.name} link: ${url}`);
        
        // Panggil handler platform
        const embedData = await platform.handler.fetchData(url);
        
        if (embedData) {
          return {
            platform: platform.name,
            embed: embedData,
            url: url
          };
        }
      }
    }
    
    // Jika tidak ada handler khusus, gunakan Open Graph fallback
    logger.info(`Using fallback for: ${url}`);
    const fallbackData = await fetchOpenGraphData(url);
    if (fallbackData) {
      return {
        platform: 'fallback',
        embed: fallbackData,
        url: url
      };
    }
    
    return null;
  } catch (error) {
    logger.logError(error, `Processing link: ${url}`);
    return null;
  }
}

// Fallback: Fetch Open Graph data dari website
async function fetchOpenGraphData(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || 'No title';
    const description = $('meta[property="og:description"]').attr('content') || 'No description';
    const image = $('meta[property="og:image"]').attr('content');
    const siteName = $('meta[property="og:site_name"]').attr('content') || 'Website';
    
    return {
      title: title,
      description: description,
      image: image,
      siteName: siteName,
      url: url,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.logError(error, `Fetching Open Graph for: ${url}`);
    return null;
  }
}

module.exports = { processLink, platformPatterns };