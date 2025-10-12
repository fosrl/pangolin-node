import { hash, verify } from "@node-rs/argon2";

export async function verifyPassword(
    password: string,
    hash: string,
): Promise<boolean> {
    const validPassword = await verify(hash, password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
    });
    return validPassword;
}

export async function hashPassword(password: string): Promise<string> {
    const passwordHash = await hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
    });

    return passwordHash;
}
