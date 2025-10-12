import { tokenManager } from "@server/lib/tokenManager";
import logger from "@server/logger";
import axios from "axios";
import config from "@server/lib/config";
import { Resource, ResourceAccessToken } from "@server/lib/types";

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
}> {
    try {
        const response = await axios.post(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/resource/access-token/verify`,
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
                "Error validating resource session token in hybrid mode:",
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
                "Error validating resource session token in hybrid mode:",
                error
            );
        }
        return { valid: false };
    }
}
