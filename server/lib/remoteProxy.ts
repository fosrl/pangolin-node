import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import axios from "axios";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import config from "@server/lib/config";
import { tokenManager } from "./tokenManager";

/**
 * Proxy function that forwards requests to the remote cloud server
 */

export const proxyToRemote = async (
    req: Request,
    res: Response,
    next: NextFunction,
    endpoint: string
): Promise<any> => {
    try {
        const remoteUrl = `${config.getRawConfig().managed?.endpoint?.replace(/\/$/, '')}/api/v1/${endpoint}`;

        logger.debug(`Proxying request to remote server: ${remoteUrl}`);

        // Forward the request to the remote server
        const response = await axios({
            method: req.method as any,
            url: remoteUrl,
            data: req.body,
            headers: {
                'Content-Type': 'application/json',
                ...(await tokenManager.getAuthHeader()).headers
            },
            params: req.query,
            timeout: 30000, // 30 second timeout
            validateStatus: () => true // Don't throw on non-2xx status codes
        });

        logger.debug(`Proxy response: ${JSON.stringify(response.data)}`);

        // Forward the response status and data
        return res.status(response.status).json(response.data);
        
    } catch (error) {
        logger.error("Error proxying request to remote server:", error);
        
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                return next(
                    createHttpError(
                        HttpCode.SERVICE_UNAVAILABLE,
                        "Remote server is unavailable"
                    )
                );
            }
            if (error.code === 'ECONNABORTED') {
                return next(
                    createHttpError(
                        HttpCode.REQUEST_TIMEOUT,
                        "Request to remote server timed out"
                    )
                );
            }
        }
        
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Error communicating with remote server"
            )
        );
    }
};