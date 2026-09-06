import { NextFunction, Request, Response } from "express";
import jwt, { Jwt } from "jsonwebtoken"

import { JWT_PASSWORD } from "./config.js";
import { MiddlewareOptions } from "mongoose";

export const userMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers["authorization"];

    if (!header) {
        res.status(403).json({ message: "You aren't logged in" });
        return;
    }

    try {
        const decoded = jwt.verify(header as string, JWT_PASSWORD);

        if(decoded){
            //@ts-ignore    
            req.userId = decoded.id;
            next() 
        } else {
            res.status(403).json({
                message: "You arent logged in"
            })
        }

    } catch (error) {
        res.status(403).json({ message: "Invalid or expired token" });
    }

}