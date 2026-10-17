import { listStemJobs } from "@/audio/separation/stem-store";
import type { StorageEstimateBytes } from "@/domain/storage/space";
import type { StemJobUsage } from "@/domain/storage/usage";
import { readStorageEstimate } from "@/lib/browser-storage";
import { unindexedAudioBytes } from "@/lib/project-audio";

// -- Types --------------------------------------------------------------------

interface StorageReport {
  stemJobs: StemJobUsage[];
  unindexedAudioBytes: number;
  estimate: StorageEstimateBytes | undefined;
}

// -- Reads --------------------------------------------------------------------

async function readStorageReport(): Promise<StorageReport> {
  const [stemJobs, unindexed, estimate] = await Promise.all([
    listStemJobs(),
    unindexedAudioBytes(),
    readStorageEstimate(),
  ]);
  return { stemJobs, unindexedAudioBytes: unindexed, estimate };
}

// -- Exports ------------------------------------------------------------------

export { readStorageReport };
export type { StorageReport };
