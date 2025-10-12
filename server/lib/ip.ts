import { db } from "@server/db";
import { clients, orgs, sites } from "@server/db";
import { and, eq, isNotNull } from "drizzle-orm";
import config from "@server/lib/config";

interface IPRange {
    start: bigint;
    end: bigint;
}

type IPVersion = 4 | 6;

/**
 * Detects IP version from address string
 */
function detectIpVersion(ip: string): IPVersion {
    return ip.includes(":") ? 6 : 4;
}

/**
 * Converts IPv4 or IPv6 address string to BigInt for numerical operations
 */
function ipToBigInt(ip: string): bigint {
    const version = detectIpVersion(ip);

    if (version === 4) {
        return ip.split(".").reduce((acc, octet) => {
            const num = parseInt(octet);
            if (isNaN(num) || num < 0 || num > 255) {
                throw new Error(`Invalid IPv4 octet: ${octet}`);
            }
            return BigInt.asUintN(64, (acc << BigInt(8)) + BigInt(num));
        }, BigInt(0));
    } else {
        // Handle IPv6
        // Expand :: notation
        let fullAddress = ip;
        if (ip.includes("::")) {
            const parts = ip.split("::");
            if (parts.length > 2)
                throw new Error("Invalid IPv6 address: multiple :: found");
            const missing =
                8 - (parts[0].split(":").length + parts[1].split(":").length);
            const padding = Array(missing).fill("0").join(":");
            fullAddress = `${parts[0]}:${padding}:${parts[1]}`;
        }

        return fullAddress.split(":").reduce((acc, hextet) => {
            const num = parseInt(hextet || "0", 16);
            if (isNaN(num) || num < 0 || num > 65535) {
                throw new Error(`Invalid IPv6 hextet: ${hextet}`);
            }
            return BigInt.asUintN(128, (acc << BigInt(16)) + BigInt(num));
        }, BigInt(0));
    }
}

/**
 * Converts BigInt to IP address string
 */
function bigIntToIp(num: bigint, version: IPVersion): string {
    if (version === 4) {
        const octets: number[] = [];
        for (let i = 0; i < 4; i++) {
            octets.unshift(Number(num & BigInt(255)));
            num = num >> BigInt(8);
        }
        return octets.join(".");
    } else {
        const hextets: string[] = [];
        for (let i = 0; i < 8; i++) {
            hextets.unshift(
                Number(num & BigInt(65535))
                    .toString(16)
                    .padStart(4, "0")
            );
            num = num >> BigInt(16);
        }
        // Compress zero sequences
        let maxZeroStart = -1;
        let maxZeroLength = 0;
        let currentZeroStart = -1;
        let currentZeroLength = 0;

        for (let i = 0; i < hextets.length; i++) {
            if (hextets[i] === "0000") {
                if (currentZeroStart === -1) currentZeroStart = i;
                currentZeroLength++;
                if (currentZeroLength > maxZeroLength) {
                    maxZeroLength = currentZeroLength;
                    maxZeroStart = currentZeroStart;
                }
            } else {
                currentZeroStart = -1;
                currentZeroLength = 0;
            }
        }

        if (maxZeroLength > 1) {
            hextets.splice(maxZeroStart, maxZeroLength, "");
            if (maxZeroStart === 0) hextets.unshift("");
            if (maxZeroStart + maxZeroLength === 8) hextets.push("");
        }

        return hextets
            .map((h) => (h === "0000" ? "0" : h.replace(/^0+/, "")))
            .join(":");
    }
}

/**
 * Converts CIDR to IP range
 */
export function cidrToRange(cidr: string): IPRange {
    const [ip, prefix] = cidr.split("/");
    const version = detectIpVersion(ip);
    const prefixBits = parseInt(prefix);
    const ipBigInt = ipToBigInt(ip);

    // Validate prefix length
    const maxPrefix = version === 4 ? 32 : 128;
    if (prefixBits < 0 || prefixBits > maxPrefix) {
        throw new Error(`Invalid prefix length for IPv${version}: ${prefix}`);
    }

    const shiftBits = BigInt(maxPrefix - prefixBits);
    const mask = BigInt.asUintN(
        version === 4 ? 64 : 128,
        (BigInt(1) << shiftBits) - BigInt(1)
    );
    const start = ipBigInt & ~mask;
    const end = start | mask;

    return { start, end };
}

/**
 * Finds the next available CIDR block given existing allocations
 * @param existingCidrs Array of existing CIDR blocks
 * @param blockSize Desired prefix length for the new block
 * @param startCidr Optional CIDR to start searching from
 * @returns Next available CIDR block or null if none found
 */
export function findNextAvailableCidr(
    existingCidrs: string[],
    blockSize: number,
    startCidr?: string
): string | null {
    if (!startCidr && existingCidrs.length === 0) {
        return null;
    }

    // If no existing CIDRs, use the IP version from startCidr
    const version = startCidr ? detectIpVersion(startCidr.split("/")[0]) : 4; // Default to IPv4 if no startCidr provided

    // Use appropriate default startCidr if none provided
    startCidr = startCidr || (version === 4 ? "0.0.0.0/0" : "::/0");

    // If there are existing CIDRs, ensure all are same version
    if (
        existingCidrs.length > 0 &&
        existingCidrs.some(
            (cidr) => detectIpVersion(cidr.split("/")[0]) !== version
        )
    ) {
        throw new Error("All CIDRs must be of the same IP version");
    }

    // Extract the network part from startCidr to ensure we stay in the right subnet
    const startCidrRange = cidrToRange(startCidr);

    // Convert existing CIDRs to ranges and sort them
    const existingRanges = existingCidrs
        .map((cidr) => cidrToRange(cidr))
        .sort((a, b) => (a.start < b.start ? -1 : 1));

    // Calculate block size
    const maxPrefix = version === 4 ? 32 : 128;
    const blockSizeBigInt = BigInt(1) << BigInt(maxPrefix - blockSize);

    // Start from the beginning of the given CIDR
    let current = startCidrRange.start;
    const maxIp = startCidrRange.end;

    // Iterate through existing ranges
    for (let i = 0; i <= existingRanges.length; i++) {
        const nextRange = existingRanges[i];

        // Align current to block size
        const alignedCurrent =
            current +
            ((blockSizeBigInt - (current % blockSizeBigInt)) % blockSizeBigInt);

        // Check if we've gone beyond the maximum allowed IP
        if (alignedCurrent + blockSizeBigInt - BigInt(1) > maxIp) {
            return null;
        }

        // If we're at the end of existing ranges or found a gap
        if (
            !nextRange ||
            alignedCurrent + blockSizeBigInt - BigInt(1) < nextRange.start
        ) {
            return `${bigIntToIp(alignedCurrent, version)}/${blockSize}`;
        }

        // If next range overlaps with our search space, move past it
        if (nextRange.end >= startCidrRange.start && nextRange.start <= maxIp) {
            // Move current pointer to after the current range
            current = nextRange.end + BigInt(1);
        }
    }

    return null;
}

/**
 * Checks if a given IP address is within a CIDR range
 * @param ip IP address to check
 * @param cidr CIDR range to check against
 * @returns boolean indicating if IP is within the CIDR range
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
    const ipVersion = detectIpVersion(ip);
    const cidrVersion = detectIpVersion(cidr.split("/")[0]);

    // If IP versions don't match, the IP cannot be in the CIDR range
    if (ipVersion !== cidrVersion) {
        // throw new Erorr
        return false;
    }

    const ipBigInt = ipToBigInt(ip);
    const range = cidrToRange(cidr);
    return ipBigInt >= range.start && ipBigInt <= range.end;
}

export async function getNextAvailableClientSubnet(
    orgId: string
): Promise<string> {
    const [org] = await db.select().from(orgs).where(eq(orgs.orgId, orgId));

    if (!org) {
        throw new Error(`Organization with ID ${orgId} not found`);
    }

    if (!org.subnet) {
        throw new Error(`Organization with ID ${orgId} has no subnet defined`);
    }

    const existingAddressesSites = await db
        .select({
            address: sites.address
        })
        .from(sites)
        .where(and(isNotNull(sites.address), eq(sites.orgId, orgId)));

    const existingAddressesClients = await db
        .select({
            address: clients.subnet
        })
        .from(clients)
        .where(and(isNotNull(clients.subnet), eq(clients.orgId, orgId)));

    const addresses = [
        ...existingAddressesSites.map(
            (site) => `${site.address?.split("/")[0]}/32`
        ), // we are overriding the 32 so that we pick individual addresses in the subnet of the org for the site and the client even though they are stored with the /block_size of the org
        ...existingAddressesClients.map(
            (client) => `${client.address.split("/")}/32`
        )
    ].filter((address) => address !== null) as string[];

    const subnet = findNextAvailableCidr(addresses, 32, org.subnet); // pick the sites address in the org
    if (!subnet) {
        throw new Error("No available subnets remaining in space");
    }

    return subnet;
}

export async function getNextAvailableOrgSubnet(): Promise<string> {
    const existingAddresses = await db
        .select({
            subnet: orgs.subnet
        })
        .from(orgs)
        .where(isNotNull(orgs.subnet));

    const addresses = existingAddresses.map((org) => org.subnet!);

    const subnet = findNextAvailableCidr(
        addresses,
        config.getRawConfig().orgs.block_size,
        config.getRawConfig().orgs.subnet_group
    );
    if (!subnet) {
        throw new Error("No available subnets remaining in space");
    }

    return subnet;
}
