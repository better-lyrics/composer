import type { ProjectTab } from "@/domain/project/tab";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";

// -- Constants ----------------------------------------------------------------

const TABS_WITH_PLAYER: readonly ProjectTab[] = ["import", "edit", "languages", "sync", "timeline", "preview"];

// -- Hook ---------------------------------------------------------------------

function useTransportDeckShown(): boolean {
  const activeTab = useProjectStore((state) => state.activeTab);
  const hasSource = useAudioStore((state) => Boolean(state.source));
  return hasSource && TABS_WITH_PLAYER.includes(activeTab);
}

// -- Exports ------------------------------------------------------------------

export { useTransportDeckShown };
