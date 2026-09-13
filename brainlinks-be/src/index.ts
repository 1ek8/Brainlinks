import express, {Request, Response} from "express"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import rateLimit from "express-rate-limit"
import dotenv from "dotenv";
import { JWT_PASSWORD, PORT } from "./config.js"
import { hashgen } from "./hashgen.js"
import { z } from "zod"
import { initEmbeddingModel } from "./services/embeddings.js";
import { querySimilarVectors } from "./config/pinecone.js";
import { deleteFromPinecone } from "./config/pinecone.js";
import { openRouter } from "./services/embeddings.js";
import { processAndEmbedContent } from "./services/contentProcessor.js";

dotenv.config();

const MONGO_URL = process.env.MONGO_URL

if(!MONGO_URL) {
    throw new Error("MONGO_URL env undefined")
}

mongoose.connect(process.env.MONGO_URL!)
import { ContentModel, UserModel, LinkModel, TagModel } from "./db.js"
import { userMiddleware } from "./middleware.js"

import cors from "cors";

const signupSchema = z.object({
    username: z.string().min(3).max(20),
    password: z.string().min(6)
});

const contentSchema = z.object({
    title: z.string().min(1),
    link: z.url().optional().or(z.literal('')),
    textContent: z.string().optional(),
    type: z.enum(["youtube", "twitter", "text"]),
    tags: z.array(z.string().min(1).max(30)).optional()
});

// Mirrors the FE embed/preview URL patterns so a note's link matches its type.
const YOUTUBE_URL_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/|playlist\?list=))[\w-]+/;
const TWITTER_URL_RE = /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/;

const isLinkValidForType = (type: string, link?: string): boolean => {
    if (type === "text") return true;
    if (!link) return false;
    if (type === "youtube") return YOUTUBE_URL_RE.test(link);
    if (type === "twitter") return TWITTER_URL_RE.test(link);
    return true;
};

const resolveTagIds = async (userId: string, names: string[] = []): Promise<string[]> => {
    const ids: string[] = [];
    for (const raw of names) {
        const name = raw.trim().replace(/\s+/g, " ").slice(0, 30);
        if (!name) continue;
        const tag = await TagModel.findOneAndUpdate(
            { name, userId },
            { $setOnInsert: { name, userId } },
            { upsert: true, new: true }
        );
        ids.push(tag._id.toString());
    }
    return ids;
};

// Client IP for rate-limit keys. Trusting the FIRST X-Forwarded-For entry is a
// bypass: the *.run.app origin is public, so an attacker can hit it directly and
// forge an arbitrary first entry to rotate keys and dodge the auth limiter.
// Every request (via Cloudflare worker or direct) passes Google's front end, which
// APPENDS the real immediate peer as the LAST entry — that entry can never be
// spoofed by the caller. For proxied traffic it is Cloudflare's egress IP; for
// direct traffic it's the actual client (or, absent any XFF, the socket peer).
// All legitimate traffic uses the branded URLs through the worker, so nobody is
// throttled wrongly, and spoofing the chain no longer buys a limiter bypass.
const clientIp = (req: Request): string => {
    const xff = req.headers["x-forwarded-for"];
    const chain = (Array.isArray(xff) ? xff.join(",") : xff ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    return chain[chain.length - 1] || req.socket?.remoteAddress || "unknown";
};

// Generic limiter for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 20,           // max 20 requests/minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => clientIp(req),
    message: { message: "Too many authentication attempts. Please slow down." }
});

// Chat hits a paid external LLM (OpenRouter), so limit harder to avoid token burnout.
// Keyed by the authenticated userId so one user can't drain the quota via the API.
const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10, // max 10 chat requests/minute per user
    keyGenerator: (req: Request) => {
        return (req as any).userId?.toString() || clientIp(req);
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many chat requests. Please wait a moment and try again." }
});

const FRONTEND_URL = process.env.FRONTEND_URL || "*";

const app = express();
app.set("trust proxy", true);
app.use(express.json())
app.use(cors({
    origin: FRONTEND_URL === "*" ? "*" : FRONTEND_URL.split(","),
    credentials: true
}));

app.get("/", (req: Request, res: Response) => {
    res.json({ status: "ok" })
});

app.post("/api/v1/signup", authLimiter, async (req: Request,res: Response) => {
    const parsedData = signupSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({ message: "Invalid input", errors: parsedData.error });
        return;
    }
    const { username, password } = parsedData.data;
    const hashedPassword = await bcrypt.hash(password, 10);
    try{
        await UserModel.create({
            username,
            password: hashedPassword
        })

        res.json("User Signed up")
    }catch(e: any){
        if (e && e.code === 11000) {
            res.status(409).json({
                message: "Username already taken"
            })
            return;
        }
        console.error("Signup error:", e)
        res.status(500).json({
            "message": "An unexpected error occurred. Please try again."
        })
    }
})

app.post("/api/v1/signin", authLimiter, async (req: Request,res: Response) =>  {
    const parsedData = signupSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({ message: "Invalid input", errors: parsedData.error });
        return;
    }
    const { username, password } = parsedData.data;
    
    const existingUser = await UserModel.findOne({
        username
    })

    const storedPassword = existingUser?.password;
    const isBcrypt = !!storedPassword && storedPassword.startsWith("$2");

    let passwordMatches: boolean;
    if (!existingUser || !storedPassword) {
        passwordMatches = false;
    } else if (isBcrypt) {
        passwordMatches = await bcrypt.compare(password, storedPassword);
    } else {
        // Legacy plaintext password — compare directly, then upgrade to a hash
        // on success so the stored credential is hashed from now on.
        passwordMatches = password === storedPassword;
        if (passwordMatches) {
            existingUser.password = await bcrypt.hash(password, 10);
            await existingUser.save();
        }
    }

    if(existingUser && passwordMatches){
        const token = jwt.sign({
            id: existingUser._id
        }, JWT_PASSWORD, {
            expiresIn: "7d"
        })

        res.json({token})
    }
    else{
        res.status(403).json({
            message: "Incorrect Credentials"
        })
    }
})

app.post("/api/v1/content", userMiddleware, async (req: Request,res: Response) => {
    const parsedData = contentSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({ message: "Invalid inputs", errors: parsedData.error });
        return;
    }
    const { link, title, type, textContent, tags } = parsedData.data;

    if (type !== "text" && !isLinkValidForType(type, link)) {
        const msg = type === "youtube"
            ? "Link doesn't look like a valid YouTube URL."
            : "Link doesn't look like a valid tweet URL.";
        res.status(400).json({ message: msg });
        return;
    }

    //@ts-ignore
    const userId = req.userId;

    const tagIds = await resolveTagIds(String(userId), tags);

    const newContent = await ContentModel.create({
        link,
        title,
        type,
        textContent,
        tags: tagIds,
        userId
    })

    processAndEmbedContent(newContent).catch(err => {
        console.error("Unhandled error in background processor:", err);
    });

    res.json({
        message: "Content Added successfully. Context processing in the background." 
    })
})

app.get("/api/v1/content", userMiddleware, async (req:Request, res:Response)=> {
    //@ts-ignore
    const userId = req.userId
    const content = await ContentModel.find({
        userId
    }).populate("userId", "username").populate("tags", "name")

    res.json({
        content
    })
})

app.get("/api/v1/content/search", userMiddleware, async (req: Request, res: Response) => {
    
    //@ts-ignore
    const userId = req.userId;
    const query = req.query.q as string;

    if (!query) {
        res.status(400).json({ message: "Search query required" });
        return;
    }

    try {
        const getEmbedding = await initEmbeddingModel();
        const output = await getEmbedding(query, { pooling: 'mean', normalize: true });
        const queryEmbedding = Array.from(output.data) as number[];

        // Query Pinecone for top 5 matches
        const searchResults = await querySimilarVectors(queryEmbedding, userId, 5);
        
        const matchedIds = searchResults.matches.map((match: any) => match.id);

        const content = await ContentModel.find({
            _id: { $in: matchedIds }
        }).populate("userId", "username").populate("tags", "name");

        res.json({ content });
    } catch (error) {
        res.status(500).json({ message: "Semantic search failed" });
    }
});

app.get("/api/v1/content/title", userMiddleware, async (req: Request, res: Response) => {
    //@ts-ignore
    const userId = req.userId;
    const searchValue = req.query.searchValue as string;

    if (!searchValue) {
        res.status(400).json({ message: "searchValue query param is required" });
        return;
    }

    // Escape regex metacharacters so user input can't break/inject the query
    const escaped = searchValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const content = await ContentModel.find({
        userId,
        title: {
            $regex: escaped,
            $options: "i" // case-insensitive substring match on the title
        }
    }).populate("userId", "username").populate("tags", "name")
    res.json({content})
})

app.patch("/api/v1/content/:id", userMiddleware, async (req: Request, res: Response) => {
    const contentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        res.status(400).json({ message: "Invalid contentId" });
        return;
    }

    const parsedData = contentSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({ message: "Invalid inputs", errors: parsedData.error });
        return;
    }

    const { link, title, type, textContent, tags } = parsedData.data;

    if (type !== "text" && !isLinkValidForType(type, link)) {
        const msg = type === "youtube"
            ? "Link doesn't look like a valid YouTube URL."
            : "Link doesn't look like a valid tweet URL.";
        res.status(400).json({ message: msg });
        return;
    }

    //@ts-ignore
    const userId = req.userId;
    const tagIds = await resolveTagIds(String(userId), tags);

    const updated = await ContentModel.findOneAndUpdate(
        { _id: contentId, userId },
        { title, link, type, textContent, tags: tagIds },
        { new: true }
    );

    if (!updated) {
        res.status(404).json({ message: "Content not found" });
        return;
    }

    // Upsert by _id is idempotent in Pinecone, so re-embedding the edited note is safe.
    processAndEmbedContent(updated).catch(err =>
        console.error("Unhandled error re-embedding content:", err)
    );

    res.json({ message: "Content updated", content: updated });
})

app.delete("/api/v1/content", userMiddleware, async (req: Request, res: Response) => {
    const contentId = req.body.contentId;

    if (!contentId) {
        res.status(400).json({ message: "contentId is required" });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        res.status(400).json({ message: "Invalid contentId" });
        return;
    }

    const result = await ContentModel.deleteOne({
        _id: contentId,
        //@ts-ignore
        userId: req.userId
    });

    if (result.deletedCount > 0) {
        deleteFromPinecone(contentId).catch(err =>
            console.error("Unhandled error deleting from Pinecone:", err)
        );
    }

    res.json({ message: "Content deleted" });
})

app.post("/api/v1/chat", userMiddleware, chatLimiter, async (req: Request, res: Response) => {
    const query = req.body.query as string;
    //@ts-ignore
    const userId = req.userId;

    if (!query) {
        res.status(400).json({ message: "Query is required" });
        return;
    }

    try {
        // 1. Embed user's question
        const getEmbedding = await initEmbeddingModel();
        const output = await getEmbedding(query, { pooling: 'mean', normalize: true });
        const queryEmbedding = Array.from(output.data) as number[];

        // 2. Query Pinecone for 5 most relevant documents
        const searchResults = await querySimilarVectors(queryEmbedding, userId, 5);
        const matchedIds = searchResults.matches.map((match: any) => match.id);

        // 3. Fetch the full content from MongoDB
        const content = await ContentModel.find({ _id: { $in: matchedIds } });

        // 4. Construct the context string
        const contextString = content.map(c => 
            `Title: ${c.title}\nType: ${c.type}\nLink: ${c.link || 'N/A'}\nContent: ${c.textContent || 'N/A'}`
        ).join("\n\n---\n\n");

        // 5. Ask OpenRouter to answer using ONLY the context
        const MODELS = [
            "nvidia/nemotron-3-super-120b-a12b:free",
            "google/gemma-4-26b-a4b-it:free",
            "google/gemma-4-31b-it:free"
        ];
        let answer: string | null = null;
        let lastError: any = null;
        for (const model of MODELS) {
            try {
                const completion = await openRouter.chat.completions.create({
                    model,
                    messages: [
                        { 
                            role: "system", 
                            content: "You are an AI assistant for the 'Brainlinks' app. Answer the user's question using ONLY the provided context from their saved notes. If the answer is not in the context, say 'I cannot answer this based on your current brain state.'\n\nContext:\n" + contextString 
                        },
                        { role: "user", content: query }
                    ]
                });
                answer = completion.choices[0].message.content;
                break;
            } catch (e: any) {
                lastError = e;
                console.error(`Chat model ${model} failed:`, e.error || e.message);
            }
        }
        if (!answer) {
            throw lastError || new Error("All models failed");
        }

        res.json({ answer });

    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ message: "Failed to generate answer" });
    }
});

app.get("/api/v1/brain/share", userMiddleware, async (req: Request, res: Response) => {
    //@ts-ignore
    const link = await LinkModel.findOne({ userId: req.userId });
    res.json({ hash: link?.hash || null });
})

app.post("/api/v1/brain/share", userMiddleware, async (req: Request, res: Response) => {
    const share = req.body.share;
    if(share){
    //need to look up if return statement after if-if block's end is really necessary
        const existingLink = await LinkModel.findOne({
            //@ts-ignore
            userId: req.userId
        })

        if(existingLink){
            res.json({
                hash: existingLink.hash
            })
            return;
        }
        const hash = hashgen(10)
        await LinkModel.create({
            //@ts-ignore
            userId: req.userId,
            hash
        })

        res.json({
            hash
        })
        return;
    }
    else{
        await LinkModel.deleteOne({
            //@ts-ignore
            userId: req.userId
        })
    
        res.json({
            message: "Removed link"
        })
    }
    
})

app.get("/api/v1/brain/:shareLink", async (req: Request, res: Response) => {
    const hash = req.params.shareLink;

    const link = await LinkModel.findOne({
        hash
    })

    if(!link){
        res.status(404).json({
            message: "The shareable link in the URL doesnt exist or has expired!"
        })
    return;
    }
    
    const content = await ContentModel.find({
        userId: link.userId    
    }).populate("tags", "name")

    const user = await UserModel.findOne({
        _id: link.userId
    })

    if(!user){
        res.status(404).json({
            message: "Link and its corresponding content is validated, however userId stored in these databases is not validated in the User Database"
        })

    return;
    }

    res.json({
        username: user.username,
        content
    })
})


app.listen(Number(PORT), () => {
    console.log(`Server running on port ${PORT}`);
});   