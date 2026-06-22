/** Key id for platform-issued session JWTs; must match the platform JWKS entry. */
export const PLATFORM_SESSION_JWT_KID =
  process.env.EDGE_SESSION_JWT_KID ?? "platform-session-v1";
