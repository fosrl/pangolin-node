import { Org, ResourceSession } from "./types";

export function enforceResourceSessionLength(
    resourceSession: ResourceSession,
    org: Org
): { valid: boolean; error?: string } {
    if (org.maxSessionLengthHours) {
        const sessionIssuedAt = resourceSession.issuedAt; // may be null
        const maxSessionLengthHours = org.maxSessionLengthHours;

        if (sessionIssuedAt) {
            const maxSessionLengthMs = maxSessionLengthHours * 60 * 60 * 1000;
            const sessionAgeMs = Date.now() - sessionIssuedAt;

            if (sessionAgeMs > maxSessionLengthMs) {
                return {
                    valid: false,
                    error: `Resource session has expired due to organization policy (max session length: ${maxSessionLengthHours} hours)`
                };
            }
        } else {
            return {
                valid: false,
                error: `Resource session is invalid due to organization policy (max session length: ${maxSessionLengthHours} hours)`
            };
        }
    }

    return { valid: true };
}
