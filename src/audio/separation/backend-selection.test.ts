import { runnableVariant } from "@/audio/separation/backend-selection";
import { describe, expect, it } from "vitest";

const webgpu = (hasShaderF16: boolean) => ({
  backend: "webgpu" as const,
  adapterLabel: "test gpu",
  hasTimestampQuery: null,
  hasShaderF16,
});
const wasm = { backend: "wasm" as const, reason: "test" };

describe("runnableVariant", () => {
  it("runs fp32 instead of fp16 on a WebGPU device without shader-f16", () => {
    const runnable = runnableVariant("fp16", webgpu(false));
    expect(runnable.variant).toBe("fp32");
    expect(runnable.fallbackReason).toContain("test gpu");
  });

  it("runs fp32 instead of fp16 on WASM", () => {
    expect(runnableVariant("fp16", wasm).variant).toBe("fp32");
  });

  it("keeps fp16 when the device supports shader-f16", () => {
    expect(runnableVariant("fp16", webgpu(true))).toEqual({ variant: "fp16", fallbackReason: null });
  });

  it("always keeps fp32", () => {
    expect(runnableVariant("fp32", webgpu(false))).toEqual({ variant: "fp32", fallbackReason: null });
    expect(runnableVariant("fp32", wasm)).toEqual({ variant: "fp32", fallbackReason: null });
  });
});
