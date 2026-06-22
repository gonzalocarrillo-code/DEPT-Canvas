import { describe, expect, it } from "vitest";
import { mountDeptCanvasApp } from "../src/main.js";

describe("Vite browser app", () => {
  it("mounts the editor shell into the root element", () => {
    const root = {
      attributes: new Map<string, string>(),
      innerHTML: "",
      setAttribute(name: string, value: string) {
        this.attributes.set(name, value);
      },
    };

    mountDeptCanvasApp(root, {
      initializeCesdk: false,
    });

    expect(root.attributes.get("data-app-mounted")).toBe("true");
    expect(root.innerHTML).toContain('class="dc-shell dc-editor-screen"');
    expect(root.innerHTML).toContain('data-region="center-canvas"');
    expect(root.innerHTML).toContain('id="dept-cesdk-editor"');
    expect(root.innerHTML).toContain('data-region="right-panel"');
  });
});
