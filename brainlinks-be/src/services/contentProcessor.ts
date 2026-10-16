import { initEmbeddingModel } from "./embeddings.js";
import { upsertToPinecone } from "../config/pinecone.js";
import { getYoutubeTranscript, getTweetText } from "./scraper.js";
import { ContentModel } from "../db.js";

export async function processAndEmbedContent(contentDoc: any) {
    try {
        const stillExists = () => ContentModel.exists({
            _id: contentDoc._id,
            userId: contentDoc.userId
        });

        // The user may already have deleted the note before this job even
        // starts — skip the scrape/embed work entirely.
        if (!(await stillExists())) {
            console.log(`Skipping processing — content already deleted: ${contentDoc._id}`);
            return;
        }

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

        // Re-check right before the upsert: if the note was deleted while we
        // were scraping/embedding, writing the vector now would resurrect it
        // as an orphaned Pinecone ghost that still shows up in semantic search.
        if (!(await stillExists())) {
            console.log(`Skipping upsert — content deleted mid-processing: ${contentDoc._id}`);
            return;
        }

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