import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../vitest.config.js";

export default mergeConfig(rootConfig, defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["tests/**/*.test.ts"],
  },
}));
