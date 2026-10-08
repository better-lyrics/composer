import type { CachedAsset } from "@/audio/separation/model-cache";
import { getModelBaseUrl } from "@/audio/separation/model-registry";

// -- Types --------------------------------------------------------------------

interface AlignmentAssets {
  model: CachedAsset;
  dictionary: CachedAsset;
  /** kuromoji's IPADIC files (gzipped), needed only to read kanji. */
  japaneseDictionary: Record<string, CachedAsset>;
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
const JAPANESE_DICTIONARY_DIR = "kuromoji-ipadic";
const JAPANESE_DICTIONARY_FILES: Record<string, number> = {
  "base.dat.gz": 3956825,
  "cc.dat.gz": 1692067,
  "check.dat.gz": 3111633,
  "tid.dat.gz": 1605820,
  "tid_map.dat.gz": 1485576,
  "tid_pos.dat.gz": 5916009,
  "unk.dat.gz": 10512,
  "unk_char.dat.gz": 306,
  "unk_compat.dat.gz": 338,
  "unk_invoke.dat.gz": 1140,
  "unk_map.dat.gz": 1190,
  "unk_pos.dat.gz": 10540,
};

// -- Functions ----------------------------------------------------------------

// Hosted next to the vocal separation model.
function getAlignmentAssets(): AlignmentAssets | null {
  const base = getModelBaseUrl();
  if (!base) return null;
  return {
    model: { url: `${base}/${MODEL_FILENAME}`, approxBytes: MODEL_APPROX_BYTES },
    dictionary: { url: `${base}/${DICTIONARY_FILENAME}`, approxBytes: DICTIONARY_APPROX_BYTES },
    japaneseDictionary: Object.fromEntries(
      Object.entries(JAPANESE_DICTIONARY_FILES).map(([name, approxBytes]) => [
        name,
        { url: `${base}/${JAPANESE_DICTIONARY_DIR}/${name}`, approxBytes },
      ]),
    ),
    approxMb: Math.round((MODEL_APPROX_BYTES + DICTIONARY_APPROX_BYTES) / (1024 * 1024)),
  };
}

// -- Exports ------------------------------------------------------------------

export { getAlignmentAssets };
