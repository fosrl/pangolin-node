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
