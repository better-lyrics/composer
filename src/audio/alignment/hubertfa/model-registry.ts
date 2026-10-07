import type { CachedAsset } from "@/audio/separation/model-cache";
import { getModelBaseUrl } from "@/audio/separation/model-registry";

// -- Types --------------------------------------------------------------------

interface AlignmentAssets {
  model: CachedAsset;
  dictionary: CachedAsset;
  approxMb: number;
}

// -- Constants ----------------------------------------------------------------

// HubertFA v0.0.7 (Apache-2.0) in fp32, with its two fp32 -> fp16 -> fp32 Cast
// round-trips removed: WebGPU can only run fp16 casts on GPUs with shader-f16,
// and the round-trips only dropped precision.
const MODEL_FILENAME = "hubertfa_v007_fp32_webgpu.onnx";
const MODEL_APPROX_BYTES = 396 * 1024 * 1024;
const DICTIONARY_FILENAME = "hubertfa_v007_cmudict.txt";
const DICTIONARY_APPROX_BYTES = 3.3 * 1024 * 1024;

// -- Functions ----------------------------------------------------------------

// Hosted next to the vocal separation model.
function getAlignmentAssets(): AlignmentAssets | null {
  const base = getModelBaseUrl();
  if (!base) return null;
  return {
    model: { url: `${base}/${MODEL_FILENAME}`, approxBytes: MODEL_APPROX_BYTES },
    dictionary: { url: `${base}/${DICTIONARY_FILENAME}`, approxBytes: DICTIONARY_APPROX_BYTES },
    approxMb: Math.round((MODEL_APPROX_BYTES + DICTIONARY_APPROX_BYTES) / (1024 * 1024)),
  };
}

// -- Exports ------------------------------------------------------------------

export { getAlignmentAssets };
