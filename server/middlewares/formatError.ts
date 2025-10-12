import { ErrorRequestHandler, NextFunction, Response } from "express";
import ErrorResponse from "@server/types/ErrorResponse";
import HttpCode from "@server/types/HttpCode";
import logger from "@server/logger";
import config from "@server/lib/config";

export const errorHandlerMiddleware: ErrorRequestHandler = (
    error,
    req,
    res: Response<ErrorResponse>,
    next: NextFunction
) => {
    const statusCode = error.statusCode || HttpCode.INTERNAL_SERVER_ERROR;
    // if (process.env.ENVIRONMENT !== "prod") {
    //     logger.error(error);
    // }
    res?.status(statusCode).send({
        data: null,
        success: false,
        error: true,
        message: error.message || "Internal Server Error",
        status: statusCode,
        stack: process.env.ENVIRONMENT === "prod" ? null : error.stack,
    });
};
