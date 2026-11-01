import { BEAT_MODEL } from "@/audio/beat/beat-model";
import { MODEL_CACHE_NAME } from "@/audio/separation/model-cache";
import { getModelDescriptor } from "@/audio/separation/model-registry";
import { type KnownModelUrls, type ModelFile, type ModelKind, groupModelFiles } from "@/domain/models/model-files";
import { notifyStorageSignal } from "@/lib/storage-signals";
import { useAlignmentStore } from "@/stores/alignment";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useSeparationStore } from "@/stores/separation";

// -- Errors -------------------------------------------------------------------

class ModelInUseError extends Error {
  constructor(kind: ModelKind) {
    super(`The ${kind} model is downloading or running`);
    this.name = "ModelInUseError";
  }
}

// -- Helpers ------------------------------------------------------------------

function knownModelUrls(): KnownModelUrls {
  const vocalUrls = [getModelDescriptor("fp16"), getModelDescriptor("fp32")].flatMap((descriptor) =>
    descriptor ? [descriptor.url] : [],
  );
  return { vocalUrls, beatUrl: BEAT_MODEL.url };
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

async function removeModelFiles(kind: ModelKind): Promise<void> {
  if (modelKindBusy(kind)) throw new ModelInUseError(kind);
  if (typeof caches === "undefined") return;
  const files = groupModelFiles(await listModelFiles(), knownModelUrls())[kind];
  if (files.length === 0) return;
  const cache = await caches.open(MODEL_CACHE_NAME);
  await Promise.all(files.map((file) => cache.delete(file.url)));
  notifyStorageSignal("media-removed");
  await Promise.all([
    useSeparationStore.getState().refreshModelCacheStatus(),
    useAlignmentStore.getState().refreshModelCached(),
  ]);
}

// -- Exports ------------------------------------------------------------------

export { ModelInUseError, knownModelUrls, listModelFiles, modelKindBusy, removeModelFiles };
