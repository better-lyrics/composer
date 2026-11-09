import { syncProgress } from "@/domain/line/sync-progress";
import type { ProjectTab } from "@/domain/project/tab";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

interface OrbPlacement {
  x: number;
  y: number;
  // Card limits for the room left once the orb has moved: Tailwind needs whole class names, so these are fixed strings.
  cardRoom: string | undefined;
}

// -- Constants ----------------------------------------------------------------

const SYNC_LIFT_PX = 72;
const FOOTER_LIFT_PX = 54;
const EXPORT_PANEL_PX = 416;

const CARD_ROOM: Record<string, string> = {
  sync: "max-h-[calc(100dvh-16rem-72px)]",
  footer: "max-h-[calc(100dvh-16rem-54px)]",
  export: "max-w-[calc(100vw-2rem-416px)]",
};

// -- Hook ---------------------------------------------------------------------

// The orb steps around controls in its corner: the Sync tap keys, the Timeline footer and the Export side panel.
function useOrbPlacement(activeTab: ProjectTab): OrbPlacement {
  // Export opens its side panel only once there is synced content to export.
  const exportPanel = useProjectStore(
    (state) => state.activeTab === "export" && syncProgress(state.lines, "line").done > 0,
  );
  // The footer stops short of the Timeline preview sidebar, so with the sidebar open the orb stays in its corner.
  const previewSidebar = useSettingsStore((state) => state.previewSidebar);
  const hasSelection = useTimelineStore((state) => state.selectedWords.length > 0);
  const footer = activeTab === "timeline" && hasSelection && !previewSidebar;
  if (activeTab === "sync") return { x: 0, y: -SYNC_LIFT_PX, cardRoom: CARD_ROOM.sync };
  if (footer) return { x: 0, y: -FOOTER_LIFT_PX, cardRoom: CARD_ROOM.footer };
  if (exportPanel) return { x: -EXPORT_PANEL_PX, y: 0, cardRoom: CARD_ROOM.export };
  return { x: 0, y: 0, cardRoom: undefined };
}

// -- Exports ------------------------------------------------------------------

export { useOrbPlacement };
