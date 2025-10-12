import { MemoryStore, Store } from "express-rate-limit";

export function createStore(): Store {
    const rateLimitStore: Store = new MemoryStore();
    return rateLimitStore;
}
