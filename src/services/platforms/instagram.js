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

// Extract data dari JSON Instagram
function extractInstagramData(html) {
  try {
    // Cari window._sharedData
    const sharedDataMatch = html.match(/<script[^>]*>window\._sharedData\s*=\s*({.*?});<\/script>/);
    if (sharedDataMatch) {
      try {
        const data = JSON.parse(sharedDataMatch[1]);
        const post = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
        if (post) {
          return {
            author: post.owner?.username || 'Unknown',
            authorUrl: `https://instagram.com/${post.owner?.username}`,
            authorAvatar: post.owner?.profile_pic_url || null,
            description: post.edge_media_to_caption?.edges?.[0]?.node?.text || '',
            image: post.display_url || null,
            videoUrl: post.video_url || null,
            isVideo: post.is_video || false,
            likes: post.edge_media_preview_like?.count || 0,
            comments: post.edge_media_to_comment?.count || 0,
            timestamp: post.taken_at_timestamp ? new Date(post.taken_at_timestamp * 1000).toISOString() : new Date().toISOString(),
            platform: 'instagram',
            siteName: 'Instagram'
          };
        }
      } catch (e) {
        logger.debug('Failed to parse sharedData');
      }
    }

    // Fallback: cari di JSON lain
    const jsonMatch = html.match(/<script[^>]*>window\.__additionalDataLoaded\s*\([^,]+,\s*({.*?})\);<\/script>/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const post = data?.graphql?.shortcode_media || data?.items?.[0];
        if (post) {
          return {
            author: post.owner?.username || post.user?.username || 'Unknown',
            authorUrl: post.owner ? `https://instagram.com/${post.owner.username}` : null,
            authorAvatar: post.owner?.profile_pic_url || null,
            description: post.caption || post.edge_media_to_caption?.edges?.[0]?.node?.text || '',
            image: post.display_url || post.display_src || null,
            videoUrl: post.video_url || post.video_versions?.[0]?.url || null,
            isVideo: post.is_video || false,
            likes: post.edge_media_preview_like?.count || post.like_count || 0,
            comments: post.edge_media_to_comment?.count || post.comment_count || 0,
            timestamp: post.taken_at_timestamp ? new Date(post.taken_at_timestamp * 1000).toISOString() : new Date().toISOString(),
            platform: 'instagram',
            siteName: 'Instagram'
          };
        }
      } catch (e) {
        logger.debug('Failed to parse additionalData');
      }
    }

    return null;
  } catch (error) {
    logger.logError(error, 'Extracting Instagram data');
    return null;
  }
}

async function fetchData(url) {
  // Metode utama: yt-dlp. Instagram sudah tidak lagi mengirim data post
  // (window._sharedData) ke request tanpa login, jadi scraping HTML biasa
  // hampir selalu gagal untuk mendapatkan video. yt-dlp menangani hal ini
  // dengan jauh lebih reliable.
  try {
    const available = await ytdlp.checkYtDlpAvailable();
    if (available) {
      const info = await ytdlp.getInfo(url);
      const embedData = ytdlp.infoToEmbedData(info, 'instagram', 'Instagram', url);
      if (embedData) {
        logger.info(`Instagram data via yt-dlp berhasil (video: ${embedData.isVideo})`);
        return embedData;
      }
    } else {
      logger.warning('yt-dlp tidak ditemukan di sistem, fallback ke scraping HTML (kurang reliable untuk Instagram)');
    }
  } catch (error) {
    logger.debug(`yt-dlp gagal untuk Instagram, fallback ke scraping: ${error.message}`);
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      timeout: 15000
    });

    const html = response.data;
    
    // Coba extract dari JSON
    let postData = extractInstagramData(html);
    
    if (postData) {
      return postData;
    }

    // Fallback: Open Graph
    const $ = cheerio.load(html);
    
    let title = $('meta[property="og:title"]').attr('content') || 'Instagram Post';
    let description = $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content');
    const type = $('meta[property="og:type"]').attr('content') || '';

    // Ekstrak author dari title
    let author = 'Unknown';
    if (title) {
      const match = title.match(/^(.+?) on Instagram/);
      if (match) author = cleanText(match[1]);
    }

    const isVideo = type.includes('video');
    let videoUrl = null;
    if (isVideo) {
      videoUrl = $('meta[property="og:video"]').attr('content') || 
                 $('meta[property="og:video:url"]').attr('content');
    }

    return {
      author: author,
      authorUrl: `https://instagram.com/${author.toLowerCase().replace(/\s/g, '')}`,
      authorAvatar: null,
      description: cleanText(description).substring(0, 200),
      image: isValidUrl(image) ? image : null,
      videoUrl: isValidUrl(videoUrl) ? videoUrl : null,
      isVideo: isVideo,
      likes: 0,
      comments: 0,
      timestamp: new Date().toISOString(),
      platform: 'instagram',
      siteName: 'Instagram'
    };

  } catch (error) {
    logger.logError(error, 'Instagram handler');
    return null;
  }
}

module.exports = { fetchData };