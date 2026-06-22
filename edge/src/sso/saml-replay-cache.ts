const seenAssertionIds = new Map<string, number>();
const REPLAY_TTL_MS = 24 * 60 * 60 * 1000;

export function assertAssertionNotReplayed(assertionId: string): void {
  const now = Date.now();
  for (const [id, expiresAt] of seenAssertionIds.entries()) {
    if (expiresAt <= now) {
      seenAssertionIds.delete(id);
    }
  }
  if (seenAssertionIds.has(assertionId)) {
    throw new Error("SAML assertion replay detected");
  }
  seenAssertionIds.set(assertionId, now + REPLAY_TTL_MS);
}

export function clearSamlReplayCacheForTests(): void {
  seenAssertionIds.clear();
}
