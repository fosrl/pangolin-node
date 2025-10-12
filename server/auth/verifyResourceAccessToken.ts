import { db } from "@server/db";
import {
    Resource,
    ResourceAccessToken,
    resourceAccessToken,
    resources
} from "@server/db";
import { and, eq } from "drizzle-orm";
import { isWithinExpirationDate } from "oslo";
import { verifyPassword } from "./password";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";

export async function verifyResourceAccessToken({
    accessToken,
    accessTokenId,
    resourceId
}: {
    accessToken: string;
    accessTokenId?: string;
    resourceId?: number; // IF THIS IS NOT SET, THE TOKEN IS VALID FOR ALL RESOURCES
}): Promise<{
    valid: boolean;
    error?: string;
    tokenItem?: ResourceAccessToken;
    resource?: Resource;
}> {
    const accessTokenHash = encodeHexLowerCase(
        sha256(new TextEncoder().encode(accessToken))
    );

    let tokenItem: ResourceAccessToken | undefined;
    let resource: Resource | undefined;

    if (!accessTokenId) {
        const [res] = await db
            .select()
            .from(resourceAccessToken)
            .where(and(eq(resourceAccessToken.tokenHash, accessTokenHash)))
            .innerJoin(
                resources,
                eq(resourceAccessToken.resourceId, resources.resourceId)
            );

        tokenItem = res?.resourceAccessToken;
        resource = res?.resources;
    } else {
        const [res] = await db
            .select()
            .from(resourceAccessToken)
            .where(and(eq(resourceAccessToken.accessTokenId, accessTokenId)))
            .innerJoin(
                resources,
                eq(resourceAccessToken.resourceId, resources.resourceId)
            );

        if (res && res.resourceAccessToken) {
            if (res.resourceAccessToken.tokenHash?.startsWith("$argon")) {
                const validCode = await verifyPassword(
                    accessToken,
                    res.resourceAccessToken.tokenHash
                );

                if (!validCode) {
                    return {
                        valid: false,
                        error: "Invalid access token"
                    };
                }
            } else {
                const tokenHash = encodeHexLowerCase(
                    sha256(new TextEncoder().encode(accessToken))
                );

                if (res.resourceAccessToken.tokenHash !== tokenHash) {
                    return {
                        valid: false,
                        error: "Invalid access token"
                    };
                }
            }
        }

        tokenItem = res?.resourceAccessToken;
        resource = res?.resources;
    }

    if (!tokenItem || !resource) {
        return {
            valid: false,
            error: "Access token does not exist for resource"
        };
    }

    if (
        tokenItem.expiresAt &&
        !isWithinExpirationDate(new Date(tokenItem.expiresAt))
    ) {
        return {
            valid: false,
            error: "Access token has expired"
        };
    }

    if (resourceId && resource.resourceId !== resourceId) {
        return {
            valid: false,
            error: "Resource ID does not match"
        };
    }

    return {
        valid: true,
        tokenItem,
        resource
    };
}
