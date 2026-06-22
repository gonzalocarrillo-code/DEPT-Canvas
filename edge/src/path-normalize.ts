import { PathTraversalError } from "./errors.js";

function decodePathRepeatedly(rawPath: string): string {
  let decoded = rawPath;
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        break;
      }
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

function containsTraversalSegment(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  if (
    normalized.includes("..") ||
    normalized.includes("//") ||
    /%2e/i.test(normalized) ||
    /%2f/i.test(normalized) ||
    /%252e/i.test(normalized) ||
    /%252f/i.test(normalized)
  ) {
    return true;
  }
  return normalized.split("/").some((segment) => segment === "..");
}

export function normalizeRequestPath(rawPath: string): string {
  const withoutQuery = rawPath.split("?")[0] ?? rawPath;
  const decoded = decodePathRepeatedly(withoutQuery);

  if (containsTraversalSegment(decoded) || containsTraversalSegment(withoutQuery)) {
    throw new PathTraversalError("Path traversal is not allowed");
  }

  const normalized = decoded.replace(/\\/g, "/");
  if (!normalized.startsWith("/")) {
    return `/${normalized}`;
  }
  return normalized;
}
