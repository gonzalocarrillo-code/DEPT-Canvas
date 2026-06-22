import { PathTraversalError } from "./errors.js";

export function normalizeRequestPath(rawPath: string): string {
  const withoutQuery = rawPath.split("?")[0] ?? rawPath;
  const normalized = withoutQuery.replace(/\\/g, "/");

  if (
    normalized.includes("..") ||
    normalized.includes("//") ||
    normalized.includes("%2e") ||
    normalized.includes("%2E")
  ) {
    throw new PathTraversalError("Path traversal is not allowed");
  }

  if (!normalized.startsWith("/")) {
    return `/${normalized}`;
  }
  return normalized;
}
