import RSSParser from 'rss-parser';
import schedule from 'node-schedule';
import { Client, Events, GatewayIntentBits, TextChannel, EmbedBuilder, APIEmbed } from 'discord.js';
import axios from 'axios'
import dotenv from 'dotenv';

dotenv.config({});

const token = process.env.DISCORD_BOT_TOKEN!;
const rssFeedUrl = 'https://' + process.env.RSS_DOMAIN! + '/' + process.env.RSS_USERNAME! + '/rss';
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

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

const sendEmbed = (feed: any, message: any, channel: any) => {
    try {
        const latestItem = feed?.items[0];
        if (message.content !== `[Tweeted](${latestItem?.link?.replace('#m', '').replace(process.env.RSS_DOMAIN!, 'x.com')})`) {
            let embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setURL(latestItem?.link?.replace('#m', '').replace(process.env.RSS_DOMAIN!, 'x.com') as string)
                .setAuthor({ name: feed?.image?.title as string, iconURL: feed?.image?.url, url: `https://x.com/${process.env.RSS_USERNAME!}` })
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
                channel.send({ content: `[Tweeted](${latestItem?.link?.replace('#m', '').replace(process.env.RSS_DOMAIN!, 'x.com')})`, embeds: [embed as APIEmbed] });
            }
        }
    } catch (error) {
        console.error('Error sending Embed:', error);
    }
}

(async () => {
    client.on(Events.ClientReady, c => {
        console.log(`Ready! Logged in as ${c.user.tag}`);
        const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID!) as TextChannel;
        schedule.scheduleJob('*/10 * * * * *', () => {
            channel.messages.fetch({ limit: 1 }).then((messages: any) => {
                messages.map((message: any) => {
                    const feed: any = fetchRSSFeed(rssFeedUrl);
                    feed.then((feed: any) => {
                       sendEmbed(feed, message, channel);
                    })
                    .catch((error: any) => {
                        console.log('Error getting Feed:', error);
                    });
                })
            })
            .catch((error: any) => {
                console.log('Error fetching Discord Messages:', error);
            });
        });
    });
    client.login(token);
})();
