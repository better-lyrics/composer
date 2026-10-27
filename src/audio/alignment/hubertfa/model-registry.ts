import {
  type AlignmentModel,
  DICTIONARY_APPROX_BYTES,
  resolveAlignmentModel,
} from "@/audio/alignment/hubertfa/model-manifest";
import { type CachedModel, hasCachedModel } from "@/audio/separation/model-cache";
import { getModelBaseUrl } from "@/audio/separation/model-registry";

// -- Types --------------------------------------------------------------------

interface AlignmentAssets {
  model: CachedModel;
  dictionary: CachedModel;
  /** kuromoji's IPADIC files (gzipped), needed only to read kanji. */
  japaneseDictionary: Record<string, CachedModel>;
  approxBytes: number;
  languages: readonly string[];
}

// -- Constants ----------------------------------------------------------------

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

// The kanji dictionary is hosted next to the vocal separation model whichever
// alignment model is selected.
function getAlignmentAssets(model: AlignmentModel): AlignmentAssets | null {
  const base = getModelBaseUrl();
  if (!base) return null;
  return {
    model: { url: model.modelUrl, approxBytes: model.approxBytes },
    dictionary: { url: model.dictionaryUrl, approxBytes: DICTIONARY_APPROX_BYTES },
    japaneseDictionary: Object.fromEntries(
      Object.entries(JAPANESE_DICTIONARY_FILES).map(([name, approxBytes]) => [
        name,
        { url: `${base}/${JAPANESE_DICTIONARY_DIR}/${name}`, approxBytes },
      ]),
    ),
    approxBytes: model.approxBytes + DICTIONARY_APPROX_BYTES,
    languages: model.languages,
  };
}

async function resolveAlignmentAssets(modelId: string): Promise<AlignmentAssets | null> {
  const model = await resolveAlignmentModel(modelId);
  return model ? getAlignmentAssets(model) : null;
}

// The kanji dictionary is left out: it's fetched only for Japanese lyrics.
async function areAlignmentAssetsCached(assets: AlignmentAssets | null): Promise<boolean> {
  if (!assets) return false;
  const [model, dictionary] = await Promise.all([hasCachedModel(assets.model), hasCachedModel(assets.dictionary)]);
  return model && dictionary;
}

// -- Exports ------------------------------------------------------------------

export { areAlignmentAssetsCached, resolveAlignmentAssets };
export type { AlignmentAssets };
