import type { MotionEngine } from "./motion-engine.js";
import { CesdkMotionEngine } from "./cesdk-motion-engine.js";

let motionEngine: MotionEngine | undefined;

export function getMotionEngine(): MotionEngine {
  if (!motionEngine) {
    motionEngine = new CesdkMotionEngine();
  }
  return motionEngine;
}

export function setMotionEngineForTests(engine: MotionEngine | undefined): void {
  motionEngine = engine;
}
