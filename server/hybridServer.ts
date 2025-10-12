import logger from "@server/logger";
import config from "@server/lib/config";
import { createWebSocketClient } from "./routers/ws/client";
import { TraefikConfigManager } from "./lib/traefik/TraefikConfigManager";
import { tokenManager } from "./lib/tokenManager";
import { APP_VERSION } from "./lib/consts";
import { sendToExitNode } from "./lib/exitNodes";

export async function createHybridClientServer() {
    logger.info("Starting hybrid client server...");

    // Start the token manager
    await tokenManager.start();

    const token = await tokenManager.getToken();
    await config.fetchRemoteConfig();

    const monitor = new TraefikConfigManager();

    await monitor.start();

    // Create client
    const client = createWebSocketClient(
        token,
        config.getRawConfig().managed!.endpoint!,
        {
            reconnectInterval: 5000,
            pingInterval: 30000,
            pingTimeout: 10000
        }
    );

    // Register message handlers
    client.registerHandler("remoteExitNode/peers/add", async (message) => {
        const { publicKey, allowedIps } = message.data;

        await sendToExitNode({
            localPath: "/peer",
            method: "POST",
            data: {
                publicKey: publicKey,
                allowedIps: allowedIps || []
            }
        });
    });

    client.registerHandler("remoteExitNode/peers/remove", async (message) => {
        const { publicKey } = message.data;

        await sendToExitNode({
            localPath: "/peer",
            method: "DELETE",
            data: {
                publicKey: publicKey
            },
            queryParams: {
                public_key: publicKey
            }
        });
    });

    // /update-proxy-mapping
    client.registerHandler(
        "remoteExitNode/update-proxy-mapping",
        async (message) => {
            await sendToExitNode({
                localPath: "/update-proxy-mapping",
                method: "POST",
                data: message.data
            });
        }
    );

    // /update-destinations
    client.registerHandler(
        "remoteExitNode/update-destinations",
        async (message) => {
            await sendToExitNode({
                localPath: "/update-destinations",
                method: "POST",
                data: message.data
            });
        }
    );

    client.registerHandler("remoteExitNode/traefik/reload", async (message) => {
        await monitor.HandleTraefikConfig();
    });

    // Listen to connection events
    client.on("connect", () => {
        logger.info("Connected to WebSocket server");
        client.sendMessage("remoteExitNode/register", {
            remoteExitNodeVersion: APP_VERSION
        });
    });

    client.on("disconnect", () => {
        logger.info("Disconnected from WebSocket server");
    });

    client.on("message", (message) => {
        logger.info(
            `Received message: ${message.type} ${JSON.stringify(message.data)}`
        );
    });

    // Connect to the server
    try {
        await client.connect();
        logger.info("Connection initiated");
    } catch (error) {
        logger.error("Failed to connect:", error);
    }

    // Store the ping interval stop function for cleanup if needed
    const stopPingInterval = client.sendMessageInterval(
        "remoteExitNode/ping",
        { timestamp: Date.now() / 1000 },
        60000
    ); // send every minute

    // Return client and cleanup function for potential use
    return { client, stopPingInterval };
}
