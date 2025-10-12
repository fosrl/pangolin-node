import { ResponseT } from "@server/types/Response";
import { Response } from "express";

export const response = <T>(
    res: Response,
    { data, success, error, message, status }: ResponseT<T>,
) => {
    return res.status(status).send({
        data,
        success,
        error,
        message,
        status,
    });
};

export default response;
