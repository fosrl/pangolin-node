import { tokenManager } from "@server/lib/tokenManager";
import logger from "@server/logger";
import axios from "axios";
import config from "@server/lib/config";
import {
    AccessTokenUserData,
    Resource,
    ResourceAccessToken
} from "@server/lib/types";

export async function verifyResourceAccessToken({
    accessToken,
    accessTokenId,
    resourceId
}: {
    accessToken: string;
    accessTokenId?: string;
    resourceId?: number; // IF THIS IS NOT SET, THE TOKEN IS VALID FOR ALL RESOURCES
}): Promise<{
    valid: boolean;
    error?: string;
    tokenItem?: ResourceAccessToken;
    resource?: Resource;
    userData?: AccessTokenUserData;
}> {
    try {
        const path = resourceId
            ? `resource/${resourceId}/access-token/verify`
            : `resource/access-token/verify`;
        const response = await axios.post(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/${path}`,
            {
                accessToken: accessToken,
                accessTokenId: accessTokenId,
                resourceId: resourceId
            },
            await tokenManager.getAuthHeader()
        );
        return response.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error(
                "Error validating resource access token in hybrid mode:",
                {
                    message: error.message,
                    code: error.code,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.config?.url,
                    method: error.config?.method
                }
            );
        } else {
            logger.error(
                "Error validating resource access token in hybrid mode:",
                error
            );
        }
        return { valid: false };
    }
}

export async function getResourceAccessToken(accessTokenId: string): Promise<{
    tokenItem?: ResourceAccessToken;
    userData?: AccessTokenUserData;
} | null> {
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/resource/access-token/${accessTokenId}`,
            await tokenManager.getAuthHeader()
        );
        return response.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error getting resource access token in hybrid mode:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error(
                "Error getting resource access token in hybrid mode:",
                error
            );
        }
        return null;
    }
}
