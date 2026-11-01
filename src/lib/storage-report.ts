import { listStemJobs } from "@/audio/separation/stem-store";
import type { ModelFile } from "@/domain/models/model-files";
import type { StorageEstimateBytes } from "@/domain/storage/space";
import type { StemJobUsage } from "@/domain/storage/usage";
import { readStorageEstimate } from "@/lib/browser-storage";
import { listModelFiles } from "@/lib/model-files";
import { unindexedAudioBytes } from "@/lib/project-audio";

// -- Types --------------------------------------------------------------------

interface StorageReport {
  stemJobs: StemJobUsage[];
  unindexedAudioBytes: number;
  modelFiles: ModelFile[];
  estimate: StorageEstimateBytes | undefined;
}

// -- Reads --------------------------------------------------------------------

async function readStorageReport(): Promise<StorageReport> {
  const [stemJobs, unindexed, modelFiles, estimate] = await Promise.all([
    listStemJobs(),
    unindexedAudioBytes(),
    listModelFiles(),
    readStorageEstimate(),
  ]);
  return { stemJobs, unindexedAudioBytes: unindexed, modelFiles, estimate };
}

// -- Exports ------------------------------------------------------------------

export { readStorageReport };
export type { StorageReport };
