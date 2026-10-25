import { projectStemJobKey } from "@/audio/separation/stem-job-liveness";
import { getStem, hasStems, stemJobKey } from "@/audio/separation/stem-store";
import { STEM_SLOTS, type StemOrigin, type StemSlot } from "@/domain/stems/stem-slot";
import { deleteProjectStems, loadProjectStems, stemFile } from "@/lib/project-stems";
import type { VocalModelVariant } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface ResolvedStems {
  jobKey: string;
  files: Partial<Record<StemSlot, Blob>>;
  origins: Partial<Record<StemSlot, StemOrigin>>;
  ownedByProject: boolean;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[StemSources]";

// -- Resolution ---------------------------------------------------------------

async function cachedStems(audioHash: string, variant: VocalModelVariant): Promise<ResolvedStems> {
  const jobKey = stemJobKey(audioHash, variant);
  if (!(await hasStems(audioHash, variant))) return { jobKey, files: {}, origins: {}, ownedByProject: false };
  const files: ResolvedStems["files"] = {};
  const origins: ResolvedStems["origins"] = {};
  for (const slot of STEM_SLOTS) {
    const blob = await getStem(audioHash, slot, variant);
    if (!blob) continue;
    files[slot] = blob;
    origins[slot] = "separated";
  }
  return { jobKey, files, origins, ownedByProject: false };
}

async function resolveStems(
  projectId: string | undefined,
  audioHash: string,
  variant: VocalModelVariant,
): Promise<ResolvedStems> {
  const stems = projectId ? await loadProjectStems(projectId) : undefined;
  if (projectId && stems && stems.songHash !== audioHash) {
    await deleteProjectStems(projectId).catch((error: unknown) =>
      console.error(LOG_PREFIX, "could not drop the stems of a replaced song", error),
    );
  }
  if (!projectId || !stems || stems.songHash !== audioHash) return cachedStems(audioHash, variant);
  const files: ResolvedStems["files"] = {};
  const origins: ResolvedStems["origins"] = {};
  for (const slot of STEM_SLOTS) {
    const stem = stems.slots[slot];
    if (!stem) continue;
    files[slot] = stemFile(stem);
    origins[slot] = stem.origin;
  }
  return { jobKey: projectStemJobKey(projectId, stems.revision), files, origins, ownedByProject: true };
}

// -- Exports ------------------------------------------------------------------

export { resolveStems };
