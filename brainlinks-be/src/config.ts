import dotenv from "dotenv";
dotenv.config();

export const MONGO_URL = process.env.MONGO_URL || "";
export const JWT_PASSWORD = process.env.JWT_PASSWORD || "";
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
export const PINECONE_API_KEY = process.env.PINECONE_API_KEY || "";
export const PINECONE_INDEX = process.env.PINECONE_INDEX || "brainlinks";
export const PORT = process.env.PORT || 3000;