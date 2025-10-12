#! /usr/bin/env node
import "./extendZod.ts";

import { createInternalServer } from "./internalServer";
import { createHybridClientServer } from "./hybridServer";
import config from "@server/lib/config";
import { initCleanup } from "#dynamic/cleanup";

async function startServers() {
    await config.initServer();

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
