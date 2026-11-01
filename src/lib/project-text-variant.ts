import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { setProjectTextVariant } from "@/lib/project-repository";
import { isRestoringProject } from "@/lib/project-restore";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectTextVariant]";

// -- Watching -----------------------------------------------------------------

function watchProjectTextVariant(): () => void {
  return useTimelineStore.subscribe((state, previous) => {
    if (state.textVariant === previous.textVariant || isRestoringProject()) return;
    const id = openProjectIdSnapshot();
    if (!id) return;
    setProjectTextVariant(id, state.textVariant).catch((err: unknown) => {
      console.error(`${LOG_PREFIX} could not remember Original or Transliteration:`, err);
    });
  });
}

// -- Exports ------------------------------------------------------------------

export { watchProjectTextVariant };
