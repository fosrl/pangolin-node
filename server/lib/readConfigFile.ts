import fs from "fs";
import yaml from "js-yaml";
import { configFilePath1, configFilePath2 } from "./consts";
import { z } from "zod";

const portSchema = z.number().positive().gt(0).lte(65535);

const getEnvOrYaml = (envVar: string) => (valFromYaml: any) => {
    return process.env[envVar] ?? valFromYaml;
};

export const configSchema = z.object({
    app: z
        .object({
            log_level: z
                .enum(["debug", "info", "warn", "error"])
                .default("info"),
            log_failed_attempts: z.boolean().optional().default(false)
        })
        .prefault({}),
    server: z
        .object({
            internal_port: portSchema.default(3001),
            internal_hostname: z.string().optional().default("pangolin"),
        })
        .prefault({}),
    managed: z.object({
        name: z.string().optional(),
        id: z.string().optional(),
        secret: z.string().optional(),
        endpoint: z
            .string()
            .optional()
            .default("https://pangolin.fossorial.io"),
        redirect_endpoint: z.string().optional()
    }),
    traefik: z
        .object({
            certificates_path: z.string().default("/var/certificates"),
            monitor_interval: z.number().default(5000),
            dynamic_cert_config_path: z
                .string()
                .optional()
                .default("/var/dynamic/cert_config.yml"),
            dynamic_router_config_path: z
                .string()
                .optional()
                .default("/var/dynamic/router_config.yml")
        })
        .optional()
        .prefault({}),
    gerbil: z.object({
        base_endpoint: z.string(),
        reachable_at: z.string().optional().default("http://gerbil:3003"),
        start_port: portSchema.optional().default(51820)
    })
});

export function readConfigFile() {
    const loadConfig = (configPath: string) => {
        try {
            const yamlContent = fs.readFileSync(configPath, "utf8");
            const config = yaml.load(yamlContent);
            return config;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(
                    `Error loading configuration file: ${error.message}`
                );
            }
            throw error;
        }
    };

    let environment: any;
    if (fs.existsSync(configFilePath1)) {
        environment = loadConfig(configFilePath1);
    } else if (fs.existsSync(configFilePath2)) {
        environment = loadConfig(configFilePath2);
    }

    if (!environment) {
        throw new Error("No configuration file found. Please create one.");
    }

    return environment;
}
