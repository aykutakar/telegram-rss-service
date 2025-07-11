import kv from '@vercel/kv';

// Store webhook configuration
export const storeWebhook = async (channel, url, secret) => {
  await kv.hset(`webhook:${channel}`, { url, secret });
};

// Trigger webhooks for new messages
export const triggerWebhooks = async (channels, combinedData) => {
  const webhookPromises = [];
  
  for (const channel of channels) {
    const webhookConfig = await kv.hgetall(`webhook:${channel}`);
    if (!webhookConfig || !webhookConfig.url) continue;
    
    // Find latest message for this channel
    const latestMessage = combinedData.messages
      .filter(m => m.channel === channel)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    
    if (latestMessage) {
      webhookPromises.push(
        fetch(webhookConfig.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Secret': webhookConfig.secret || ''
          },
          body: JSON.stringify({
            event: 'new_message',
            channel,
            message: latestMessage
          })
        })
      );
    }
  }
  
  await Promise.allSettled(webhookPromises);
};
