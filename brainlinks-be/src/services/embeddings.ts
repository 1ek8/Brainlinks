import { pipeline } from "@xenova/transformers";
import OpenAI from "openai";
import { OPENROUTER_API_KEY } from "../config";

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
});

