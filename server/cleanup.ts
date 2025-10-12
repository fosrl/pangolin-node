async function cleanup() {
    process.exit(0);
}

export async function initCleanup() {
    // Handle process termination
    process.on("SIGTERM", () => cleanup());
    process.on("SIGINT", () => cleanup());
}