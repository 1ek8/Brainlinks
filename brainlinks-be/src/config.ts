import dotenv from "dotenv";
dotenv.config();

export const MONGO_URL = process.env.MONGO_URL || "";
export const JWT_PASSWORD = process.env.JWT_PASSWORD || "";
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
export const PINECONE_API_KEY = process.env.PINECONE_API_KEY || "";
export const PINECONE_INDEX = process.env.PINECONE_INDEX || "brainlinks";
export const PINECONE_HOST = process.env.PINECONE_HOST || "";
export const PORT = process.env.PORT || 3000;
export const NODE_ENV = process.env.NODE_ENV || "development";


const requiredVars = [
  "MONGO_URL",
  "JWT_PASSWORD",
  "OPENROUTER_API_KEY",
  "PINECONE_API_KEY",
  "PINECONE_HOST",
];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.warn(`⚠️  Missing environment variable: ${varName}`);
  }
}

console.log(`All configuration loaded for ${NODE_ENV} environment`);
