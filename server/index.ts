#! /usr/bin/env node
import { createInternalServer } from "./internalServer";
import { createHybridClientServer } from "./hybridServer";
import { initCleanup } from "@server/cleanup";
import { config } from "@server/lib/config";

async function startServers() {
    config.getRawConfig(); // Ensure config is loaded

    // Start all servers
    const internalServer = createInternalServer();

    const hybridClientServer = await createHybridClientServer();

    await initCleanup();

    return {
        internalServer,
        hybridClientServer
    };
}

startServers().catch(console.error);
