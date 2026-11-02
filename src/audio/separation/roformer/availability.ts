import { type BackendChoice, chooseBackend } from "@/audio/separation/backend-selection";

// -- Types --------------------------------------------------------------------

type RoformerSupport = { supported: true } | { supported: false; reason: string };

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[roformer]";

// -- State --------------------------------------------------------------------

let supportPromise: Promise<RoformerSupport> | null = null;

// -- Functions ----------------------------------------------------------------

// Only an fp16 build fits in browser GPU memory, and WASM would take hours, so the model needs WebGPU with shader-f16.
function roformerSupport(choice: BackendChoice): RoformerSupport {
  if (choice.backend !== "webgpu")
    return { supported: false, reason: "Needs WebGPU, which this browser can't use here." };
  if (!choice.hasShaderF16) return { supported: false, reason: "Needs a GPU with WebGPU shader-f16." };
  return { supported: true };
}

/** Whether this browser and GPU can run the model, probed once per page load. */
function probeRoformerSupport(): Promise<RoformerSupport> {
  supportPromise ??= chooseBackend(false)
    .then(roformerSupport)
    .catch((err: unknown) => {
      console.warn(LOG_PREFIX, "could not probe WebGPU", err);
      return { supported: false, reason: "Couldn't check this GPU for WebGPU support." } as const;
    });
  return supportPromise;
}

// -- Exports ------------------------------------------------------------------

export { probeRoformerSupport, roformerSupport };
export type { RoformerSupport };
