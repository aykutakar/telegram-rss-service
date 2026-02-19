import { kv } from '@vercel/kv';           // ✅ Named import
import { parseTelegramChannel } from '../lib/parser.js';
import { generateRSS } from '../lib/rssGenerator.js';
import { storeWebhook, triggerWebhooks } from '../lib/webhooks.js';
import { combineFeeds } from '../lib/feedCombiner.js';

const CACHE_TTL = 300; // 5 dakika

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ✅ WHATWG URL API (url.parse yerine)
  const url = new URL(req.url, `https://${req.headers.host}`);
  const params = url.searchParams;

  // Webhook kayıt
  if (req.method === 'POST' && params.get('webhook')) {
    try {
      const { channel, url: webhookUrl, secret } = req.body || {};
      if (!channel || !webhookUrl) {
        return res.status(400).json({ 
          error: 'channel ve url gerekli' 
        });
      }
      const result = await storeWebhook(channel, webhookUrl, secret);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ✅ Channel kontrolü
  const channelParam = params.get('channel') || req.query?.channel;
  
  if (!channelParam) {
    return res.status(400).json({
      success: false,
      error: 'channel parametresi gerekli',
      usage: {
        single: '/api?channel=dunyahaberlerim',
        multiple: '/api?channel=kanal1,kanal2',
        json: '/api?channel=kanal&format=json',
        rss: '/api?channel=kanal&format=rss',
        refresh: '/api?channel=kanal&refresh=true'
      }
    });
  }

  const channels = channelParam.split(',').map(c => c.trim()).filter(Boolean);
  const format = (params.get('format') || req.query?.format || 'rss').toLowerCase();
  const refresh = params.get('refresh') === 'true' || req.query?.refresh === 'true';

  // Kanal validasyonu
  const invalid = channels.find(c => !/^[a-zA-Z0-9_]+$/.test(c));
  if (invalid) {
    return res.status(400).json({
      success: false,
      error: `Geçersiz kanal adı: ${invalid}`
    });
  }

  // Max 5 kanal
  if (channels.length > 5) {
    return res.status(400).json({
      success: false,
      error: 'Maksimum 5 kanal desteklenir'
    });
  }

  try {
    const cacheKey = `cache:${channels.sort().join(',')}`;
    let combinedData = null;
    let fromCache = false;

    // ✅ Cache kontrol (KV hatası olsa bile çalışsın)
    if (!refresh) {
      try {
        const cached = await kv.get(cacheKey);
        if (cached && cached.data) {
          const age = Date.now() - (cached.timestamp || 0);
          if (age < CACHE_TTL * 1000) {
            combinedData = cached.data;
            fromCache = true;
            console.log(`Cache HIT: ${channels.join(',')}`);
          }
        }
      } catch (kvError) {
        console.warn('KV read error:', kvError.message);
      }
    }

    // Cache yoksa veya expired ise fetch et
    if (!combinedData) {
      console.log(`Fetching: ${channels.join(',')}`);
      combinedData = await combineFeeds(channels);

      // ✅ Cache'e kaydet
      try {
        await kv.set(cacheKey, {
          data: combinedData,
          timestamp: Date.now()
        }, { ex: CACHE_TTL * 2 });
      } catch (kvError) {
        console.warn('KV write error:', kvError.message);
      }

      // Webhook tetikle (async, beklemeden)
      triggerWebhooks(channels, combinedData).catch(err =>
        console.warn('Webhook error:', err.message)
      );
    }

    // ✅ Response
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`);
      return res.status(200).json({
        ...combinedData,
        fromCache
      });
    } else {
      const rss = generateRSS(combinedData);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`);
      return res.status(200).send(rss);
    }

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
