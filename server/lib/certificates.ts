import axios from "axios";
import { tokenManager } from "./tokenManager";
import logger from "@server/logger";
import config from "./config";

/**
 * Get valid certificates for the specified domains
 */
export async function getValidCertificatesForDomainsHybrid(domains: Set<string>): Promise<
    Array<{
        id: number;
        domain: string;
        wildcard: boolean | null;
        certFile: string | null;
        keyFile: string | null;
        expiresAt: number | null;
        updatedAt?: number | null;
    }>
> {
    if (domains.size === 0) {
        return [];
    }

    const domainArray = Array.from(domains);

    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/certificates/domains`,
            {
                params: {
                    domains: domainArray
                },
                headers: (await tokenManager.getAuthHeader()).headers
            }
        );

        if (response.status !== 200) {
            logger.error(
                `Failed to fetch certificates for domains: ${response.status} ${response.statusText}`,
                { responseData: response.data, domains: domainArray }
            );
            return [];
        }

        // logger.debug(
        //     `Successfully retrieved ${response.data.data?.length || 0} certificates for ${domainArray.length} domains`
        // );

        return response.data.data;
    } catch (error) {
        // pull data out of the axios error to log
        if (axios.isAxiosError(error)) {
            logger.error("Error getting certificates:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error getting certificates:", error);
        }
        return [];
    }
}

export async function getValidCertificatesForDomains(domains: Set<string>): Promise<
    Array<{
        id: number;
        domain: string;
        wildcard: boolean | null;
        certFile: string | null;
        keyFile: string | null;
        expiresAt: number | null;
        updatedAt?: number | null;
    }>
> {
    return []; // stub
}