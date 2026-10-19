import { loadOrt } from "@/audio/separation/ort-runtime";
import { describe, expect, it } from "vitest";

describe("loadOrt", () => {
  it("reuses the loaded runtime for the same backend", async () => {
    expect(await loadOrt("wasm", false)).toBe(await loadOrt("wasm", false));
  });

  describe("regressions", () => {
    it("regression: does not hand a WebGPU init the runtime cached for WASM", async () => {
      const wasm = await loadOrt("wasm", false);
      const webgpu = await loadOrt("webgpu", false);
      expect(webgpu).not.toBe(wasm);
      expect(webgpu.env.webgpu).toBeDefined();
    });
  });
});
