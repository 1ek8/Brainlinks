import express, {Request, Response} from "express"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import dotenv from "dotenv";
import { JWT_PASSWORD } from "./config"
import { hashgen } from "./hashgen"
import { z } from "zod"
import { initEmbeddingModel } from "./services/embeddings";
import { upsertToPinecone } from "./config/pinecone";
import { querySimilarVectors } from "./config/pinecone";
import { openRouter } from "./services/embeddings";

dotenv.config();

const MONGO_URL = process.env.MONGO_URL

if(!MONGO_URL) {
    throw new Error("MONGO_URL env undefined")
}

mongoose.connect(process.env.MONGO_URL!)
import { ContentModel, UserModel, LinkModel } from "./db"
import { ExitStatus } from "typescript"
import { userMiddleware } from "./middleware"

import cors from "cors";

const signupSchema = z.object({
    username: z.string().min(3).max(20),
    password: z.string().min(6)
});

const contentSchema = z.object({
    title: z.string().min(1),
    link: z.url().optional().or(z.literal('')),
    textContent: z.string().optional(),
    type: z.enum(["youtube", "twitter", "text"])
});

const app = express();
app.use(express.json())
app.use(cors());

app.post("/api/v1/signup", async (req: Request,res: Response) => {
    const parsedData = signupSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({ message: "Invalid input", errors: parsedData.error });
        return;
    }
    const { username, password } = parsedData.data;
    try{
        await UserModel.create({
            username,
            password
        })

        res.json("User Signed up")
    }catch(e){
        res.status(411).json({
            "message": e
        })
    }
})

app.post("/api/v1/signin", async (req: Request,res: Response) =>  {
    const parsedData = signupSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({ message: "Invalid input", errors: parsedData.error });
        return;
    }
    const { username, password } = parsedData.data;
    
    const existingUser = await UserModel.findOne({
        username,
        password
    })

    if(existingUser){
        const token = jwt.sign({
            id: existingUser._id
        }, JWT_PASSWORD)

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
    const { link, title, type, textContent } = parsedData.data;

    const newContent = await ContentModel.create({
        link,
        title,
        type,
        textContent,
        //@ts-ignore
        userId: req.userId,
        tags: []
    })

    try {
        const getEmbedding = await initEmbeddingModel();

        const textToEmbed = `${title} ${textContent || ""}`.trim(); 
        
        const output = await getEmbedding(textToEmbed, { pooling: 'mean', normalize: true });
        const embeddingArray = Array.from(output.data) as number[];

        await upsertToPinecone(
            newContent._id.toString(), 
            embeddingArray, 
            //@ts-ignore
            req.userId,
            { title, type, link: link || "" }
        );
    } catch (error) {
        console.error("Failed to vectorize:", error);
    }

    res.json({
        message: "DB: Content Added in Database"
    })
})

app.get("/api/v1/content", userMiddleware, async (req:Request, res:Response)=> {
    //@ts-ignore
    const userId = req.userId
    const content = await ContentModel.find({
        userId
    }).populate("userId", "username")

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
        }).populate("userId", "username");

        res.json({ content });
    } catch (error) {
        res.status(500).json({ message: "Semantic search failed" });
    }
});

app.get("/api/v1/content/title", userMiddleware, async (req: Request, res: Response) => {
    //@ts-ignore
    const userId = req.userId;
    const searchValue = req.query.searchValue;

    const content = await ContentModel.find({
        userId,
        link: {
            $regex: searchValue
        }
    }).populate("userId", "username")
    res.json({content})
})

app.delete("/api/v1/content", userMiddleware, async (req: Request, res: Response) => {
    const contentId = req.body.contentId;

    await ContentModel.deleteOne({
        contentId,
        //@ts-ignore
        userId: req.userId
    })
})

app.post("/api/v1/chat", userMiddleware, async (req: Request, res: Response) => {
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
        const completion = await openRouter.chat.completions.create({
            model: "meta-llama/llama-3-8b-instruct:free", // Free model for dev, can change later
            messages: [
                { 
                    role: "system", 
                    content: "You are an AI assistant for the 'Brainlinks' app. Answer the user's question using ONLY the provided context from their saved notes. If the answer is not in the context, say 'I cannot answer this based on your saved brainlinks.'\n\nContext:\n" + contextString 
                },
                { role: "user", content: query }
            ]
        });

        res.json({ answer: completion.choices[0].message.content });

    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ message: "Failed to generate answer" });
    }
});

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

app.get("api/v1/brain/:shareLink", async (req: Request, res: Response) => {
    const hash = req.params.shareLink;

    const link = await LinkModel.findOne({
        hash
    })

    if(!link){
        res.status(411).json({
            message: "The shareable link in the URL doesnt exist or has expired!"
        })
    return;
    }
    
    const content = await ContentModel.find({
        userId: link.userId    
    })

    console.log(link)

    const user = await UserModel.findOne({
        _id: link.userId
    })

    if(!user){
        res.status(411).json({
            message: "Link and its corresponding content is validated, however userId stored in these databases is not validated in the User Database"
        })

    return;
    }

    res.json({
        username: user.username,
        content
    })
})


app.listen(3000);   