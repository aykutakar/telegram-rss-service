import RSS from 'rss';

export const generateRSS = (combinedData) => {
  const feed = new RSS({
    title: combinedData.title,
    description: combinedData.description,
    feed_url: `https://your-domain.com/api?channel=${combinedData.channels.map(c => c.name).join(',')}`,
    site_url: combinedData.link,
    language: 'en',
  });

  combinedData.messages.forEach(message => {
    let description = `
      <div><strong>Channel:</strong> ${message.channelTitle} (${message.channel})</div>
      <div>${message.text || ''}</div>
    `;
    
    // Add media
    if (message.media.photo) {
      description += `<img src="${message.media.photo}" alt="Media">`;
    }
    if (message.media.video) {
      description += `<video controls src="${message.media.video}" width="300"></video>`;
    }
    
    // Add stats
    description += `
      <div>
        <strong>Stats:</strong>
        👁️ ${message.views} views | 
        ${message.reactions.map(r => `${r.emoticon} ${r.count}`).join(' ')}
      </div>
    `;

    feed.item({
      title: `[${message.channel}] ${message.text?.substring(0, 50)}...`,
      description,
      url: `https://t.me/${message.id}`,
      date: message.date,
      guid: message.id,
      author: message.author.name
    });
  });

  return feed.xml({ indent: true });
};
