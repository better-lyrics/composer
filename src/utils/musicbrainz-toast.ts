import type { ProjectMetadata } from "@/domain/project/metadata";
import { useProjectStore } from "@/stores/project";
import { pluralize } from "@/utils/pluralize";
import { toast } from "sonner";

// -- Functions ----------------------------------------------------------------

// Metadata writes skip undo history, so Undo writes the captured values back.
function showMusicBrainzFillToast(previous: Partial<ProjectMetadata>): void {
  toast.success(`Filled ${pluralize(Object.keys(previous).length, "field")} from MusicBrainz`, {
    action: { label: "Undo", onClick: () => useProjectStore.getState().setMetadata(previous) },
  });
}

// -- Exports ------------------------------------------------------------------

export { showMusicBrainzFillToast };
