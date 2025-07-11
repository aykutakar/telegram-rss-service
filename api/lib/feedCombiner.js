import { parseTelegramChannel } from './lib/parser.js';
import kv from '@vercel/kv';

export const getChannelData = async (channel) => {
  const cacheKey = `channel:${channel}`;
  const cached = await kv.get(cacheKey);
  
  if (cached) return cached;
  
  const data = await parseTelegramChannel(channel);
  await kv.set(cacheKey, data, { ex: 3600 }); // Cache for 1 hour
  return data;
};

export const combineFeeds = async (channels) => {
  const results = await Promise.all(
    channels
      .map(channel =>
        getChannelData(channel).catch(e => ({ channel, error: e.message }))
      )
  );

  const successfulFeeds = results.filter(r => !r.error);
  const failedChannels = results.filter(r => r.error).map(r => r.channel);
  
  // Combine messages from all channels
  const allMessages = successfulFeeds.flatMap(feed =>
    feed.messages.map(msg => ({
      ...msg,
      channel: feed.channel,
      channelTitle: feed.title
    }))
  );
  
  // Sort by date (newest first)
  allMessages.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return {
    title: `Combined Telegram Feed (${channels.join(', ')})`,
    description: `Aggregated feed from ${channels.length} channels`,
    link: `https://t.me/s/${channels[0]}`,
    channels: successfulFeeds.map(f => ({
      name: f.channel,
      title: f.title,
      messageCount: f.messages.length
    })),
    messages: allMessages,
    errors: failedChannels.length
      ? { count: failedChannels.length, channels: failedChannels }
      : null
  };
};
