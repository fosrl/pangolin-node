import axios from "axios";
import logger from "@server/logger";
import { config } from "../config";

interface ExitNodeRequest {
    remoteType?: string;
    localPath: string;
    method?: "POST" | "DELETE" | "GET" | "PUT";
    data?: any;
    queryParams?: Record<string, string>;
}

/**
 * Sends a request to an exit node, handling both remote and local exit nodes
 * @param exitNode The exit node to send the request to
 * @param request The request configuration
 * @returns Promise<any> Response data for local nodes, undefined for remote nodes
 */
export async function sendToExitNode(
    request: ExitNodeRequest
): Promise<any> {
    // Handle local exit node with HTTP API
    const method = request.method || "POST";
    let url = `${config.getRawConfig().gerbil.reachable_at}${request.localPath}`;

    // Add query parameters if provided
    if (request.queryParams) {
        const params = new URLSearchParams(request.queryParams);
        url += `?${params.toString()}`;
    }

    try {
        let response;

        switch (method) {
            case "POST":
                response = await axios.post(url, request.data, {
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
                break;
            case "DELETE":
                response = await axios.delete(url);
                break;
            case "GET":
                response = await axios.get(url);
                break;
            case "PUT":
                response = await axios.put(url, request.data, {
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
                break;
            default:
                throw new Error(`Unsupported HTTP method: ${method}`);
        }

        logger.debug(`Exit node request successful:`, {
            method,
            url,
            status: response.data.status
        });

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error(
                `Error making ${method} request (can Pangolin see Gerbil HTTP API?) for exit node at ${config.getRawConfig().gerbil.reachable_at} (status: ${error.response?.status}): ${error.message}`
            );
        } else {
            logger.error(
                `Error making ${method} request for exit node at ${config.getRawConfig().gerbil.reachable_at}: ${error}`
            );
        }
    }
}
