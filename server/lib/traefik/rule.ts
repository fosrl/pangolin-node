/**
 * Server-side equivalent of the clause appendPathMatch emits, so badger can
 * tell whether a request would have matched a given path config. Mirrors
 * Traefik v3 semantics: Path is exact, PathPrefix is segment-aware
 * (`/products` matches `/products/shoes` but not `/productsforsale`), and
 * PathRegexp is an unanchored regex test.
 */
export function matchesPath(
    requestPath: string,
    path: string | null | undefined,
    pathMatchType: string | null | undefined
): boolean {
    if (!path || !pathMatchType) return true;

    if (pathMatchType === "regex") {
        try {
            return new RegExp(path).test(requestPath);
        } catch {
            return false;
        }
    }

    let p = path;
    if (!p.startsWith("/")) {
        p = `/${p}`;
    }

    if (pathMatchType === "exact") {
        return requestPath === p;
    } else if (pathMatchType === "prefix") {
        if (!requestPath.startsWith(p)) {
            return false;
        }
        if (p.endsWith("/")) {
            return true;
        }
        const rest = requestPath.slice(p.length);
        return rest === "" || rest.startsWith("/");
    }
    return true;
}

// The two HostRegexp patterns Pangolin's buildHostRule emits for wildcard
// resources, capturing the escaped domain the wildcard sits under:
// `^[^.]+\.parent$`, and `^([^.]+\.)?parent$` when the base host matches too.
const WILDCARD_HOST_PATTERN = /^\^(?:\[\^\.\]\+\\\.|\(\[\^\.\]\+\\\.\)\?)(.+)\$$/;

/**
 * The domains a router rule needs a certificate for. A wildcard rule maps
 * back to `*.parent`; when it also matches the base host, no separate entry
 * is needed because the wildcard certificate carries the base name as a SAN.
 */
export function domainsFromHostRule(rule: string): string[] {
    const domains: string[] = [];

    const host = rule.match(/Host\(`([^`]+)`\)/);
    if (host?.[1]) {
        domains.push(host[1]);
    }

    const hostRegexp = rule.match(/HostRegexp\(`([^`]+)`\)/);
    const parent = hostRegexp?.[1]?.match(WILDCARD_HOST_PATTERN)?.[1];
    if (parent) {
        domains.push(`*.${parent.replace(/\\\./g, ".")}`);
    }

    return domains;
}
