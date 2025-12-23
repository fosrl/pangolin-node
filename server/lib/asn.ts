import logger from "@server/logger";
import axios from "axios";
import config from "./config";
import { tokenManager } from "./tokenManager";

export async function remoteGetASNForIp(
    ip: string
): Promise<number | undefined> {
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/asnip/${ip}`,
            await tokenManager.getAuthHeader()
        );

        return response.data.data.asn;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching config in verify session:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error fetching config in verify session:", error);
        }
    }

    return;
}
