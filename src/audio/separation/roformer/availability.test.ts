import { roformerSupport } from "@/audio/separation/roformer/availability";
import { describe, expect, it } from "vitest";

const webgpu = (hasShaderF16: boolean) => ({
  backend: "webgpu" as const,
  adapterLabel: "test gpu",
  hasTimestampQuery: null,
  hasShaderF16,
});

describe("roformerSupport", () => {
  it("offers the RoFormer only on WebGPU with shader-f16, with a reason otherwise", () => {
    expect(roformerSupport(webgpu(true))).toEqual({ supported: true });
    expect(roformerSupport(webgpu(false))).toMatchObject({
      supported: false,
      reason: expect.stringContaining("shader-f16"),
    });
    expect(roformerSupport({ backend: "wasm", reason: "no adapter" })).toMatchObject({ supported: false });
  });
});
