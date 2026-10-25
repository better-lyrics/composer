import { putStem } from "@/audio/separation/stem-store";
import { STEM_SLOTS, type StemSlot } from "@/domain/stems/stem-slot";
import { saveProjectStem } from "@/lib/project-stems";
import type { VocalModelVariant } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface SeparatedStems {
  audioHash: string;
  songKey: string;
  variant: VocalModelVariant;
  files: Record<StemSlot, Blob>;
  durationSeconds: number;
  projectId: string | undefined;
  emptySlots: readonly StemSlot[];
}

// -- Writing ------------------------------------------------------------------

// A project that owns its stems gets only its empty slots; the stem owner also refuses to replace an imported one.
async function storeSeparatedStems(stems: SeparatedStems): Promise<void> {
  if (!stems.projectId) {
    for (const slot of STEM_SLOTS) await putStem(stems.audioHash, slot, stems.variant, stems.files[slot]);
    return;
  }
  for (const slot of stems.emptySlots) {
    const file = new File([stems.files[slot]], `${slot}.wav`, { type: "audio/wav" });
    await saveProjectStem(stems.projectId, stems.songKey, {
      slot,
      file,
      origin: "separated",
      durationSeconds: stems.durationSeconds,
    });
  }
}

// -- Exports ------------------------------------------------------------------

export { storeSeparatedStems };
