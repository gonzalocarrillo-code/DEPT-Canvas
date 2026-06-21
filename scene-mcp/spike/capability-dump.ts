import { CreativeEngine, type CreativeEngineInstance } from "./cesdk-import.js";
import { assertNoKeyframeApi, initEngine } from "./engine-config.js";
import {
  loadAnimationTypesFromPackage,
  loadBlurTypesFromPackage,
} from "./package-types.js";

export interface PropertyInfo {
  key: string;
  type: string;
  enumValues?: string[];
  readable: boolean;
  writable: boolean;
}

export interface AnimationCapability {
  type: string;
  shorthand: string;
  properties: PropertyInfo[];
}

export interface BlurCapability {
  type: string;
  shorthand: string;
  properties: PropertyInfo[];
}

export interface CapabilityReport {
  cesdkVersion: string;
  generatedAt: string;
  hasKeyframeApi: boolean;
  animationEasing: string[];
  animationTypes: AnimationCapability[];
  blurTypes: BlurCapability[];
  fillColorKey: string | null;
}

function introspectBlock(
  engine: CreativeEngineInstance,
  blockId: number,
): PropertyInfo[] {
  const keys = engine.block.findAllProperties(blockId);
  return keys.map((key: string) => {
    const info: PropertyInfo = {
      key,
      type: engine.block.getPropertyType(key),
      readable: engine.block.isPropertyReadable(key),
      writable: engine.block.isPropertyWritable(key),
    };
    if (info.type === "Enum") {
      info.enumValues = engine.block.getEnumValues(key);
    }
    return info;
  });
}

export async function buildCapabilityReport(
  engine?: CreativeEngineInstance,
): Promise<{ report: CapabilityReport; engine: CreativeEngineInstance; ownsEngine: boolean }> {
  const ownsEngine = !engine;
  const eng = engine ?? (await initEngine());

  const slideAnim = eng.block.createAnimation("slide");
  const animationEasing = eng.block.getEnumValues("animationEasing");

  const animationTypes: AnimationCapability[] = [];
  for (const shorthand of loadAnimationTypesFromPackage()) {
    let animId: number | null = null;
    try {
      animId = eng.block.createAnimation(shorthand);
      animationTypes.push({
        type: `//ly.img.ubq/animation/${shorthand}`,
        shorthand,
        properties: introspectBlock(eng, animId as number),
      });
    } catch {
      animationTypes.push({
        type: `//ly.img.ubq/animation/${shorthand}`,
        shorthand,
        properties: [],
      });
    } finally {
      if (animId !== null) {
        eng.block.destroy(animId);
      }
    }
  }

  const blurTypes: BlurCapability[] = [];
  for (const shorthand of loadBlurTypesFromPackage()) {
    let blurId: number | null = null;
    try {
      blurId = eng.block.createBlur(shorthand);
      blurTypes.push({
        type: `//ly.img.ubq/blur/${shorthand}`,
        shorthand,
        properties: introspectBlock(eng, blurId as number),
      });
    } catch {
      blurTypes.push({
        type: `//ly.img.ubq/blur/${shorthand}`,
        shorthand,
        properties: [],
      });
    } finally {
      if (blurId !== null) {
        eng.block.destroy(blurId);
      }
    }
  }

  eng.block.destroy(slideAnim);

  const scene = eng.scene.create("Free");
  const page = eng.block.create("page");
  eng.block.appendChild(scene, page);
  const graphic = eng.block.create("graphic");
  eng.block.appendChild(page, graphic);
  const fill = eng.block.createFill("color");
  eng.block.setFill(graphic, fill);

  const graphicProps = eng.block.findAllProperties(graphic);
  const fillColorKey = graphicProps.includes("fill/color/value")
    ? "fill/color/value"
    : graphicProps.includes("fill/solid/color")
      ? "fill/solid/color"
      : null;

  eng.block.destroy(scene);

  const report: CapabilityReport = {
    cesdkVersion: CreativeEngine.version,
    generatedAt: new Date().toISOString(),
    hasKeyframeApi: !assertNoKeyframeApi(eng),
    animationEasing,
    animationTypes,
    blurTypes,
    fillColorKey,
  };

  return { report, engine: eng, ownsEngine };
}
