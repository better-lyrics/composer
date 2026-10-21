import { isTypingTarget } from "@/hooks/useKeyboardShortcuts";
import { isAnyModalOpen } from "@/stores/escape-layer-stack";
import { useProjectStore } from "@/stores/project";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { toggleActiveRangeLoop, toggleRangeLoop } from "@/views/timeline/selection-playback";
import { useEffect } from "react";

// -- Helpers -------------------------------------------------------------------

function handleRangeLoopKeyDown(event: KeyboardEvent): void {
  if (isAnyModalOpen() || isTypingTarget(event.target)) return;
  if (findMatchingShortcut(event, "timeline") !== "timeline.toggleLoop") return;
  const onTimeline = useProjectStore.getState().activeTab === "timeline";
  if (onTimeline ? toggleRangeLoop() : toggleActiveRangeLoop()) event.preventDefault();
}

// -- Hook ----------------------------------------------------------------------

function useRangeLoopShortcut(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", handleRangeLoopKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleRangeLoopKeyDown, { capture: true });
  }, [enabled]);
}

// -- Exports -------------------------------------------------------------------

export { useRangeLoopShortcut };
