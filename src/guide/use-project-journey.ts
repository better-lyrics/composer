import { type Journey, projectJourney } from "@/domain/guide/journey";
import { isProjectFullySynced } from "@/domain/line/sync-progress";
import { hasLyricLines } from "@/domain/project/lyrics-presence";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { useAudioStore } from "@/stores/audio";
import { NO_PROJECT_FACTS, useGuideStore } from "@/stores/guide";
import { useProjectStore } from "@/stores/project";
import { useMemo } from "react";

// -- Hook ---------------------------------------------------------------------

function useProjectJourney(): Journey {
  const projectId = useOpenProjectId();
  const hasAudio = useAudioStore((state) => state.source !== null || state.expectedAudio !== null);
  const hasLyrics = useProjectStore((state) => hasLyricLines(state.lines));
  const syncComplete = useProjectStore((state) => isProjectFullySynced(state.lines));
  const facts = useGuideStore((state) => (projectId ? state.projects[projectId] : undefined)) ?? NO_PROJECT_FACTS;
  return useMemo(
    () => projectJourney({ hasAudio, hasLyrics, syncComplete, ...facts }),
    [hasAudio, hasLyrics, syncComplete, facts],
  );
}

// -- Exports ------------------------------------------------------------------

export { useProjectJourney };
