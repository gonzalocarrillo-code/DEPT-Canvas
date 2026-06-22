import { verifyIdpAccessToken } from "../jwt-verifier.js";
import type { SessionToken } from "../validate-token.js";
import { TokenValidationError } from "../validate-token.js";

export interface OidcCallbackInput {
  id_token: string;
}

export async function handleOidcCallback(
  input: OidcCallbackInput,
): Promise<SessionToken> {
  if (
    !input.id_token ||
    input.id_token.startsWith("dev:") ||
    input.id_token.startsWith("svc:")
  ) {
    throw new TokenValidationError("OIDC id_token is invalid");
  }

  const verified = await verifyIdpAccessToken(input.id_token);
  return {
    userId: verified.userId,
    tenantId: verified.tenantId,
    role: verified.role,
    expiresAt: verified.expiresAt,
  };
}
