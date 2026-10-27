import { getModelBaseUrl } from "@/audio/separation/model-registry";
import { baseLanguage, isAlignableLanguage } from "@/domain/alignment/language";

// -- Types --------------------------------------------------------------------

/** One selectable alignment checkpoint. Every model must share the bundled phone vocabulary. */
interface AlignmentModel {
  id: string;
  label: string;
  modelUrl: string;
  dictionaryUrl: string;
  approxBytes: number;
  /** Base language codes the checkpoint was trained for, such as "en". */
  languages: string[];
  /** Marked in the manifest as the one to use; the picker tags it. */
  recommended: boolean;
}

// -- Constants ----------------------------------------------------------------

const MIB = 1024 * 1024;

// HubertFA v0.0.7 (Apache-2.0) in fp32, with its two fp32 -> fp16 -> fp32 Cast
// round-trips removed: WebGPU can only run fp16 casts on GPUs with shader-f16,
// and the round-trips only dropped precision.
const BUILTIN_ALIGNMENT_MODEL = {
  id: "hubertfa-v007",
  label: "HubertFA v0.0.7",
  filename: "hubertfa_v007_fp32_webgpu.onnx",
  approxBytes: 396 * MIB,
  languages: ["en", "zh", "ja"],
};
/** The default setting: whichever model the manifest recommends, so a new recommendation reaches everyone who didn't pick one. */
const RECOMMENDED_ALIGNMENT_MODEL = "recommended";
const DICTIONARY_FILENAME = "hubertfa_v007_cmudict.txt";
const DICTIONARY_APPROX_BYTES = 3.3 * MIB;
const MANIFEST_FILENAME = "hubertfa-models.json";
const LOG_PREFIX = "[alignment-models]";

// -- State --------------------------------------------------------------------

let modelsPromise: Promise<AlignmentModel[]> | null = null;

// -- Functions ----------------------------------------------------------------

function builtinModel(baseUrl: string): AlignmentModel {
  return {
    id: BUILTIN_ALIGNMENT_MODEL.id,
    label: BUILTIN_ALIGNMENT_MODEL.label,
    modelUrl: `${baseUrl}/${BUILTIN_ALIGNMENT_MODEL.filename}`,
    dictionaryUrl: `${baseUrl}/${DICTIONARY_FILENAME}`,
    approxBytes: BUILTIN_ALIGNMENT_MODEL.approxBytes,
    languages: BUILTIN_ALIGNMENT_MODEL.languages,
    recommended: false,
  };
}

// The base language of a code ("en_US" -> "en"), or null for one Intl can't
// name: the picker names languages with Intl.DisplayNames, which throws on those.
function canonicalBase(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const base = code.trim().replaceAll("_", "-").split("-")[0].toLowerCase();
  try {
    return Intl.getCanonicalLocales(base)[0] ?? null;
  } catch (err) {
    console.warn(`${LOG_PREFIX} skipping language code ${JSON.stringify(code)}`, err);
    return null;
  }
}

// A checkpoint that lists no readable language keeps the base model's. Listed
// languages auto-align can't run are dropped, so a model never claims them.
function parseLanguages(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const listed = raw.map(canonicalBase).filter((code): code is string => code !== null);
  if (listed.length === 0) return fallback;
  return [...new Set(listed.filter(isAlignableLanguage).map((code) => baseLanguage(code) ?? code))];
}

function parseEntry(raw: unknown, manifestUrl: string, fallback: AlignmentModel): AlignmentModel | null {
  if (!raw || typeof raw !== "object") return null;
  const { id, label, model, dictionary, sizeMb, languages, recommended } = raw as Record<string, unknown>;
  if (typeof id !== "string" || !id || typeof model !== "string" || !model) return null;
  if (id === RECOMMENDED_ALIGNMENT_MODEL) {
    console.warn(`${LOG_PREFIX} skipping manifest entry ${id}: that id is reserved for following the recommendation`);
    return null;
  }
  try {
    return {
      id,
      label: typeof label === "string" && label ? label : id,
      modelUrl: new URL(model, manifestUrl).href,
      dictionaryUrl: typeof dictionary === "string" ? new URL(dictionary, manifestUrl).href : fallback.dictionaryUrl,
      approxBytes: typeof sizeMb === "number" && sizeMb > 0 ? sizeMb * MIB : fallback.approxBytes,
      languages: parseLanguages(languages, fallback.languages),
      recommended: recommended === true,
    };
  } catch (err) {
    console.warn(`${LOG_PREFIX} skipping manifest entry ${id}: bad URL`, err);
    return null;
  }
}

// Relative paths resolve against the manifest, so a manifest can sit next to
// its checkpoints anywhere. The built-in model is always first and wins its id.
function parseAlignmentManifest(json: unknown, manifestUrl: string, baseUrl: string): AlignmentModel[] {
  const builtin = builtinModel(baseUrl);
  const entries = (json as { models?: unknown } | null)?.models;
  const models = [builtin];
  if (!Array.isArray(entries)) return models;
  for (const raw of entries) {
    const model = parseEntry(raw, manifestUrl, builtin);
    if (model && !models.some((m) => m.id === model.id)) models.push(model);
  }
  return models;
}

function getManifestUrl(baseUrl: string): string {
  const override = import.meta.env.VITE_ALIGNMENT_MODEL_MANIFEST_URL;
  return typeof override === "string" && override.trim() ? override.trim() : `${baseUrl}/${MANIFEST_FILENAME}`;
}

// No manifest is the normal case for a deployment: only the built-in model.
async function fetchModels(baseUrl: string): Promise<AlignmentModel[]> {
  const url = getManifestUrl(baseUrl);
  try {
    // The models host caches everything at the edge; the manifest must stay fresh.
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 404) return [builtinModel(baseUrl)];
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return parseAlignmentManifest(await response.json(), url, baseUrl);
  } catch (err) {
    console.warn(`${LOG_PREFIX} could not load ${url}; only the built-in model is available`, err);
    return [builtinModel(baseUrl)];
  }
}

/** Every selectable model, fetched once per page load. Empty when model hosting isn't configured. */
function loadAlignmentModels(): Promise<AlignmentModel[]> {
  const baseUrl = getModelBaseUrl();
  if (!baseUrl) return Promise.resolve([]);
  modelsPromise ??= fetchModels(baseUrl);
  return modelsPromise;
}

/** The model a setting means: the recommended one, the one picked by hand, or the built-in one when neither exists. */
function pickAlignmentModel(models: readonly AlignmentModel[], id: string): AlignmentModel | null {
  const wanted =
    id === RECOMMENDED_ALIGNMENT_MODEL ? models.find((m) => m.recommended) : models.find((m) => m.id === id);
  return wanted ?? models[0] ?? null;
}

async function resolveAlignmentModel(id: string): Promise<AlignmentModel | null> {
  return pickAlignmentModel(await loadAlignmentModels(), id);
}

// -- Exports ------------------------------------------------------------------

export {
  BUILTIN_ALIGNMENT_MODEL,
  DICTIONARY_APPROX_BYTES,
  loadAlignmentModels,
  RECOMMENDED_ALIGNMENT_MODEL,
  parseAlignmentManifest,
  pickAlignmentModel,
  resolveAlignmentModel,
};
export type { AlignmentModel };
