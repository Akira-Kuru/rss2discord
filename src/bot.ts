import puppeteer from 'puppeteer';
import schedule from 'node-schedule';
import { Client, Events, GatewayIntentBits, TextChannel, EmbedBuilder, APIEmbed } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config({});

const token = process.env.DISCORD_BOT_TOKEN!;
const rssFeedUrl = 'https://' + process.env.RSS_DOMAIN! + '/' + process.env.RSS_USERNAME!;
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

async function fetchRSSFeed(rssFeedUrl: string) {
    let browser;
    try {
        console.log('Opening Browser');
        browser = await puppeteer.launch({
            headless: "new"
        });
        const page = await browser.newPage();
        // await page.goto(rssFeedUrl, { waitUntil: 'networkidle0' });
        await page.goto(rssFeedUrl);

        await page.waitForSelector('.timeline'); // Wait for timeline

        const timelineItems = await page.$$('.timeline > .timeline-item');

        let items = [];

        for (const item of timelineItems) {

            const tweetLink = await item.$('.tweet-link');
            const avatarUrl = await item.$('.avatar');
            const authorName = await item.$('.fullname');
            const userName = await item.$('.username');
            const contentText = await item.$('.tweet-content');
            const attachmentsContent = await item.$('.attachments');
            const dateContent = await item.$('.tweet-date a');
            const retweet = await item.$('.retweet-header') || null;

            const link = await page.evaluate(el => el?.href, tweetLink);
            const avatar = await page.evaluate(el => el?.src, avatarUrl);
            const author = await page.evaluate(el => el?.innerHTML, authorName);
            const user = await page.evaluate(el => el?.href, userName);
            const content = await page.evaluate(el => el?.outerHTML, contentText);
            const attachments = await page.evaluate(el => el?.outerHTML, attachmentsContent);
            const date = await page.evaluate(el => el?.title ,dateContent);
            const dateTime = new Date(Date.parse(date?.replace('·',',') as string));

            items.push({
                link,
                avatar,
                author,
                user,
                content,
                attachments,
                dateTime,
                retweet
            });
        }
        
        items = items.filter(item => item.retweet === null); // filter out items with retweet not null

        items.sort((a, b) => b.dateTime - a.dateTime);

        return items.slice(0, 1)[0]; // return the top two newest entries

    } catch (error) {
        console.error('Error fetching or processing data: ', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

const sendEmbed = (feed: any, message: any, channel: any) => {
    try {
        if (message.content !== `[Tweeted](${feed?.link?.replace('#m', '').replace(process.env.RSS_DOMAIN!, 'x.com')})`) {
            console.log('Sending Embed');
            let embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setURL(feed?.link?.replace('#m', '').replace(process.env.RSS_DOMAIN!, 'x.com') as string)
                .setAuthor({ name: feed?.author as string, iconURL: feed?.avatar, url: `https://x.com/${process.env.RSS_USERNAME!}` })
                .setDescription(feed?.content
                    ?.replace(/<\/(div|p|h[1-6])>/g, '$&\n\n') // Add double line break after closing tags for div, p, and heading tags
                    ?.replace(/(<(br|\/li|\/ul|\/ol)>)+/g, '\n') // Replace br, closing li, closing ul, and closing ol tags with a newline
                    .replace(/(<([^>]+)>)/gi, '') as string)
                .setTimestamp()
                .setFooter({ text: process.env.DISCORD_BOT_NAME!, iconURL: process.env.DISCORD_BOT_ICON! });

            if (feed?.attachments?.match('<img')) {
                const match = feed?.attachments?.match(/(?<=\/pic\/media%2F)(.*?)(?=\.jpg)/)[1];
                embed = embed.setImage(match ? `https://pbs.twimg.com/media/${match}?format=jpg` : '');
            }

            channel.send({ content: `[Tweeted](${feed?.link?.replace('#m', '').replace(process.env.RSS_DOMAIN!, 'x.com')})`, embeds: [embed as APIEmbed] });

            // if (!feed?.title?.match('RT by')) {
            //     channel.send({ content: `[Tweeted](${feed?.link?.replace('#m', '').replace(process.env.RSS_DOMAIN!, 'x.com')})`, embeds: [embed as APIEmbed] });
            // }
        }else{
            console.log('Nothing to send');
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
