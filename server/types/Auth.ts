import { Request } from "express";
import { User } from "@server/db";
import { Session } from "@server/db";

export interface AuthenticatedRequest extends Request {
    user: User;
    session: Session;
    userOrgRoleId?: number;
}
