import axios from "axios";
import config from "@server/lib/config";
import logger from "@server/logger";
import { tokenManager } from "@server/lib/tokenManager";
import {
    LoginPage,
    Org,
    Resource,
    ResourceHeaderAuth,
    ResourceHeaderAuthExtendedCompatibility,
    ResourcePassword,
    ResourcePincode,
    ResourceRule
} from "@server/lib/types";

export type ResourceWithAuth = {
    resource: Resource | null;
    pincode: ResourcePincode | null;
    password: ResourcePassword | null;
    headerAuth: ResourceHeaderAuth | null;
    headerAuthExtendedCompatibility: ResourceHeaderAuthExtendedCompatibility | null;
    org: Org;
};

export type UserSessionWithUser = {
    session: any;
    user: any;
};

/**
 * Get resource by domain with pincode and password information
 */
export async function getResourceByDomain(
    domain: string
): Promise<ResourceWithAuth | null> {
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/resource/domain/${domain}`,
            await tokenManager.getAuthHeader()
        );
        return response.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching config in verify session:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error fetching config in verify session:", error);
        }
        return null;
    }
}

/**
 * Get user session with user information
 */
export async function getUserSessionWithUser(
    userSessionId: string
): Promise<UserSessionWithUser | null> {
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/session/${userSessionId}`,
            await tokenManager.getAuthHeader()
        );
        return response.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching config in verify session:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error fetching config in verify session:", error);
        }
        return null;
    }
}

/**
 * Get all role IDs a user has in an organization
 */
export async function getUserOrgRoleIds(
    userId: string,
    orgId: string
): Promise<number[]> {
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/user/${userId}/org/${orgId}/role`,
            await tokenManager.getAuthHeader()
        );
        return response.data.data ?? [];
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching user org role IDs in verify session:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error fetching user org role IDs in verify session:", error);
        }
        return [];
    }
}

/**
 * Get role name by role ID
 */
export async function getRoleName(roleId: number): Promise<string | null> {
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/role/${roleId}/name`,
            await tokenManager.getAuthHeader()
        );
        return response.data.data ?? null;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching role name in verify session:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error fetching role name in verify session:", error);
        }
        return null;
    }
}

export type CheckOrgAccessPolicyProps = {
    orgId?: string;
    userId?: string;
    sessionId?: string;
};
/**
 * Check if the user has a valid session
 */
export async function checkOrgAccessPolicy(props: CheckOrgAccessPolicyProps) {
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/user/${props.userId}/org/${props.orgId}/session/${props.sessionId}/verify`,
            await tokenManager.getAuthHeader()
        );
        return response.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error in verify session for user in org:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error in verify session for user in org:", error);
        }
        return null;
    }
}

/**
 * Check if role has access to resource
 */
export async function getRoleResourceAccess(
    resourceId: number,
    roleIds: number[]
): Promise<{ resourceId: number; roleId: number; roleName: string }[] | null> {
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/resource/${resourceId}/access`,
            { ...await tokenManager.getAuthHeader(), params: { roleIds: roleIds } }
        );
        return response.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching config in verify session:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error fetching config in verify session:", error);
        }
        return null;
    }
}

/**
 * Check if user has direct access to resource
 */
export async function getUserResourceAccess(
    userId: string,
    resourceId: number
) {
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/user/${userId}/resource/${resourceId}/access`,
            await tokenManager.getAuthHeader()
        );
        return response.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching config in verify session:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error fetching config in verify session:", error);
        }
        return null;
    }
}

/**
 * Get resource rules for a given resource
 */
export async function getResourceRules(
    resourceId: number
): Promise<ResourceRule[]> {
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/resource/${resourceId}/rules`,
            await tokenManager.getAuthHeader()
        );
        return response.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching config in verify session:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error fetching config in verify session:", error);
        }
        return [];
    }
}

/**
 * Get organization login page
 */
export async function getOrgLoginPage(
    orgId: string | undefined
): Promise<LoginPage | null> {
    if (!orgId) {
        return null;
    }
    try {
        const response = await axios.get(
            `${config.getRawConfig().managed?.endpoint}/api/v1/hybrid/org/${orgId}/login-page`,
            await tokenManager.getAuthHeader()
        );
        return response.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error("Error fetching config in verify session:", {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method
            });
        } else {
            logger.error("Error fetching config in verify session:", error);
        }
        return null;
    }
}
