import type { ProjectTab } from "@/domain/project/tab";
import { useProjectStore } from "@/stores/project";

// -- Constants ----------------------------------------------------------------

// A panel mounts on its tab's first visit, so a step on an unvisited tab waits for that render.
const TAB_PANEL_RENDER_WAIT_MS = 1500;

// -- Helpers ------------------------------------------------------------------

function showTab(tab: ProjectTab): void {
  if (useProjectStore.getState().activeTab !== tab) useProjectStore.getState().setActiveTab(tab);
}

// driver.js resolves a step's element before any hook runs, so the tab is shown here. A panel in its empty state has
// no tour anchor, so the panel itself is the anchor; waiting for an anchor that never comes would blank the tour.
function elementOnTab(tab: ProjectTab, selector: string): () => Element {
  return () => {
    showTab(tab);
    return (document.querySelector(selector) ?? document.querySelector(`[data-tab-panel="${tab}"]`)) as Element;
  };
}

// -- Exports ------------------------------------------------------------------

export { TAB_PANEL_RENDER_WAIT_MS, elementOnTab, showTab };
