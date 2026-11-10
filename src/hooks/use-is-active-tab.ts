import type { ProjectTab } from "@/domain/project/tab";
import { useProjectStore } from "@/stores/project";

// -- Hook ---------------------------------------------------------------------

function useIsActiveTab(tab: ProjectTab): boolean {
  return useProjectStore((state) => state.activeTab === tab);
}

// -- Exports ------------------------------------------------------------------

export { useIsActiveTab };
