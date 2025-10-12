import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";

export function unauthorized(msg?: string) {
    return createHttpError(HttpCode.UNAUTHORIZED, msg || "Unauthorized");
}
