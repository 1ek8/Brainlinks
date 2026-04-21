import puppeteer from "puppeteer";
import { YoutubeTranscript } from "youtube-transcript";

export async function scrapeWebPage(url: string): Promise<string> {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        // Extract inner text from the body and clean up excessive whitespace
        const text = await page.evaluate(() => document.body.innerText);
        return text.replace(/\s+/g, ' ').trim().substring(0, 5000); // Limit to 5000 chars for context limits
    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        return "";
    } finally {
        if (browser) await browser.close();
    }
}

// Action 2: YouTube Transcript Fetcher
export async function getYoutubeTranscript(url: string): Promise<string> {
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        // Combine all transcript parts into a single paragraph
        const fullText = transcript.map(t => t.text).join(" ");
        return fullText.substring(0, 5000); // Limit size
    } catch (error) {
        console.error(`Failed to fetch YouTube transcript for ${url}:`, error);
        return "";
    }
}

// Action 3: Twitter Scraper (Bypassing login walls via Syndication API)
export async function getTweetText(url: string): Promise<string> {
    try {
        // Extract the tweet ID from the URL
        const match = url.match(/(?:status|statuses)\/(\d+)/);
        if (!match) return "";
        const tweetId = match[1];

        // Use Twitter's public syndication API (used for embedded tweets)
        const response = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}`);
        if (!response.ok) return "";
        
        const data = await response.json();
        return data.text || "";
    } catch (error) {
        console.error(`Failed to fetch tweet text for ${url}:`, error);
        return "";
    }
}