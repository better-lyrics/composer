import { putStem } from "@/audio/separation/stem-store";
import { STEM_SLOTS, type StemOrigin, type StemSlot } from "@/domain/stems/stem-slot";
import { ensureOpenProjectId } from "@/lib/open-project-session";
import { saveProjectStem } from "@/lib/project-stems";
import type { VocalModelVariant } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface SeparatedStems {
  audioHash: string;
  variant: VocalModelVariant;
  files: Record<StemSlot, Blob>;
  durationSeconds: number;
  projectOwned: boolean;
  currentOrigins: Partial<Record<StemSlot, StemOrigin>>;
}

// -- Writing ------------------------------------------------------------------

// A project that owns its stems gets only the empty slots, so the model never replaces a stem the user brought.
async function storeSeparatedStems(stems: SeparatedStems): Promise<void> {
  if (!stems.projectOwned) {
    for (const slot of STEM_SLOTS) await putStem(stems.audioHash, slot, stems.variant, stems.files[slot]);
    return;
  }
  const projectId = await ensureOpenProjectId();
  for (const slot of STEM_SLOTS) {
    if (stems.currentOrigins[slot]) continue;
    const file = new File([stems.files[slot]], `${slot}.wav`, { type: "audio/wav" });
    await saveProjectStem(projectId, stems.audioHash, {
      slot,
      file,
      origin: "separated",
      durationSeconds: stems.durationSeconds,
    });
  }
}

// -- Exports ------------------------------------------------------------------

export { storeSeparatedStems };
