import { RateLimitExceededError } from "./errors.js";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

function resolveConfig(config?: RateLimitConfig): RateLimitConfig {
  return (
    config ?? {
      windowMs: 60_000,
      maxRequests: Number(process.env.EDGE_RATE_LIMIT_RPM ?? 120),
    }
  );
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}

export function checkRateLimit(key: string, config?: RateLimitConfig): void {
  const resolved = resolveConfig(config);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { count: 0, windowStart: now };

  if (now - bucket.windowStart >= resolved.windowMs) {
    bucket.count = 0;
    bucket.windowStart = now;
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > resolved.maxRequests) {
    throw new RateLimitExceededError("Rate limit exceeded");
  }
}
