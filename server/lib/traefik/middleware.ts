/**
 * Apply a path rewrite to a request path in-process, producing the same
 * result the replacePathRegex / stripPrefix middlewares built above would.
 * Used where Pangolin issues the redirect itself (badger) instead of
 * handing it to Traefik.
 */
export function rewriteRequestPath(
    requestPath: string,
    path: string | null,
    pathMatchType: string | null,
    rewritePath: string | null,
    rewritePathType: string | null
): string {
    if (!rewritePathType) {
        return requestPath;
    }

    let target = rewritePath ?? "";
    if (
        rewritePathType !== "regex" &&
        target !== "" &&
        !target.startsWith("/")
    ) {
        target = `/${target}`;
    }

    // Nothing was matched against, so there is nothing to strip or replace;
    // an exact rewrite is the only one that still means something.
    if (!path || !pathMatchType) {
        return rewritePathType === "exact" ? target || "/" : requestPath;
    }

    let matched = path;
    if (pathMatchType !== "regex" && !matched.startsWith("/")) {
        matched = `/${matched}`;
    }

    const matchRegex =
        pathMatchType === "regex"
            ? matched
            : pathMatchType === "prefix"
              ? `^${escapeRegex(matched)}(.*)`
              : `^${escapeRegex(matched)}$`;

    switch (rewritePathType) {
        case "exact":
            return requestPath.replace(
                new RegExp(`^${escapeRegex(matched)}$`),
                target
            );
        case "prefix":
            return requestPath.replace(
                new RegExp(matchRegex),
                pathMatchType === "prefix" ? `${target}$1` : target
            );
        case "regex":
            return requestPath.replace(new RegExp(matchRegex), target);
        case "stripPrefix": {
            if (pathMatchType === "prefix") {
                const stripped = requestPath.startsWith(matched)
                    ? requestPath.slice(matched.length)
                    : requestPath;
                const prefix = target && target !== "/" ? target : "";
                return `${prefix}${stripped}` || "/";
            }
            return requestPath.replace(new RegExp(matchRegex), target || "/");
        }
        default:
            return requestPath;
    }
}

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
