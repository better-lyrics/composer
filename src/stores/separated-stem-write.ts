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
    await Promise.all(STEM_SLOTS.map((slot) => putStem(stems.audioHash, slot, stems.variant, stems.files[slot])));
    return;
  }
  const { projectId } = stems;
  await Promise.all(
    stems.emptySlots.map((slot) =>
      saveProjectStem(projectId, stems.songKey, {
        slot,
        file: new File([stems.files[slot]], `${slot}.wav`, { type: "audio/wav" }),
        origin: "separated",
        durationSeconds: stems.durationSeconds,
      }),
    ),
  );
}

// -- Exports ------------------------------------------------------------------

export { storeSeparatedStems };
