import { describeUnsupportedVariant } from "@/audio/separation/backend-selection";
import { describe, expect, it } from "vitest";

const webgpu = (hasShaderF16: boolean) => ({
  backend: "webgpu" as const,
  adapterLabel: "test gpu",
  hasTimestampQuery: null,
  hasShaderF16,
});
const wasm = { backend: "wasm" as const, reason: "test" };

describe("describeUnsupportedVariant", () => {
  it("rejects fp16 on a WebGPU device without shader-f16", () => {
    const message = describeUnsupportedVariant("fp16", webgpu(false));
    expect(message).toContain("shader-f16");
    expect(message).toContain("test gpu");
    expect(message).toContain("fp32");
  });

  it("allows fp16 when the device supports shader-f16", () => {
    expect(describeUnsupportedVariant("fp16", webgpu(true))).toBeNull();
  });

  it("always allows fp32", () => {
    expect(describeUnsupportedVariant("fp32", webgpu(false))).toBeNull();
    expect(describeUnsupportedVariant("fp32", wasm)).toBeNull();
  });

  it("leaves fp16 on the WASM path alone", () => {
    expect(describeUnsupportedVariant("fp16", wasm)).toBeNull();
  });
});
