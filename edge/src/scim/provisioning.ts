import { Router, type Request, type Response } from "express";
import {
  verifyPlatformAccessToken,
  type VerifiedAccessToken,
} from "../jwt-verifier.js";
import { TokenValidationError } from "../validate-token.js";

export interface ScimUserRecord {
  id: string;
  userName: string;
  tenantId: string;
  role: string;
  active: boolean;
}

export class ScimForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScimForbiddenError";
  }
}

const users = new Map<string, ScimUserRecord>();

export function clearScimUsersForTests(): void {
  users.clear();
}

export function getScimUsersForTests(): readonly ScimUserRecord[] {
  return [...users.values()];
}

async function verifyScimBearer(
  authorization: string | undefined,
): Promise<VerifiedAccessToken> {
  if (!authorization) {
    throw new TokenValidationError("Missing SCIM bearer token");
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) {
    throw new TokenValidationError("SCIM bearer must use Bearer scheme");
  }
  const token = match[1];
  if (token.startsWith("dev:") || token.startsWith("svc:")) {
    throw new TokenValidationError("Unsigned SCIM tokens are rejected");
  }

  const verified = await verifyPlatformAccessToken(token);
  if (verified.role !== "tenant_admin") {
    throw new ScimForbiddenError("SCIM provisioning requires tenant_admin");
  }
  return verified;
}

function userIdFor(userName: string, tenantId: string): string {
  return `scim-${tenantId}-${userName}`;
}

export function createScimRouter(): Router {
  const router = Router();

  router.post("/Users", async (req: Request, res: Response) => {
    try {
      const caller = await verifyScimBearer(req.header("authorization"));
      const userName = String(req.body?.userName ?? "");
      if (!userName) {
        res.status(400).json({ error: "invalid_scim_payload" });
        return;
      }

      const bodyTenant = String(
        req.body?.tenantId ?? req.body?.["urn:dept:canvas:tenant_id"] ?? "",
      );
      const bodyRole = String(
        req.body?.role ?? req.body?.["urn:dept:canvas:role"] ?? "",
      );
      if (bodyTenant && bodyTenant !== caller.tenantId) {
        res.status(403).json({ error: "cross_tenant_denied" });
        return;
      }
      if (bodyRole && bodyRole !== "viewer") {
        res.status(403).json({ error: "role_escalation_denied" });
        return;
      }

      const id = userIdFor(userName, caller.tenantId);
      const record: ScimUserRecord = {
        id,
        userName,
        tenantId: caller.tenantId,
        role: "viewer",
        active: true,
      };
      users.set(id, record);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof TokenValidationError) {
        res.status(401).json({ error: "invalid_scim_token" });
        return;
      }
      if (error instanceof ScimForbiddenError) {
        res.status(403).json({ error: "scim_forbidden" });
        return;
      }
      res.status(500).json({ error: "internal_error" });
    }
  });

  router.get("/Users/:id", async (req: Request, res: Response) => {
    try {
      const caller = await verifyScimBearer(req.header("authorization"));
      const id = String(req.params.id ?? "");
      const record = users.get(id);
      if (!record) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (record.tenantId !== caller.tenantId) {
        res.status(403).json({ error: "cross_tenant_denied" });
        return;
      }
      res.json(record);
    } catch (error) {
      if (error instanceof TokenValidationError) {
        res.status(401).json({ error: "invalid_scim_token" });
        return;
      }
      if (error instanceof ScimForbiddenError) {
        res.status(403).json({ error: "scim_forbidden" });
        return;
      }
      res.status(500).json({ error: "internal_error" });
    }
  });

  return router;
}
