import { listStemJobs, removeStemJobs } from "@/audio/separation/stem-store";
import { planCleanup } from "@/domain/storage/cleanup-plan";
import { bytesToFree } from "@/domain/storage/space";
import { storageUsage } from "@/domain/storage/usage";
import { readStorageEstimate } from "@/lib/browser-storage";
import { isProjectInUse } from "@/lib/open-project-session";
import { removeCachedYouTubeAudio } from "@/lib/project-audio";
import { listProjectIndex } from "@/lib/project-repository";

// -- Types --------------------------------------------------------------------

interface CleanupContext {
  smartCleanup: boolean;
  limitBytes: number | undefined;
  isStemJobInUse: (jobKey: string) => boolean;
  storageFull: boolean;
}

interface CleanupResult {
  freedBytes: number;
  removedStemJobs: number;
  removedYouTubeAudio: number;
}

// -- Constants ----------------------------------------------------------------

const NOTHING_CLEANED: CleanupResult = { freedBytes: 0, removedStemJobs: 0, removedYouTubeAudio: 0 };

// -- Cleanup ------------------------------------------------------------------

async function runSmartCleanup(context: CleanupContext): Promise<CleanupResult> {
  if (!context.smartCleanup) return NOTHING_CLEANED;
  const [entries, stemJobs, estimate] = await Promise.all([listProjectIndex(), listStemJobs(), readStorageEstimate()]);
  const usage = storageUsage(entries, stemJobs);
  const steps = planCleanup({
    entries,
    stemJobs,
    isProjectInUse,
    isStemJobInUse: context.isStemJobInUse,
    bytesToFree: bytesToFree({
      usedBytes: usage.totalBytes,
      limitBytes: context.limitBytes,
      estimate,
      storageFull: context.storageFull,
    }),
  });
  const result: CleanupResult = { ...NOTHING_CLEANED };
  const stemKeys = steps.flatMap((step) => (step.kind === "stems" ? [step.jobKey] : []));
  if (stemKeys.length > 0) {
    const removed = await removeStemJobs(stemKeys, context.isStemJobInUse);
    result.removedStemJobs = removed.jobs;
    result.freedBytes += removed.bytes;
  }
  const audioProjectIds = steps.flatMap((step) => (step.kind === "youtube-audio" ? [step.projectId] : []));
  if (audioProjectIds.length > 0) {
    const removed = await removeCachedYouTubeAudio(audioProjectIds, isProjectInUse);
    result.removedYouTubeAudio = removed.projects;
    result.freedBytes += removed.bytes;
  }
  return result;
}

// -- Exports ------------------------------------------------------------------

export { NOTHING_CLEANED, runSmartCleanup };
export type { CleanupContext, CleanupResult };
