import { z } from "zod";
import { __DIRNAME, APP_VERSION } from "@server/lib/consts";
import { configSchema, readConfigFile } from "./readConfigFile";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import axios from "axios";
import { tokenManager } from "./tokenManager";

export type RemoteConfifg = {
    session_cookie_name: string;
    resource_access_token_param: string;
    resource_access_token_headers: {
        id: string;
        token: string;
    };
    resource_session_request_param: string;
    require_email_verification: boolean;
};

export class Config {
    private rawConfig!: z.infer<typeof configSchema>;
    private remoteConfig!: RemoteConfifg;

    isDev: boolean = process.env.ENVIRONMENT !== "prod";

    constructor() {
        const environment = readConfigFile();

        const {
            data: parsedConfig,
            success,
            error
        } = configSchema.safeParse(environment);

        if (!success) {
            const errors = fromError(error);
            throw new Error(`Invalid configuration file: ${errors}`);
        }

        process.env.APP_VERSION = APP_VERSION;

        this.rawConfig = parsedConfig;
    }

    public async fetchRemoteConfig() {
        try {
            const response = await axios.get(
                `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/general-config`,
                await tokenManager.getAuthHeader()
            );
            this.remoteConfig = response.data.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                logger.error("Error fetching remote config! Your server wont work right...:", {
                    message: error.message,
                    code: error.code,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.config?.url,
                    method: error.config?.method
                });
            } else {
                logger.error("Error fetching remote config! Your server wont work right...:", error);
            }
        }
    }

    public getRemoteConfig() {
        return this.remoteConfig;
    }

    public async initServer() {
        if (!this.rawConfig) {
            throw new Error("Config not loaded. Call load() first.");
        }
    }

    public getRawConfig() {
        return this.rawConfig;
    }
}

export const config = new Config();

export default config;
