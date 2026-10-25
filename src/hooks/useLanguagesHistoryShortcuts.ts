import { isAnyModalOpen } from "@/stores/escape-layer-stack";
import { useProjectStore } from "@/stores/project";
import { runHistoryShortcut } from "@/utils/history-shortcut";
import { hasNativeTextUndo } from "@/utils/typing-target";
import { useEffect } from "react";

// -- Hook ---------------------------------------------------------------------

function useLanguagesHistoryShortcuts(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isAnyModalOpen() || hasNativeTextUndo(event.target)) return;
      runHistoryShortcut(event, (action) => useProjectStore.getState()[action]());
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);
}

// -- Exports ------------------------------------------------------------------

export { useLanguagesHistoryShortcuts };
