import { Router, type Request, type Response } from "express";
import { verifyJwtAccessToken } from "../jwt-verifier.js";
import { TokenValidationError } from "../validate-token.js";

export interface ScimUserRecord {
  id: string;
  userName: string;
  tenantId: string;
  role: string;
  active: boolean;
}

const users = new Map<string, ScimUserRecord>();

export function clearScimUsersForTests(): void {
  users.clear();
}

export function getScimUsersForTests(): readonly ScimUserRecord[] {
  return [...users.values()];
}

async function verifyScimBearer(authorization: string | undefined): Promise<void> {
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
  await verifyJwtAccessToken(token);
}

export function createScimRouter(): Router {
  const router = Router();

  router.post("/Users", async (req: Request, res: Response) => {
    try {
      await verifyScimBearer(req.header("authorization"));
      const userName = String(req.body?.userName ?? "");
      const tenantId = String(req.body?.tenantId ?? req.body?.["urn:dept:canvas:tenant_id"] ?? "");
      const role = String(req.body?.role ?? req.body?.["urn:dept:canvas:role"] ?? "viewer");
      if (!userName || !tenantId) {
        res.status(400).json({ error: "invalid_scim_payload" });
        return;
      }
      const id = `scim-${userName}`;
      const record: ScimUserRecord = {
        id,
        userName,
        tenantId,
        role,
        active: true,
      };
      users.set(id, record);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof TokenValidationError) {
        res.status(401).json({ error: "invalid_scim_token" });
        return;
      }
      res.status(500).json({ error: "internal_error" });
    }
  });

  router.get("/Users/:id", async (req: Request, res: Response) => {
    try {
      await verifyScimBearer(req.header("authorization"));
      const id = String(req.params.id ?? "");
      const record = users.get(id);
      if (!record) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json(record);
    } catch (error) {
      if (error instanceof TokenValidationError) {
        res.status(401).json({ error: "invalid_scim_token" });
        return;
      }
      res.status(500).json({ error: "internal_error" });
    }
  });

  return router;
}
