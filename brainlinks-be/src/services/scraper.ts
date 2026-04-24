import puppeteer from "puppeteer";

// Action 1: Generic Web Scraper using Puppeteer
export async function scrapeWebPage(url: string): Promise<string> {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const text = await page.evaluate(() => document.body.innerText);
        return text.replace(/\s+/g, ' ').trim().substring(0, 5000);
    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        return "";
    } finally {
        if (browser) await browser.close();
    }
}

// Action 2: Native YouTube Transcript Fetcher (No NPM package needed)
export async function getYoutubeTranscript(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        const html = await response.text();
        
        // Extract the hidden JSON containing transcript data
        const regex = /"captions":({.*?})},"videoDetails"/;
        const match = html.match(regex);
        
        if (!match) return "No transcript available.";
        
        const captionsJson = JSON.parse(match[1]);
        const trackUrl = captionsJson?.playerCaptionsTracklistRenderer?.captionTracks?.[0]?.baseUrl;
        
        if (!trackUrl) return "No transcript available.";
        
        // Fetch the actual XML transcript
        const transcriptResponse = await fetch(trackUrl);
        const transcriptXml = await transcriptResponse.text();
        
        // Strip XML tags to get raw text
        const rawText = transcriptXml
            .replace(/<[^>]*>/g, ' ')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
            
        return rawText.substring(0, 5000);
    } catch (error) {
        console.error(`Failed to fetch YouTube transcript for ${url}:`, error);
        return "";
    }
}

// Action 3: Twitter Scraper
export async function getTweetText(url: string): Promise<string> {
    try {
        const match = url.match(/(?:status|statuses)\/(\d+)/);
        if (!match) return "";
        const tweetId = match[1];
        
        const response = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}`);
        if (!response.ok) return "";
        
        const data = await response.json();
        return data.text || "";
    } catch (error) {
        console.error(`Failed to fetch tweet text for ${url}:`, error);
        return "";
    }
}