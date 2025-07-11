import { parseTelegramChannel } from './lib/parser';
import { generateRSS } from './lib/rssGenerator';
import { storeWebhook, triggerWebhooks } from './lib/webhooks';
import { combineFeeds } from './lib/feedCombiner';
import kv from '@vercel/kv';

const CACHE_TTL = 300; // 5 minutes

export default async (req, res) => {
  // Handle webhook registration
  if (req.method === 'POST' && req.query.webhook) {
    const { channel, url, secret } = req.body;
    await storeWebhook(channel, url, secret);
    return res.status(200).json({ success: true });
  }

  // Handle feed generation
  const channels = req.query.channel.split(',');
  const format = req.query.format || 'rss';
  const refresh = req.query.refresh === 'true'; // Manual refresh flag

  try {
    // Check cache first
    const cacheKey = `cache:${channels.join(',')}`;
    let cachedData = await kv.get(cacheKey);
    
    // Determine if we need to refresh
    let shouldRefresh = refresh;
    if (!cachedData) shouldRefresh = true;
    if (cachedData && (Date.now() - cachedData.timestamp) > CACHE_TTL * 1000) {
      shouldRefresh = true;
    }

    let combinedData;
    if (shouldRefresh) {
      // Refresh data from Telegram
      combinedData = await combineFeeds(channels);
      
      // Update cache
      await kv.set(cacheKey, {
        data: combinedData,
        timestamp: Date.now()
      }, { ex: CACHE_TTL * 2 }); // Cache longer than TTL
      
      // Trigger webhooks asynchronously
      triggerWebhooks(channels, combinedData).catch(console.error);
    } else {
      combinedData = cachedData.data;
    }
    
    // Return response
    if (format.toLowerCase() === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`);
      return res.send(JSON.stringify(combinedData, null, 2));
    } else {
      const rss = generateRSS(combinedData);
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`);
      return res.send(rss);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
