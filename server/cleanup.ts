import { cleanup as wsCleanup } from "@server/routers/ws";

async function cleanup() {
    await wsCleanup();

    process.exit(0);
}

export async function initCleanup() {
    // Handle process termination
    process.on("SIGTERM", () => cleanup());
    process.on("SIGINT", () => cleanup());
}