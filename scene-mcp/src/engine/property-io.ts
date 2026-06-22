import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CreativeEngineInstance } from "./cesdk.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type ColorValue = { r: number; g: number; b: number; a: number };

export type PropertyValue = string | number | boolean | ColorValue;

interface CapabilityReportSlice {
  fillColorKey: string | null;
}

let cachedFillColorKey: string | null | undefined;

function loadCapabilityReport(): CapabilityReportSlice {
  const reportPath = path.join(__dirname, "capability-report.json");
  const raw = readFileSync(reportPath, "utf8");
  return JSON.parse(raw) as CapabilityReportSlice;
}

/** Derive solid fill colour key from capability-report.json when available. */
export function resolveFillColorKey(engine?: CreativeEngineInstance): string {
  if (cachedFillColorKey === undefined) {
    try {
      cachedFillColorKey = loadCapabilityReport().fillColorKey;
    } catch {
      cachedFillColorKey = null;
    }
  }

  if (cachedFillColorKey) {
    return cachedFillColorKey;
  }

  if (engine) {
    const graphic = engine.block.create("graphic");
    try {
      const fill = engine.block.createFill("color");
      engine.block.setFill(graphic, fill);
      const props: string[] = engine.block.findAllProperties(graphic);
      if (props.includes("fill/color/value")) {
        return "fill/color/value";
      }
      if (props.includes("fill/solid/color")) {
        return "fill/solid/color";
      }
    } finally {
      engine.block.destroy(graphic);
    }
  }

  return "fill/solid/color";
}

function normalizeColor(value: PropertyValue): ColorValue {
  if (
    typeof value === "object" &&
    value !== null &&
    "r" in value &&
    "g" in value &&
    "b" in value
  ) {
    const color = value as { r: number; g: number; b: number; a?: number };
    return {
      r: color.r,
      g: color.g,
      b: color.b,
      a: color.a ?? 1,
    };
  }
  throw new TypeError("Color property requires { r, g, b, a? }");
}

export function setTypedProperty(
  engine: CreativeEngineInstance,
  blockId: number,
  key: string,
  value: PropertyValue,
): void {
  const type = engine.block.getPropertyType(key);

  switch (type) {
    case "Bool":
      engine.block.setBool(blockId, key, value as boolean);
      return;
    case "Int":
      engine.block.setInt(blockId, key, value as number);
      return;
    case "Float":
      engine.block.setFloat(blockId, key, value as number);
      return;
    case "Double":
      engine.block.setDouble(blockId, key, value as number);
      return;
    case "String":
      engine.block.setString(blockId, key, value as string);
      return;
    case "Enum":
      engine.block.setEnum(blockId, key, value as string);
      return;
    case "Color":
      engine.block.setColor(blockId, key, normalizeColor(value));
      return;
    default:
      throw new Error(`Unsupported property type "${type}" for key "${key}"`);
  }
}

export function getTypedProperty(
  engine: CreativeEngineInstance,
  blockId: number,
  key: string,
): PropertyValue {
  const type = engine.block.getPropertyType(key);

  switch (type) {
    case "Bool":
      return engine.block.getBool(blockId, key) as boolean;
    case "Int":
      return engine.block.getInt(blockId, key) as number;
    case "Float":
      return engine.block.getFloat(blockId, key) as number;
    case "Double":
      return engine.block.getDouble(blockId, key) as number;
    case "String":
      return engine.block.getString(blockId, key) as string;
    case "Enum":
      return engine.block.getEnum(blockId, key) as string;
    case "Color":
      return engine.block.getColor(blockId, key) as ColorValue;
    default:
      throw new Error(`Unsupported property type "${type}" for key "${key}"`);
  }
}

/** Write a solid colour fill using the engine-derived key. */
export function setFillColor(
  engine: CreativeEngineInstance,
  fillBlockId: number,
  value: ColorValue,
): string {
  const key = resolveFillColorKey(engine);
  setTypedProperty(engine, fillBlockId, key, value);
  return key;
}

export function getFillColor(
  engine: CreativeEngineInstance,
  fillBlockId: number,
): { key: string; value: ColorValue } {
  const key = resolveFillColorKey(engine);
  return {
    key,
    value: getTypedProperty(engine, fillBlockId, key) as ColorValue,
  };
}
