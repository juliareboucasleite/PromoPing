const request = new (require("rss-parser"))();

class YoutubeFeed {
  constructor(client) {
    this.client = client;
  }

  async checkyt() {
    try {
      this.client.database.ytData.all().then(async (data) => {
        const filteredData = data.filter((entry) => entry.ytchannel !== null);
        for (const entry of filteredData) {
          request.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${entry.ytchannel}`)
            .then(async (feed) => {
              if (!feed?.items[0]?.id) return;
              if (entry?.postedvids?.includes(feed?.items[0]?.id)) return;
              const channel = await this.client.channels?.fetch(entry.channel);
              if (!channel) return;
              const message = `Hey ${entry.ping ? "@everyone" : "Members"}, **${feed?.items[0]?.author}** just uploaded a new video! | **${feed?.items[0]?.title}**\n${feed?.items[0]?.link}`;
              channel.send({ content: message, allowedMentions: { parse: ["everyone"] } }).catch(() => {});
              entry?.postedvids?.push(feed?.items[0]?.id);
              await this.client.database.ytData.post(entry.id, entry);
            })
            .catch(() => {});
        }
      });
    } catch (_error) {
      return;
    }
  }
}

module.exports = YoutubeFeed;


