export type Resource = {
    resourceId: number;
    resourceGuid: string;
    orgId: string;
    niceId: string;
    name: string;
    subdomain: string | null;
    fullDomain: string | null;
    domainId: string | null;
    ssl: boolean;
    blockAccess: boolean;
    sso: boolean;
    http: boolean;
    protocol: string;
    proxyPort: number | null;
    emailWhitelistEnabled: boolean;
    applyRules: boolean;
    enabled: boolean;
    stickySession: boolean;
    tlsServerName: string | null;
    setHostHeader: string | null;
    enableProxy: boolean | null;
    skipToIdpId: number | null;
    headers: string | null;
};

export type ResourcePincode = {
    pincodeId: number;
    resourceId: number;
    pincodeHash: string;
    digitLength: number;
};

export type ResourcePassword = {
    passwordId: number;
    resourceId: number;
    passwordHash: string;
};

export type ResourceHeaderAuth = {
    headerAuthId: number;
    resourceId: number;
    headerAuthHash: string;
};

export type ResourceHeaderAuthExtendedCompatibility = {
    resourceId: number;
    headerAuthExtendedCompatibilityId: number;
    extendedCompatibilityIsActivated: boolean;
}

export type Org = {
    name: string;
    orgId: string;
    subnet: string | null;
    utilitySubnet: string | null;
    createdAt: string | null;
    requireTwoFactor: boolean | null;
    maxSessionLengthHours: number | null;
    passwordExpiryDays: number | null;
    settingsLogRetentionDaysRequest: number;
    settingsLogRetentionDaysAccess: number;
    settingsLogRetentionDaysAction: number;
}

export type LoginPage = {
    loginPageId: number;
    subdomain: string | null;
    fullDomain: string | null;
    exitNodeId: number | null;
    domainId: string | null;
};

export type ResourceRule = {
    ruleId: number;
    resourceId: number;
    enabled: boolean;
    priority: number;
    action: string; // ACCEPT, DROP, PASS
    match: string; // CIDR, PATH, IP
    value: string;
};

// Combined type for resource with authentication methods
export type ResourceWithAuth = {
    resource: Resource | null;
    pincode: ResourcePincode | null;
    password: ResourcePassword | null;
    headerAuth: ResourceHeaderAuth | null;
    loginPage: LoginPage | null;
    resourceRule?: ResourceRule[];
};

export type ResourceSession = {
    sessionId: string;
    expiresAt: number;
    sessionLength: number;
    resourceId: number;
    passwordId: number | null;
    pincodeId: number | null;
    whitelistId: number | null;
    doNotExtend: boolean;
    accessTokenId: string | null;
    isRequestToken: boolean;
    userSessionId: string | null;
    issuedAt: number | null;
};

export type ResourceAccessToken = {
    accessTokenId: string;
    orgId: string;
    resourceId: number;
    tokenHash: string;
    sessionLength: number;
    expiresAt: number | null;
    title: string | null;
    description: string | null;
    createdAt: number;
};
