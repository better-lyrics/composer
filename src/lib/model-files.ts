import { BEAT_MODEL } from "@/audio/beat/beat-model";
import { MODEL_CACHE_NAME } from "@/audio/separation/model-cache";
import { VOCAL_MODEL_FILENAMES } from "@/audio/separation/model-registry";
import {
  type KnownModelUrls,
  type ModelFile,
  type ModelKind,
  groupModelFiles,
  modelFileName,
} from "@/domain/models/model-files";
import { notifyStorageSignal } from "@/lib/storage-signals";
import { useAlignmentStore } from "@/stores/alignment";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useSeparationStore } from "@/stores/separation";
import type { VocalModelVariant } from "@/stores/settings";

// -- Errors -------------------------------------------------------------------

class ModelInUseError extends Error {
  constructor(kind: ModelKind) {
    super(`The ${kind} model is downloading or running`);
    this.name = "ModelInUseError";
  }
}

// -- Helpers ------------------------------------------------------------------

function knownModelUrls(): KnownModelUrls {
  return { vocalFileNames: Object.values(VOCAL_MODEL_FILENAMES), beatUrl: BEAT_MODEL.url };
}

function vocalVariantOfFile(url: string): VocalModelVariant | undefined {
  const name = modelFileName(url);
  return (Object.keys(VOCAL_MODEL_FILENAMES) as VocalModelVariant[]).find(
    (variant) => VOCAL_MODEL_FILENAMES[variant] === name,
  );
}

// -- Reads --------------------------------------------------------------------

async function listModelFiles(): Promise<ModelFile[]> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(MODEL_CACHE_NAME);
  const requests = await cache.keys();
  return Promise.all(
    requests.map(async (request) => {
      const blob = await (await cache.match(request))?.blob();
      return { url: request.url, bytes: blob?.size ?? 0 };
    }),
  );
}

// A model held in memory is not busy: deleting its cache entry does not unload it.
function modelKindBusy(kind: ModelKind): boolean {
  if (kind === "vocal") {
    const { status } = useSeparationStore.getState();
    return status === "downloading" || status === "processing";
  }
  if (kind === "alignment") {
    const { status } = useAlignmentStore.getState();
    return status === "downloading" || status === "running";
  }
  const { status } = useBeatDetectionStore.getState();
  return status === "downloading" || status === "detecting";
}

// -- Writes -------------------------------------------------------------------

async function removeModelFiles(kind: ModelKind, onlyUrls?: readonly string[]): Promise<void> {
  if (modelKindBusy(kind)) throw new ModelInUseError(kind);
  if (typeof caches === "undefined") return;
  const wanted = onlyUrls ? new Set(onlyUrls) : null;
  const files = groupModelFiles(await listModelFiles(), knownModelUrls())[kind].filter(
    (file) => !wanted || wanted.has(file.url),
  );
  if (files.length === 0) return;
  const cache = await caches.open(MODEL_CACHE_NAME);
  if (modelKindBusy(kind)) throw new ModelInUseError(kind);
  await Promise.all(files.map((file) => cache.delete(file.url)));
  notifyStorageSignal("media-removed");
  await Promise.all([
    useSeparationStore.getState().refreshModelCacheStatus(),
    useAlignmentStore.getState().refreshModelCached(),
  ]);
}

// -- Exports ------------------------------------------------------------------

export { ModelInUseError, knownModelUrls, listModelFiles, modelKindBusy, removeModelFiles, vocalVariantOfFile };
