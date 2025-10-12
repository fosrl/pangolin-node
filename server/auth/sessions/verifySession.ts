import { Request } from "express";
import { validateSessionToken, SESSION_COOKIE_NAME } from "@server/auth/sessions/app";

export async function verifySession(req: Request) {
    const res = await validateSessionToken(
        req.cookies[SESSION_COOKIE_NAME] ?? "",
    );
    return res;
}
