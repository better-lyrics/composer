import { type Backend, WEBGPU_POWER_PREFERENCE } from "@/audio/separation/ort-runtime";
import { describeError } from "@/audio/separation/worker-log";

type BackendChoice =
  | { backend: "webgpu"; adapterLabel: string; hasTimestampQuery: boolean | null }
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
  };
}

export { chooseBackend };
