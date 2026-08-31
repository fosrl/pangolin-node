import config from "@server/lib/config";
import { tokenManager } from "@server/lib/tokenManager";
import logger from "@server/logger";
import axios from "axios";

export async function logAccessAudit(data: {
    action: boolean;
    type: string;
    orgId: string;
    resourceId?: number;
    siteResourceId?: number;
    user?: { username: string; userId: string };
    apiKey?: { name: string | null; apiKeyId: string };
    metadata?: any;
    userAgent?: string;
    requestIp?: string;
}) {
    if (!config.getRawConfig().app.audit_logging_enabled) {
        return;
    }

    try {
        const endpoint = config.getRawConfig().managed?.endpoint;
        if (!endpoint) {
            logger.warn(
                "Cannot send access audit log: managed endpoint not configured"
            );
            return;
        }

        await axios.post(
            `${endpoint}/api/v1/hybrid/logs/access`,
            data,
            await tokenManager.getAuthHeader()
        );
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("logAccessAudit: Error sending access audit log:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error(
                "logAccessAudit: Error sending access audit log:",
                error
            );
        }
    }
}
