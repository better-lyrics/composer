import { isAnyModalOpen } from "@/stores/escape-layer-stack";
import { useProjectStore } from "@/stores/project";
import { historyShortcutAction } from "@/utils/history-shortcut";
import { useEffect } from "react";

// -- Hook ---------------------------------------------------------------------

function useLanguagesHistoryShortcuts(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isAnyModalOpen()) return;
      const historyAction = historyShortcutAction(event);
      if (!historyAction) return;
      event.preventDefault();
      if (event.repeat) return;
      useProjectStore.getState()[historyAction]();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);
}

// -- Exports ------------------------------------------------------------------

export { useLanguagesHistoryShortcuts };
