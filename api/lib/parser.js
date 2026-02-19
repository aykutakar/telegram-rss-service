import { load } from 'cheerio';

export const parseTelegramChannel = async (channel) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://t.me/s/${channel}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);
    const messages = [];

    $('.tgme_widget_message').slice(-20).each((i, el) => {
      const $el = $(el);

      const reactions = [];
      $el.find('.tgme_widget_message_reaction').each((_, reaction) => {
        const emoticon = $(reaction).find('.reaction_emoji').text().trim();
        const count = parseInt($(reaction).find('.reaction_count').text().trim()) || 0;
        if (emoticon) reactions.push({ emoticon, count });
      });

      const messageData = {
        id: $el.attr('data-post') || null,
        date: $el.find('time').attr('datetime') || null,
        text: $el.find('.tgme_widget_message_text').text().trim() || null,
        html: $el.find('.tgme_widget_message_text').html() || null,
        views: parseInt(
          $el.find('.tgme_widget_message_views').text().replace(/\D/g, '')
        ) || 0,
        reactions,
        media: {
          photo: $el.find('.tgme_widget_message_photo')
            .attr('style')?.match(/url\(['"]?(.*?)['"]?\)/)?.[1] || null,
          video: $el.find('.tgme_widget_message_video').attr('src') || null
        },
        link: $el.find('.tgme_widget_message_date').attr('href') || null,
        author: {
          name: $el.find('.tgme_widget_message_owner_name').text().trim() || null,
          url: $el.find('.tgme_widget_message_owner_name').attr('href') || null
        }
      };

      if (messageData.id) messages.push(messageData);
    });

    return {
      success: true,
      channel,
      title: $('meta[property="og:title"]').attr('content') || channel,
      description: $('meta[property="og:description"]').attr('content') || null,
      image: $('meta[property="og:image"]').attr('content') || null,
      messageCount: messages.length,
      messages
    };

  } catch (error) {
    clearTimeout(timer);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        channel,
        error: 'Telegram timeout (8s)',
        messages: []
      };
    }

    return {
      success: false,
      channel,
      error: error.message,
      messages: []
    };
  }
};
