import { pipeline } from "@xenova/transformers";
import OpenAI from "openai";
import { OPENROUTER_API_KEY } from "../config.js";

export const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: { //for rankings in OpenAI leaderboard
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Brainlinks",
  }
});

let embeddingPipeline: any = null;

export const initEmbeddingModel = async () => {
  if (!embeddingPipeline) {
    console.log("Loading local embedding model (Xenova/all-MiniLM-L6-v2)...");
    try {
      embeddingPipeline = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );
      console.log("✅ Local embedding model loaded (384-dimensional)");
    } catch (error) {
      console.error("❌ Failed to load embedding model:", error);
      throw error;
    }
  }
  return embeddingPipeline;
};
