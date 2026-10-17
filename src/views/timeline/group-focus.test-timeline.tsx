import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { TimelinePanel } from "@/views/timeline/timeline-panel";

// -- Components ---------------------------------------------------------------

const PlayableTimeline: React.FC = () => {
  useGlobalShortcuts({ setActiveTab: () => {}, setHelpOpen: () => {}, setSettingsOpen: () => {} });
  return <TimelinePanel />;
};

// -- Exports ------------------------------------------------------------------

export { PlayableTimeline };
