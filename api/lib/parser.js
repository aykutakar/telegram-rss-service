import { load } from 'cheerio';
import fetch from 'node-fetch';

export const parseTelegramChannel = async (channel) => {
  const url = `https://t.me/s/${channel}`;
  const response = await fetch(url);
  const html = await response.text();
  
  const $ = load(html);
  const messages = [];

  $('.tgme_widget_message').each((i, el) => {
    const $el = $(el);
    
    // Extract reactions
    const reactions = [];
    $el.find('.tgme_widget_message_reaction').each((i, reaction) => {
      reactions.push({
        emoticon: $(reaction).find('.reaction_emoji').text().trim(),
        count: parseInt($(reaction).find('.reaction_count').text().trim()) || 0
      });
    });

    messages.push({
      id: $el.attr('data-post'),
      date: $el.find('time').attr('datetime'),
      text: $el.find('.tgme_widget_message_text').html(),
      views: parseInt($el.find('.tgme_widget_message_views').text().replace(/\D/g, '')) || 0,
      reactions,
      media: {
        photo: $el.find('.tgme_widget_message_photo').attr('style')?.match(/url\('(.*?)'\)/)?.[1],
        video: $el.find('.tgme_widget_message_video').attr('src')
      },
      author: {
        name: $el.find('.tgme_widget_message_owner_name').text().trim(),
        url: $el.find('.tgme_widget_message_owner_name').attr('href')
      }
    });
  });

  return {
    channel,
    title: $('meta[property="og:title"]').attr('content'),
    description: $('meta[property="og:description"]').attr('content'),
    messages: messages.reverse()
  };
};
