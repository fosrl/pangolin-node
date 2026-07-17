import config from "@server/lib/config";
import axios from "axios";
import logger from "@server/logger";
import { tokenManager } from "@server/lib/tokenManager";
import { ResourceSession } from "@server/lib/types";

export async function validateResourceSessionToken(
    token: string,
    resourceId: number
): Promise<ResourceSessionValidationResult> {
    try {
        const response = await axios.post(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/resource/${resourceId}/session/validate`,
            {
                token: token
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
        return { resourceSession: null };
    }
}

export async function createAccessTokenResourceSession(
    resourceId: number,
    accessTokenId: string
): Promise<string | null> {
    try {
        const response = await axios.post(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/resource/${resourceId}/session/create-access-token`,
            {
                accessTokenId
            },
            await tokenManager.getAuthHeader()
        );
        return response.data.data?.cookie ?? null;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error(
                "Error creating access token resource session in hybrid mode:",
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
                "Error creating access token resource session in hybrid mode:",
                error
            );
        }
        return null;
    }
}

export type ResourceSessionValidationResult = {
    resourceSession: ResourceSession | null;
};
