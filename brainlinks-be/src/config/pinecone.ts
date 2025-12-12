import { Pinecone } from "@pinecone-database/pinecone";
import { PINECONE_INDEX } from "../config";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || ""
});

export const getPineconeIndex = async () => {
  try {
    const index = pinecone.Index(PINECONE_INDEX);
    return index;
  } catch (error) {
    console.error(" Error getting Pinecone index:", error);
    throw error;
  }
};

export const upsertToPinecone = async (
  contentId: string,
  embedding: number[],
  userId: string,
  metadata: {
    title: string;
    link: string;
    type: string;
  }
) => {
  try {
    const index = await getPineconeIndex();
    
    // Verify embedding is 384 dimensions
    if (embedding.length !== 384) {
      throw new Error(`Expected 384-dimensional embedding, got ${embedding.length}`);
    }

    await index.upsert([
      {
        id: contentId,
        values: embedding,
        metadata: {
          ...metadata,
          userId,
        },
      },
    ]);
    console.log(`✅ Upserted vector to Pinecone: ${contentId}`);
  } catch (error) {
    console.error(`❌ Error upserting to Pinecone: ${error}`);
    throw error;
  }
};

export const querySimilarVectors = async (
  embedding: number[],
  userId: string,
  topK: number = 5
) => {
  try {
    const index = await getPineconeIndex();
    const results = await index.query({
      vector: embedding,
      topK,
      filter: {
        userId: { $eq: userId },
      },
      includeMetadata: true,
    });
    return results;
  } catch (error) {
    console.error(` Error querying Pinecone: ${error}`);
    throw error;
  }
};

export default pinecone;
