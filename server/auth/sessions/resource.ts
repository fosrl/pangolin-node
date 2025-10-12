import config from "@server/lib/config";
import axios from "axios";
import logger from "@server/logger";
import { tokenManager } from "@server/lib/tokenManager";
import { ResourceSession } from "@server/lib/types";

export const SESSION_COOKIE_NAME =
    config.getRawConfig().server.session_cookie_name;
export const SESSION_COOKIE_EXPIRES =
    1000 * 60 * 60 * config.getRawConfig().server.resource_session_length_hours;

export async function validateResourceSessionToken(
    token: string,
    resourceId: number
): Promise<ResourceSessionValidationResult> {
        try {
            const response = await axios.post(`${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/resource/${resourceId}/session/validate`, {
                token: token
            }, await tokenManager.getAuthHeader());
            return response.data.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                logger.error("Error validating resource session token in hybrid mode:", {
                    message: error.message,
                    code: error.code,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.config?.url,
                    method: error.config?.method
                });
            } else {
                logger.error("Error validating resource session token in hybrid mode:", error);
            }
            return { resourceSession: null };
        }
}

export function serializeResourceSessionCookie(
    cookieName: string,
    domain: string,
    token: string,
    isHttp: boolean = false,
    expiresAt?: Date
): string {
    const now = new Date().getTime();
    if (!isHttp) {
        if (expiresAt === undefined) {
            return `${cookieName}_s.${now}=${token}; HttpOnly; SameSite=Lax; Path=/; Secure; Domain=${domain}`;
        }
        return `${cookieName}_s.${now}=${token}; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}; Path=/; Secure; Domain=${domain}`;
    } else {
        if (expiresAt === undefined) {
            return `${cookieName}.${now}=${token}; HttpOnly; SameSite=Lax; Path=/; Domain=$domain}`;
        }
        return `${cookieName}.${now}=${token}; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}; Path=/; Domain=${domain}`;
    }
}

export function createBlankResourceSessionTokenCookie(
    cookieName: string,
    domain: string,
    isHttp: boolean = false
): string {
    if (!isHttp) {
        return `${cookieName}_s=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/; Secure; Domain=${domain}`;
    } else {
        return `${cookieName}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/; Domain=${domain}`;
    }
}

export type ResourceSessionValidationResult = {
    resourceSession: ResourceSession | null;
};


