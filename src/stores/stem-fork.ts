import { hashFile } from "@/audio/separation/audio-codec";
import { isProjectStemJobKey } from "@/audio/separation/stem-job-liveness";
import { STEM_SLOTS } from "@/domain/stems/stem-slot";
import { saveProjectStem } from "@/lib/project-stems";
import { playableFile, useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { songKeyFor } from "@/stores/stem-sources";

// -- Forking ------------------------------------------------------------------

// The open project's stems live only in memory once its record is gone, so a fork writes them to the new id.
async function saveOpenStemsTo(projectId: string): Promise<void> {
  const { jobKey, stemUrls, stemOrigins, stemDetails } = useSeparationStore.getState();
  const source = useAudioStore.getState().source;
  const song = playableFile(source);
  if (!song || !isProjectStemJobKey(jobKey)) return;
  const songKey = songKeyFor(source, await hashFile(song));
  for (const slot of STEM_SLOTS) {
    const url = stemUrls[slot];
    const origin = stemOrigins[slot];
    if (!url || !origin) continue;
    const blob = await (await fetch(url)).blob();
    const details = stemDetails[slot];
    const file = new File([blob], details?.name ?? `${slot}.wav`, { type: blob.type });
    await saveProjectStem(projectId, songKey, {
      slot,
      file,
      origin,
      durationSeconds: details?.durationSeconds ?? 0,
    });
  }
}

// -- Exports ------------------------------------------------------------------

export { saveOpenStemsTo };
