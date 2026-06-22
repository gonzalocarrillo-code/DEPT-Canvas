export type MotionRealization = "native" | "composed";

export interface MotionResult {
  realizedAs: MotionRealization;
  appliedPresets: string[];
}

export interface Tier2Candidate {
  tier2Candidate: true;
  reason: string;
}

export type MotionCapabilities = {
  keyframeTracks: boolean;
  customBezier: boolean;
  easings: string[];
  groupAnimation: boolean;
  transitions: boolean;
};

export interface MotionEngine {
  applyIntent(
    jobId: string,
    tenantId: string,
    userId: string,
    blockId: number,
    intent: string,
    params?: Record<string, number | string>,
  ): Promise<MotionResult | Tier2Candidate>;

  stagger(
    jobId: string,
    tenantId: string,
    userId: string,
    blockIds: number[],
    timing: { stepSec: number },
  ): Promise<MotionResult | Tier2Candidate>;

  setTiming(
    jobId: string,
    tenantId: string,
    userId: string,
    blockId: number,
    timing: { start: number; duration: number },
  ): Promise<MotionResult | Tier2Candidate>;

  sequence(
    jobId: string,
    tenantId: string,
    userId: string,
    sceneIds: number[],
    offsets: number[],
  ): Promise<MotionResult | Tier2Candidate>;

  capabilities(): MotionCapabilities;

  render(sceneRef: string, format: "mp4" | "png" | "pdf"): Promise<string>;
}

export function isTier2Candidate(
  result: MotionResult | Tier2Candidate,
): result is Tier2Candidate {
  return "tier2Candidate" in result && result.tier2Candidate === true;
}
