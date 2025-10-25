import config from "@server/lib/config";
import { tokenManager } from "@server/lib/tokenManager";
import logger from "@server/logger";
import axios from "axios";
import { log } from "console";

/** 

Reasons:
100 - Allowed by Rule
101 - Allowed No Auth
102 - Valid Access Token
103 - Valid header auth
104 - Valid Pincode
105 - Valid Password
106 - Valid email
107 - Valid SSO

201 - Resource Not Found
202 - Resource Blocked
203 - Dropped by Rule
204 - No Sessions
205 - Temporary Request Token
299 - No More Auth Methods

 */

let logQueue: {
    timestamp: number;
    orgId: string | undefined;
    actorType: string | undefined;
    actor: string | undefined;
    actorId: string | undefined;
    metadata: string | null;
    action: boolean;
    resourceId: number | undefined;
    reason: number;
    location: string | undefined;
    originalRequestURL: string;
    scheme: string;
    host: string;
    path: string;
    method: string;
    ip: string | undefined;
    tls: boolean;
}[] = [];

async function getRetentionDays(orgId: string): Promise<number> {
    try {
        const response = await axios.get(
            `${
                config.getRawConfig().managed?.endpoint
            }/api/v1/hybrid/org/:orgId/get-retention-days`,
            await tokenManager.getAuthHeader()
        );
        return response.data.data.days;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching retention days:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error fetching retention days:", error);
        }
        return 0;
    }
}

async function sendQueuedLogs() {
    await axios.post(
        `${
            config.getRawConfig().managed?.endpoint
        }/api/v1/hybrid/org/:orgId/logs/batch`,
        {
            logs: logQueue
        },
        await tokenManager.getAuthHeader()
    );
}

export async function logRequestAudit(
    data: {
        action: boolean;
        reason: number;
        resourceId?: number;
        orgId?: string;
        location?: string;
        user?: { username: string; userId: string };
        apiKey?: { name: string | null; apiKeyId: string };
        metadata?: any;
        // userAgent?: string;
    },
    body: {
        path: string;
        originalRequestURL: string;
        scheme: string;
        host: string;
        method: string;
        tls: boolean;
        sessions?: Record<string, string>;
        headers?: Record<string, string>;
        query?: Record<string, string>;
        requestIp?: string;
    }
) {
    try {
        if (data.orgId) {
            const retentionDays = await getRetentionDays(data.orgId);
            if (retentionDays === 0) {
                // do not log
                return;
            }
        }

        let actorType: string | undefined;
        let actor: string | undefined;
        let actorId: string | undefined;

        const user = data.user;
        if (user) {
            actorType = "user";
            actor = user.username;
            actorId = user.userId;
        }
        const apiKey = data.apiKey;
        if (apiKey) {
            actorType = "apiKey";
            actor = apiKey.name || apiKey.apiKeyId;
            actorId = apiKey.apiKeyId;
        }

        // if (!actorType || !actor || !actorId) {
        //     logger.warn("logRequestAudit: Incomplete actor information");
        //     return;
        // }

        const timestamp = Math.floor(Date.now() / 1000);

        let metadata = null;
        if (metadata) {
            metadata = JSON.stringify(metadata);
        }

        const clientIp = body.requestIp
            ? (() => {
                  if (
                      body.requestIp.startsWith("[") &&
                      body.requestIp.includes("]")
                  ) {
                      // if brackets are found, extract the IPv6 address from between the brackets
                      const ipv6Match = body.requestIp.match(/\[(.*?)\]/);
                      if (ipv6Match) {
                          return ipv6Match[1];
                      }
                  }

                  // ivp4
                  // split at last colon
                  const lastColonIndex = body.requestIp.lastIndexOf(":");
                  if (lastColonIndex !== -1) {
                      return body.requestIp.substring(0, lastColonIndex);
                  }
                  return body.requestIp;
              })()
            : undefined;

        const payload = {
            timestamp,
            orgId: data.orgId,
            actorType,
            actor,
            actorId,
            metadata,
            action: data.action,
            resourceId: data.resourceId,
            reason: data.reason,
            location: data.location,
            // userAgent: data.userAgent, // TODO: add this
            // headers: data.body.headers,
            // query: data.body.query,
            originalRequestURL: body.originalRequestURL,
            scheme: body.scheme,
            host: body.host,
            path: body.path,
            method: body.method,
            ip: clientIp,
            tls: body.tls
        };

        logQueue.push(payload);

        if (logQueue.length >= 25) {
            await sendQueuedLogs();
            logQueue = [];
        }
    } catch (error) {
        logQueue = []; // clear queue on error to prevent buildup
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching retention days:", {
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
}
