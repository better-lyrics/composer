import { compareIds } from "@/domain/project/id-order";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { lastOpenedAt } from "@/domain/project/opened-at";
import { isCachedYouTubeAudio } from "@/domain/storage/stored-audio";
import { type StemJobUsage, oldestStemJobFirst } from "@/domain/storage/usage";

// -- Types --------------------------------------------------------------------

type CleanupEntry = Pick<ProjectIndexEntry, "id" | "audioKind" | "storedAudioBytes" | "openedAt" | "updatedAt">;

type CleanupStep =
  | { kind: "stems"; jobKey: string; bytes: number }
  | { kind: "youtube-audio"; projectId: string; bytes: number };

interface CleanupInput {
  entries: readonly CleanupEntry[];
  stemJobs: readonly StemJobUsage[];
  isProjectInUse: (id: string) => boolean;
  isStemJobInUse: (jobKey: string) => boolean;
  bytesToFree: number;
}

// -- Candidates ---------------------------------------------------------------

function stemSteps(input: CleanupInput): CleanupStep[] {
  return input.stemJobs
    .filter((job) => !input.isStemJobInUse(job.jobKey) && job.bytes > 0)
    .toSorted(oldestStemJobFirst)
    .map((job): CleanupStep => ({ kind: "stems", jobKey: job.jobKey, bytes: job.bytes }));
}

function youtubeAudioSteps(input: CleanupInput): CleanupStep[] {
  return input.entries
    .filter((entry) => !input.isProjectInUse(entry.id) && isCachedYouTubeAudio(entry))
    .toSorted((a, b) => lastOpenedAt(a) - lastOpenedAt(b) || compareIds(a.id, b.id))
    .map((entry): CleanupStep => ({ kind: "youtube-audio", projectId: entry.id, bytes: entry.storedAudioBytes }));
}

// -- Plan ---------------------------------------------------------------------

function planCleanup(input: CleanupInput): CleanupStep[] {
  if (!(input.bytesToFree > 0)) return [];
  const steps: CleanupStep[] = [];
  let planned = 0;
  for (const step of [...stemSteps(input), ...youtubeAudioSteps(input)]) {
    if (planned >= input.bytesToFree) break;
    steps.push(step);
    planned += step.bytes;
  }
  return steps;
}

// -- Exports ------------------------------------------------------------------

export { planCleanup };
