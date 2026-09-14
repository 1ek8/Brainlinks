import { NextFunction, Request, Response } from "express";

export type AsyncRoute = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<unknown>;

// Express 4 does not forward rejected promises from async handlers to an error
// middleware — a rejected handler leaves the request hanging with no response.
// Wrapping every async handler routes rejections into Express's error pipeline.
export const asyncHandler =
    (fn: AsyncRoute) =>
    (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

// Final error middleware: anything thrown (or rejected) anywhere ends up here, so
// the client always gets a JSON response instead of a hanging request.
export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    console.error(`Error [${req.method}] ${req.originalUrl}:`, err);
    res.status(500).json({ message: "An unexpected error occurred. Please try again." });
};

// Catch-all so unknown routes return JSON, not Express's default HTML 404.
export const notFound = (req: Request, res: Response): void => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};