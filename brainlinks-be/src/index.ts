import express, {Request, Response} from "express"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import dotenv from "dotenv";
import { JWT_PASSWORD } from "./config"
import { hashgen } from "./hashgen"
import { z } from "zod"

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

    await ContentModel.create({
        link,
        title,
        type,
        //@ts-ignore
        userId: req.userId,
        tags: []
    })

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