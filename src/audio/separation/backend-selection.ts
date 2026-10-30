import { type Backend, WEBGPU_POWER_PREFERENCE } from "@/audio/ort-runtime";
import { describeError } from "@/audio/separation/worker-log";
import type { VocalModelVariant } from "@/stores/settings";

type BackendChoice =
  | { backend: "webgpu"; adapterLabel: string; hasTimestampQuery: boolean | null; hasShaderF16: boolean }
  | { backend: Extract<Backend, "wasm">; reason: string };

interface GpuAdapterInfoLike {
  vendor?: string;
  architecture?: string;
  description?: string;
  isFallbackAdapter?: boolean;
}

interface GpuAdapterLike {
  features?: { has(feature: string): boolean };
  isFallbackAdapter?: boolean;
  info?: GpuAdapterInfoLike;
  requestAdapterInfo?: () => Promise<GpuAdapterInfoLike>;
}

// A software adapter (e.g. Linux Chrome without Vulkan) stalls HTDemucs for minutes, so use WASM.
async function chooseBackend(forceWasm: boolean | undefined): Promise<BackendChoice> {
  if (forceWasm) return { backend: "wasm", reason: "WASM was requested explicitly" };
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(o?: object): Promise<GpuAdapterLike | null> } }).gpu;
  if (!gpu) return { backend: "wasm", reason: "WebGPU is not available in this browser" };

  let adapter: GpuAdapterLike | null;
  try {
    adapter = await gpu.requestAdapter({ powerPreference: WEBGPU_POWER_PREFERENCE });
  } catch (err) {
    return { backend: "wasm", reason: `requesting a WebGPU adapter failed (${describeError(err)})` };
  }
  if (!adapter) {
    return {
      backend: "wasm",
      reason: "no WebGPU adapter is available (on Linux Chrome, try enabling chrome://flags/#enable-vulkan)",
    };
  }

  const info = adapter.info ?? (await adapter.requestAdapterInfo?.().catch(() => undefined));
  const adapterLabel = [info?.vendor, info?.architecture, info?.description].filter(Boolean).join(" ") || "unknown GPU";
  if (adapter.isFallbackAdapter ?? info?.isFallbackAdapter) {
    return {
      backend: "wasm",
      reason: `WebGPU only offers a software adapter (${adapterLabel}), which runs on the CPU and is too slow for this model (on Linux Chrome, try enabling chrome://flags/#enable-vulkan)`,
    };
  }
  return {
    backend: "webgpu",
    adapterLabel,
    hasTimestampQuery: adapter.features?.has("timestamp-query") ?? null,
    hasShaderF16: adapter.features?.has("shader-f16") ?? false,
  };
}

// fp16 needs WebGPU shader-f16, and on WASM it is about 4x slower than fp32, so both cases run fp32 instead.
function runnableVariant(
  variant: VocalModelVariant,
  choice: BackendChoice,
): { variant: VocalModelVariant; fallbackReason: string | null } {
  if (variant !== "fp16") return { variant, fallbackReason: null };
  if (choice.backend === "wasm") {
    return { variant: "fp32", fallbackReason: "the fp16 vocal model is slow on WASM (CPU), so using fp32" };
  }
  if (!choice.hasShaderF16) {
    return {
      variant: "fp32",
      fallbackReason: `this GPU (${choice.adapterLabel}) has no WebGPU shader-f16 support, so using the fp32 vocal model`,
    };
  }
  return { variant, fallbackReason: null };
}

export { chooseBackend, runnableVariant };
