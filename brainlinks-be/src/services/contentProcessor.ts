import { initEmbeddingModel } from "./embeddings.js";
import { upsertToPinecone } from "../config/pinecone.js";
import { getYoutubeTranscript, getTweetText } from "./scraper.js";

export async function processAndEmbedContent(contentDoc: any) {
    try {
        console.log(`Starting background processing for: ${contentDoc.title}`);
        let scrapedContext = "";

        // Only the youtube/twitter scrapers run, and only on links that
        // already passed type-specific validation on save. Text notes are
        // embedded from the user's own title + note — we never fetch a
        // user-supplied URL for them.
        if (contentDoc.link) {
            if (contentDoc.type === "youtube") {
                scrapedContext = await getYoutubeTranscript(contentDoc.link);
            } else if (contentDoc.type === "twitter") {
                scrapedContext = await getTweetText(contentDoc.link);
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