import type { ProjectTab } from "@/domain/project/tab";
import { useProjectStore } from "@/stores/project";

// -- Constants ----------------------------------------------------------------

// A panel mounts on its tab's first visit, so a step on an unvisited tab waits for that render.
const TAB_PANEL_RENDER_WAIT_MS = 1500;

// -- Helpers ------------------------------------------------------------------

function showTab(tab: ProjectTab): void {
  useProjectStore.getState().setActiveTab(tab);
}

// driver.js resolves a step's element before any hook runs, so the tab is shown here.
function elementOnTab(tab: ProjectTab, selector: string): () => Element {
  return () => {
    showTab(tab);
    return document.querySelector(selector) as Element;
  };
}

// -- Exports ------------------------------------------------------------------

export { TAB_PANEL_RENDER_WAIT_MS, elementOnTab, showTab };
