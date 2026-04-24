import { initEmbeddingModel } from "./embeddings.js";
import { upsertToPinecone } from "../config/pinecone.js";
import { scrapeWebPage, getYoutubeTranscript, getTweetText } from "./scraper.js";

export async function processAndEmbedContent(contentDoc: any) {
    try {
        console.log(`Starting background processing for: ${contentDoc.title}`);
        let scrapedContext = "";

        // Route to the correct scraper based on type
        if (contentDoc.link) {
            if (contentDoc.type === "youtube") {
                scrapedContext = await getYoutubeTranscript(contentDoc.link);
            } else if (contentDoc.type === "twitter") {
                scrapedContext = await getTweetText(contentDoc.link);
            } else {
                // Fallback for general web links if you add a 'website' type later
                scrapedContext = await scrapeWebPage(contentDoc.link);
            }
        }

        // Combine the user's title/text with the scraped context
        const combinedText = `
            Title: ${contentDoc.title}
            User Note: ${contentDoc.textContent || ""}
            Scraped Content: ${scrapedContext}
        `.trim();

        // Generate Embedding
        const getEmbedding = await initEmbeddingModel();
        const output = await getEmbedding(combinedText, { pooling: 'mean', normalize: true });
        const embeddingArray = Array.from(output.data) as number[];

        // Upsert to Pinecone
        await upsertToPinecone(
            contentDoc._id.toString(),
            embeddingArray,
            contentDoc.userId.toString(),
            { 
                title: contentDoc.title, 
                type: contentDoc.type, 
                link: contentDoc.link || "" 
            }
        );

        console.log(`Successfully embedded and indexed: ${contentDoc.title}`);
    } catch (error) {
        console.error(`Background processing failed for ${contentDoc._id}:`, error);
    }
}