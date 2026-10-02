import { compareIds } from "@/domain/project/id-order";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";

// -- Types --------------------------------------------------------------------

type UsageEntry = Pick<ProjectIndexEntry, "audioKind" | "storedAudioBytes" | "recordBytes">;

interface StemJobUsage {
  jobKey: string;
  bytes: number;
  createdAt: number;
}

interface StorageUsage {
  localAudioBytes: number;
  youtubeAudioBytes: number;
  stemBytes: number;
  lyricsBytes: number;
  totalBytes: number;
}

// -- Derivations --------------------------------------------------------------

function storageUsage(
  entries: readonly UsageEntry[],
  stemJobs: readonly StemJobUsage[],
  unindexedAudioBytes = 0,
): StorageUsage {
  let localAudioBytes = unindexedAudioBytes;
  let youtubeAudioBytes = 0;
  let lyricsBytes = 0;
  for (const entry of entries) {
    if (entry.audioKind === "youtube") youtubeAudioBytes += entry.storedAudioBytes;
    else localAudioBytes += entry.storedAudioBytes;
    lyricsBytes += entry.recordBytes ?? 0;
  }
  let stemBytes = 0;
  for (const job of stemJobs) stemBytes += job.bytes;
  return {
    localAudioBytes,
    youtubeAudioBytes,
    stemBytes,
    lyricsBytes,
    totalBytes: localAudioBytes + youtubeAudioBytes + stemBytes + lyricsBytes,
  };
}

function oldestStemJobFirst(a: StemJobUsage, b: StemJobUsage): number {
  return a.createdAt - b.createdAt || compareIds(a.jobKey, b.jobKey);
}

function hasClearableStems(stemJobs: readonly StemJobUsage[], isStemJobInUse: (jobKey: string) => boolean): boolean {
  return stemJobs.some((job) => job.bytes > 0 && !isStemJobInUse(job.jobKey));
}

// -- Exports ------------------------------------------------------------------

export { storageUsage, oldestStemJobFirst, hasClearableStems };
export type { StemJobUsage, StorageUsage };
