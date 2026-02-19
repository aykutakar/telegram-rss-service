import { load } from 'cheerio';

export const parseTelegramChannel = async (channel) => {
  try {
    const url = `https://t.me/s/${channel}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);
    const messages = [];

    $('.tgme_widget_message').each((i, el) => {
      const $el = $(el);
      
      const reactions = [];
      $el.find('.tgme_widget_message_reaction').each((i, reaction) => {
        reactions.push({
          emoticon: $(reaction).find('.reaction_emoji').text().trim(),
          count: parseInt($(reaction).find('.reaction_count').text().trim()) || 0
        });
      });

      // Null check ekle
      const messageData = {
        id: $el.attr('data-post') || null,
        date: $el.find('time').attr('datetime') || null,
        text: $el.find('.tgme_widget_message_text').html() || null,
        views: parseInt($el.find('.tgme_widget_message_views').text().replace(/\D/g, '')) || 0,
        reactions,
        media: {
          photo: $el.find('.tgme_widget_message_photo').attr('style')?.match(/url\('(.*?)'\)/)?.[1] || null,
          video: $el.find('.tgme_widget_message_video').attr('src') || null
        },
        author: {
          name: $el.find('.tgme_widget_message_owner_name').text().trim() || null,
          url: $el.find('.tgme_widget_message_owner_name').attr('href') || null
        }
      };

      if (messageData.id) {
        messages.push(messageData);
      }
    });

    return {
      success: true,
      channel,
      title: $('meta[property="og:title"]').attr('content') || null,
      description: $('meta[property="og:description"]').attr('content') || null,
      messageCount: messages.length,
      messages: messages.reverse()
    };

  } catch (error) {
    console.error(`Error parsing channel ${channel}:`, error.message);
    return {
      success: false,
      channel,
      error: error.message,
      messages: []
    };
  }
};
