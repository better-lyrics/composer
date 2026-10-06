import { type Backend, WEBGPU_POWER_PREFERENCE } from "@/audio/separation/ort-runtime";
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

// WebGPU can look available while only a software (CPU-emulated) adapter exists,
// e.g. Linux Chrome without Vulkan. Running HTDemucs on it pegs the CPU and
// stalls for minutes, so treat "no adapter" and "software adapter" as reasons to
// use the WASM path instead.
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

// The fp16 model's WebGPU kernels need the `shader-f16` device feature. Without
// it session creation fails, and the WASM fallback runs fp16 about 4x slower
// than fp32 (and ~60x slower than WebGPU), so refuse up front, before the
// download, with a message the user can act on.
function describeUnsupportedVariant(variant: VocalModelVariant, choice: BackendChoice): string | null {
  if (variant === "fp16" && choice.backend === "webgpu" && !choice.hasShaderF16) {
    return `The fp16 model needs WebGPU shader-f16 support, which this browser/GPU (${choice.adapterLabel}) does not provide. Set the "Vocal model precision" setting to fp32.`;
  }
  return null;
}

export { chooseBackend, describeUnsupportedVariant };
