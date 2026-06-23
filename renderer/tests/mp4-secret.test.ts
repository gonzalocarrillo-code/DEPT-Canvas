import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

const { renderMp4ViaContainer } = await import("../src/cesdk-render.js");

describe("renderMp4ViaContainer secret handling", () => {
  afterEach(() => {
    delete process.env.CESDK_LICENSE;
    vi.clearAllMocks();
  });

  it("never embeds the CESDK_LICENSE value in the docker argv", async () => {
    process.env.CESDK_LICENSE = "super-secret-license-value";
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter();
      setImmediate(() => child.emit("exit", 0));
      return child;
    });

    await renderMp4ViaContainer("tenant/t/scenes/s.scene", {
      width: 1080,
      height: 1920,
      format: "mp4",
    });

    expect(spawnMock).toHaveBeenCalled();
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain("CESDK_LICENSE"); // var passed by NAME
    expect(args.join(" ")).not.toContain("super-secret-license-value"); // value NOT in argv
  });
});
