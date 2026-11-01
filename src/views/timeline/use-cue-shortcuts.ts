import { playFromCue } from "@/lib/replay-cue";
import { isAnyModalOpen } from "@/stores/escape-layer-stack";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { isTypingTarget } from "@/utils/typing-target";
import { useEffect } from "react";

// -- Handlers -----------------------------------------------------------------

function handleCueKeyDown(event: KeyboardEvent): void {
  if (useProjectStore.getState().activeTab !== "timeline") return;
  if (isAnyModalOpen() || isTypingTarget(event.target)) return;

  const matched = findMatchingShortcut(event, "timeline");
  if (matched === "timeline.playFromCue") {
    event.preventDefault();
    playFromCue();
  } else if (matched === "timeline.toggleReturnToCue") {
    event.preventDefault();
    useSettingsStore.getState().toggle("returnToCue");
  }
}

// -- Hook ---------------------------------------------------------------------

function useCueShortcuts(): void {
  useEffect(() => {
    window.addEventListener("keydown", handleCueKeyDown);
    return () => window.removeEventListener("keydown", handleCueKeyDown);
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useCueShortcuts };
