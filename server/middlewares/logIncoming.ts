import logger from "@server/logger";
import { NextFunction, Request, Response } from "express";

export function logIncomingMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { method, url, headers, body } = req;
    if (url.includes("/api/v1")) {
        logger.debug(`${method} ${url}`);
    }
    next();
}
