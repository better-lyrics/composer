import type { ProjectMetadata } from "@/domain/project/metadata";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { useProjectStore } from "@/stores/project";
import { pluralize } from "@/utils/pluralize";
import { toast } from "sonner";

// -- Functions ----------------------------------------------------------------

// Metadata writes skip undo history, so Undo writes the captured values back.
function showMusicBrainzFillToast(previous: Partial<ProjectMetadata>): void {
  const filledProjectId = openProjectIdSnapshot();
  const undo = () => {
    if (openProjectIdSnapshot() === filledProjectId) useProjectStore.getState().setMetadata(previous);
  };
  toast.success(`Filled ${pluralize(Object.keys(previous).length, "field")} from MusicBrainz`, {
    action: { label: "Undo", onClick: undo },
  });
}

// -- Exports ------------------------------------------------------------------

export { showMusicBrainzFillToast };
