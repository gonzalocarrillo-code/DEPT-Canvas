let tier2CandidateCount = 0;

export function incrementTier2CandidateMetric(_reason: string): number {
  tier2CandidateCount += 1;
  return tier2CandidateCount;
}

export function readTier2CandidateMetric(): number {
  return tier2CandidateCount;
}

export function resetTier2CandidateMetricForTests(): void {
  tier2CandidateCount = 0;
}

export function lastTier2CandidateReason(): string | undefined {
  return lastReason;
}

let lastReason: string | undefined;

export function recordTier2Candidate(reason: string): void {
  lastReason = reason;
  incrementTier2CandidateMetric(reason);
}
