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
  await Promise.all(
    STEM_SLOTS.map(async (slot) => {
      const url = stemUrls[slot];
      const origin = stemOrigins[slot];
      if (!url || !origin) return;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not read the ${slot} stem (${response.status})`);
      const blob = await response.blob();
      const details = stemDetails[slot];
      await saveProjectStem(projectId, songKey, {
        slot,
        file: new File([blob], details?.name ?? `${slot}.wav`, { type: blob.type }),
        origin,
        durationSeconds: details?.durationSeconds ?? 0,
      });
    }),
  );
}

// -- Exports ------------------------------------------------------------------

export { saveOpenStemsTo };
