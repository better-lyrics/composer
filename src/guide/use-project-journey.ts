import { type Journey, projectJourney } from "@/domain/guide/journey";
import { isProjectFullySynced } from "@/domain/line/sync-progress";
import { hasLyricLines } from "@/domain/project/lyrics-presence";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { playableFile, useAudioStore } from "@/stores/audio";
import { NO_PROJECT_FACTS, useGuideStore } from "@/stores/guide";
import { useProjectStore } from "@/stores/project";
import type { ProjectTab } from "@/domain/project/tab";
import { noteGuideProjectFact } from "@/lib/guide-signals";
import { useEffect, useMemo } from "react";

// -- Hook ---------------------------------------------------------------------

function useProjectJourney(): Journey {
  const projectId = useOpenProjectId();
  const hasAudio = useAudioStore((state) => state.expectedAudio !== null || playableFile(state.source) !== null);
  const hasLyrics = useProjectStore((state) => hasLyricLines(state.lines));
  const syncComplete = useProjectStore((state) => isProjectFullySynced(state.lines));
  const facts = useGuideStore((state) => (projectId ? state.projects[projectId] : undefined)) ?? NO_PROJECT_FACTS;
  return useMemo(
    () => projectJourney({ hasAudio, hasLyrics, syncComplete, ...facts }),
    [hasAudio, hasLyrics, syncComplete, facts],
  );
}

// Visiting a step's tab is a journey fact; Timeline and Preview count only once every line is synced.
function useJourneyVisits(journey: Journey, activeTab: ProjectTab, projectId: string | undefined): void {
  const syncComplete = journey.steps.some((step) => step.id === "sync" && step.done);
  useEffect(() => {
    if (!projectId || !syncComplete) return;
    if (activeTab === "preview") noteGuideProjectFact("visitedPreview");
    if (activeTab === "timeline") noteGuideProjectFact("visitedTimeline");
  }, [activeTab, syncComplete, projectId]);
}

// -- Exports ------------------------------------------------------------------

export { useJourneyVisits, useProjectJourney };
