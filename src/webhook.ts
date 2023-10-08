import RSSParser from 'rss-parser';
import schedule from 'node-schedule';
import { EmbedBuilder, WebhookClient } from 'discord.js';
import axios from 'axios'
import dotenv from 'dotenv';

dotenv.config({});

const discordWebhookUrl = process.env.DISCORD_WEBHOOK!;
const rssFeedUrl = 'https://' + process.env.RSS_DOMAIN! + '/' + process.env.RSS_USERNAME! + '/rss';
const webhook = new WebhookClient({url: discordWebhookUrl});

// const job = schedule.scheduleJob('*/10 * * * * *', () => {
//   runTask();
// });

(async () => {
  runTask();
})();

async function runTask() {
  // const feed = await fetchRSSFeed(rssFeedUrl);
  // await sendToWebhook(feed);
  
}

async function fetchRSSFeed(rssFeedUrl: string) {
  try {
    const response = await axios(rssFeedUrl);
    const parser = new RSSParser();
    const feed = await parser.parseString(await response.data);
    return feed;
  } catch (error) {
    console.error('Error fetching or delivering the RSS feed:', error);
  }
}

async function sendToWebhook(feed: any) {
  try {
    const latestItem = feed?.items[0];
    let embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setURL(latestItem?.link?.replace('#m', '').replace(process.env.RSS_DOMAIN!, 'x.com') as string)
      .setAuthor({ name: feed?.image?.title as string, iconURL: feed?.image?.url, url: `https://weenie.com/${process.env.RSS_USERNAME!}` })
      .setDescription(latestItem?.content
        ?.replace(/<\/(div|p|h[1-6])>/g, '$&\n\n') // Add double line break after closing tags for div, p, and heading tags
        ?.replace(/(<(br|\/li|\/ul|\/ol)>)+/g, '\n') // Replace br, closing li, closing ul, and closing ol tags with a newline
        .replace(/(<([^>]+)>)/gi, '') as string)
      .setTimestamp()
      .setFooter({ text: process.env.DISCORD_BOT_NAME!, iconURL: process.env.DISCORD_BOT_ICON! });



    if (latestItem?.content?.match('<img')) {
      const match = latestItem?.content?.match(/<img.*?src="(.*?)"/);
      embed = embed.setImage(match ? match[1] : '');
    }

    if (!latestItem?.title?.match('RT by')) {
      webhook.send({
        content: `[Tweeted](${latestItem?.link?.replace('#m', '').replace(process.env.RSS_DOMAIN!, 'x.com')})`,
        username: process.env.DISCORD_BOT_NAME!,
        avatarURL: process.env.DISCORD_BOT_ICON!,
        embeds: [embed]
      });
      console.log(embed);
      console.log('RSS feed delivered to Discord webhook successfully!');
    } else {
      webhook.send({
        content: `[Tweeted](${latestItem?.link?.replace('#m', '').replace(process.env.RSS_DOMAIN!, 'x.com')})`,
        username: process.env.DISCORD_BOT_NAME!,
        avatarURL: process.env.DISCORD_BOT_ICON!,
        embeds: [embed]
      });
      console.log('its a retweet');
    }
  } catch (error) {
    console.error('Error sending to Discord Webhook:', error);
  }
}
