import type { CachedModel } from "@/audio/separation/model-cache";
import { ROFORMER_APPROX_BYTES, roformerParts } from "@/audio/separation/roformer/model-parts";
import type { VocalModelVariant } from "@/stores/settings";

/** The HTDemucs builds; the other vocal model, the RoFormer, is a chain of graphs (roformer/model-parts.ts). */
type HtdemucsVariant = Exclude<VocalModelVariant, "roformer">;

interface ModelDescriptor {
  variant: HtdemucsVariant;
  url: string;
  filename: string;
  approxBytes: number;
}

// Versioned so browsers that cached the old whole-graph fp16 model, which returns NaN on WebGPU, fetch the
// mixed-precision rebuild. Keep in sync with scripts/upload-htdemucs.sh.
const MODEL_FILENAMES: Record<HtdemucsVariant, string> = {
  fp16: "htdemucs_fp16_v2.onnx",
  fp32: "htdemucs_fp32.onnx",
};

// Still in some browsers' model cache, so Settings lists them as vocal files the user can remove.
const RETIRED_VOCAL_MODEL_FILENAMES = ["htdemucs_fp16.onnx"] as const;

const VOCAL_MODEL_APPROX_BYTES: Record<VocalModelVariant, number> = {
  fp16: 85 * 1024 * 1024,
  fp32: 171 * 1024 * 1024,
  roformer: ROFORMER_APPROX_BYTES,
};

function getBaseUrl(): string | null {
  const raw = import.meta.env.VITE_VOCAL_MODEL_BASE_URL;
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

function getModelDescriptor(variant: HtdemucsVariant): ModelDescriptor | null {
  const base = getBaseUrl();
  if (!base) return null;
  const filename = MODEL_FILENAMES[variant];
  const approxBytes = VOCAL_MODEL_APPROX_BYTES[variant];
  return {
    variant,
    url: `${base}/${filename}`,
    filename,
    approxBytes,
  };
}

/** Every file a vocal model downloads, or null when model hosting isn't configured. */
function vocalModelFiles(variant: VocalModelVariant): CachedModel[] | null {
  const base = getBaseUrl();
  if (!base) return null;
  if (variant === "roformer") return roformerParts(base).flatMap((part) => part.pieces);
  const descriptor = getModelDescriptor(variant);
  return descriptor ? [descriptor] : null;
}

function isModelHostingConfigured(): boolean {
  return getBaseUrl() !== null;
}

export {
  getBaseUrl as getModelBaseUrl,
  getModelDescriptor,
  isModelHostingConfigured,
  MODEL_FILENAMES as VOCAL_MODEL_FILENAMES,
  RETIRED_VOCAL_MODEL_FILENAMES,
  VOCAL_MODEL_APPROX_BYTES,
  vocalModelFiles,
};
export type { HtdemucsVariant, ModelDescriptor };
