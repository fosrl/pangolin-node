import axios from "axios";
import config from "@server/lib/config";
import logger from "@server/logger";

export interface TokenResponse {
    success: boolean;
    message?: string;
    data: {
        token: string;
    };
}

/**
 * Token Manager - Handles automatic token refresh for hybrid server authentication
 *
 * Usage throughout the application:
 * ```typescript
 * import { tokenManager } from "@server/lib/tokenManager";
 *
 * // Get the current valid token
 * const token = await tokenManager.getToken();
 *
 * // Force refresh if needed
 * await tokenManager.refreshToken();
 * ```
 *
 * The token manager automatically refreshes tokens every 24 hours by default
 * and is started once in the privateHybridServer.ts file.
 */

export class TokenManager {
    private token: string | null = null;
    private refreshInterval: NodeJS.Timeout | null = null;
    private isRefreshing: boolean = false;
    private refreshIntervalMs: number;
    private retryInterval: NodeJS.Timeout | null = null;
    private retryIntervalMs: number;
    private tokenAvailablePromise: Promise<void> | null = null;
    private tokenAvailableResolve: (() => void) | null = null;

    constructor(refreshIntervalMs: number = 24 * 60 * 60 * 1000, retryIntervalMs: number = 5000) {
        // Default to 24 hours for refresh, 5 seconds for retry
        this.refreshIntervalMs = refreshIntervalMs;
        this.retryIntervalMs = retryIntervalMs;
        this.setupTokenAvailablePromise();
    }

    /**
     * Set up promise that resolves when token becomes available
     */
    private setupTokenAvailablePromise(): void {
        this.tokenAvailablePromise = new Promise((resolve) => {
            this.tokenAvailableResolve = resolve;
        });
    }

    /**
     * Resolve the token available promise
     */
    private resolveTokenAvailable(): void {
        if (this.tokenAvailableResolve) {
            this.tokenAvailableResolve();
            this.tokenAvailableResolve = null;
        }
    }

    /**
     * Start the token manager - gets initial token and sets up refresh interval
     * If initial token fetch fails, keeps retrying every few seconds until successful
     */
    async start(): Promise<void> {
        logger.info("Starting token manager...");
        
        try {
            await this.refreshToken();
            this.setupRefreshInterval();
            this.resolveTokenAvailable();
            logger.info("Token manager started successfully");
        } catch (error) {
            logger.warn(`Failed to get initial token, will retry in ${this.retryIntervalMs / 1000} seconds:`, error);
            this.setupRetryInterval();
        }
    }

    /**
     * Set up retry interval for initial token acquisition
     */
    private setupRetryInterval(): void {
        if (this.retryInterval) {
            clearInterval(this.retryInterval);
        }

        this.retryInterval = setInterval(async () => {
            try {
                logger.debug("Retrying initial token acquisition");
                await this.refreshToken();
                this.setupRefreshInterval();
                this.clearRetryInterval();
                this.resolveTokenAvailable();
                logger.info("Token manager started successfully after retry");
            } catch (error) {
                logger.debug("Token acquisition retry failed, will try again");
            }
        }, this.retryIntervalMs);
    }

    /**
     * Clear retry interval
     */
    private clearRetryInterval(): void {
        if (this.retryInterval) {
            clearInterval(this.retryInterval);
            this.retryInterval = null;
        }
    }

    /**
     * Stop the token manager and clear all intervals
     */
    stop(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.clearRetryInterval();
        logger.info("Token manager stopped");
    }

    /**
     * Get the current valid token
     */

    // TODO: WE SHOULD NOT BE GETTING A TOKEN EVERY TIME WE REQUEST IT
    async getToken(): Promise<string> {
        // If we don't have a token yet, wait for it to become available
        if (!this.token && this.tokenAvailablePromise) {
            await this.tokenAvailablePromise;
        }

        if (!this.token) {
            if (this.isRefreshing) {
                // Wait for current refresh to complete
                await this.waitForRefresh();
            } else {
                throw new Error("No valid token available");
            }
        }

        if (!this.token) {
            throw new Error("No valid token available");
        }

        return this.token;
    }

    async getAuthHeader() {
        return {
            headers: {
                Authorization: `Bearer ${await this.getToken()}`,
                "X-CSRF-Token": "x-csrf-protection",
            }
        };
    }

    /**
     * Force refresh the token
     */
    async refreshToken(): Promise<void> {
        if (this.isRefreshing) {
            await this.waitForRefresh();
            return;
        }

        this.isRefreshing = true;

        try {
            const hybridConfig = config.getRawConfig().managed;

            if (
                !hybridConfig?.id ||
                !hybridConfig?.secret ||
                !hybridConfig?.endpoint
            ) {
                throw new Error("Hybrid configuration is not defined");
            }

            const tokenEndpoint = `${hybridConfig.endpoint}/api/v1/auth/remoteExitNode/get-token`;

            const tokenData = {
                remoteExitNodeId: hybridConfig.id,
                secret: hybridConfig.secret
            };

            logger.debug("Requesting new token from server");

            const response = await axios.post<TokenResponse>(
                tokenEndpoint,
                tokenData,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": "x-csrf-protection"
                    },
                    timeout: 10000 // 10 second timeout
                }
            );

            if (!response.data.success) {
                throw new Error(
                    `Failed to get token: ${response.data.message}`
                );
            }

            if (!response.data.data.token) {
                throw new Error("Received empty token from server");
            }

            this.token = response.data.data.token;
            logger.debug("Token refreshed successfully");
        } catch (error) {
            if (axios.isAxiosError(error)) {
                logger.error("Error updating proxy mapping:", {
                    message: error.message,
                    code: error.code,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.config?.url,
                    method: error.config?.method
                });
            } else {
                logger.error("Error updating proxy mapping:", error);
            }

            throw new Error("Failed to refresh token");
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Set up automatic token refresh interval
     */
    private setupRefreshInterval(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(async () => {
            try {
                logger.debug("Auto-refreshing token");
                await this.refreshToken();
            } catch (error) {
                logger.error("Failed to auto-refresh token:", error);
            }
        }, this.refreshIntervalMs);
    }

    /**
     * Wait for current refresh operation to complete
     */
    private async waitForRefresh(): Promise<void> {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!this.isRefreshing) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }
}

// Export a singleton instance for use throughout the application
export const tokenManager = new TokenManager();
