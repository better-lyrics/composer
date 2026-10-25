import { projectStemJobKey } from "@/audio/separation/stem-job-liveness";
import { getStem, hasStems, stemJobKey } from "@/audio/separation/stem-store";
import { STEM_SLOTS, type StemOrigin, type StemSlot } from "@/domain/stems/stem-slot";
import { loadProjectStems, stemFile } from "@/lib/project-stems";
import type { AudioSource } from "@/stores/audio";
import type { VocalModelVariant } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface ImportedStemDetails {
  name: string;
  durationSeconds: number;
  bytes: number;
}

interface ResolvedStem {
  file: Blob;
  origin: StemOrigin;
  key: string;
  details?: ImportedStemDetails;
}

interface ResolvedStems {
  jobKey: string;
  slots: Partial<Record<StemSlot, ResolvedStem>>;
}

// -- Song identity ------------------------------------------------------------

// A YouTube song is the video, whatever bytes this session downloaded; a file is its content.
function songKeyFor(source: AudioSource, audioHash: string): string {
  return source?.type === "youtube" ? `youtube:${source.videoId}` : audioHash;
}

// -- Resolution ---------------------------------------------------------------

async function cachedStems(audioHash: string, variant: VocalModelVariant): Promise<ResolvedStems> {
  const jobKey = stemJobKey(audioHash, variant);
  const slots: ResolvedStems["slots"] = {};
  if (!(await hasStems(audioHash, variant))) return { jobKey, slots };
  for (const slot of STEM_SLOTS) {
    const blob = await getStem(audioHash, slot, variant);
    if (blob) slots[slot] = { file: blob, origin: "separated", key: `${jobKey}|${slot}` };
  }
  return { jobKey, slots };
}

// Reads only: stems saved for another song stay stored but are not used, so a relink never loses them.
async function resolveStems(
  projectId: string | undefined,
  songKey: string,
  audioHash: string,
  variant: VocalModelVariant,
): Promise<ResolvedStems> {
  const stems = projectId ? await loadProjectStems(projectId) : undefined;
  const owned = stems?.songKey === songKey && STEM_SLOTS.some((slot) => stems.slots[slot]);
  if (!projectId || !stems || !owned) return cachedStems(audioHash, variant);
  const slots: ResolvedStems["slots"] = {};
  for (const slot of STEM_SLOTS) {
    const stem = stems.slots[slot];
    if (!stem) continue;
    slots[slot] = {
      file: stemFile(stem),
      origin: stem.origin,
      key: `${projectId}|${slot}|r${stem.revision}`,
      details: { name: stem.name, durationSeconds: stem.durationSeconds, bytes: stem.data.byteLength },
    };
  }
  return { jobKey: projectStemJobKey(projectId, stems.slots.vocals?.revision ?? 0), slots };
}

// -- Exports ------------------------------------------------------------------

export { resolveStems, songKeyFor };
export type { ImportedStemDetails, ResolvedStem };
