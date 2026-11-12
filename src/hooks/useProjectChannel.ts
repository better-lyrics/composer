import { useEffect } from "react";
import { noteProjectsDeletedElsewhere } from "@/lib/open-project-deleted";
import { subscribeProjectsDeleted } from "@/lib/project-channel";

// -- Hook ---------------------------------------------------------------------

function useProjectChannel(): void {
  useEffect(() => subscribeProjectsDeleted(noteProjectsDeletedElsewhere), []);
}

// -- Exports ------------------------------------------------------------------

export { useProjectChannel };
