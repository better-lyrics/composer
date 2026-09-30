import { isTypingTarget } from "@/hooks/useKeyboardShortcuts";
import { isAnyModalOpen } from "@/stores/modal-stack";
import { useProjectStore } from "@/stores/project";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { currentEffectiveFocus } from "@/views/timeline/effective-focus";
import { type InstanceRef, selectedBannerInstance } from "@/views/timeline/selected-banner";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { toggleGroupLoop } from "@/views/timeline/toggle-group-loop";
import { useEffect } from "react";

// -- Helpers -------------------------------------------------------------------

function focusedBannerInstance(target: EventTarget | null): InstanceRef | null {
  if (!(target instanceof Element)) return null;
  const header = target.closest<HTMLElement>("[data-group-id][data-instance-idx]");
  const groupId = header?.dataset.groupId;
  const instanceIdx = Number(header?.dataset.instanceIdx);
  if (!groupId || !Number.isInteger(instanceIdx)) return null;
  return { groupId, instanceIdx };
}

function escapeBelongsElsewhere(target: EventTarget | null): boolean {
  const { contextMenu, editingWord, renamingGroupId, pasteMode, selectedWords } = useTimelineStore.getState();
  if (contextMenu || editingWord || renamingGroupId !== null) return true;
  if (pasteMode.status !== "idle" || selectedWords.length > 0) return true;
  if (document.querySelector('[data-word-block][aria-pressed="true"]') !== null) return true;
  return target instanceof Element && target.closest("[data-floating-ui-portal]") !== null;
}

function handleGroupFocusKeyDown(event: KeyboardEvent): void {
  if (useProjectStore.getState().activeTab !== "timeline") return;
  if (isAnyModalOpen() || isTypingTarget(event.target)) return;

  const matched = findMatchingShortcut(event, "timeline");
  const timeline = useTimelineStore.getState();
  const focus = currentEffectiveFocus();

  if (matched === "timeline.openGroup" && focus === null) {
    const instance =
      focusedBannerInstance(event.target) ??
      selectedBannerInstance(useProjectStore.getState().lines, timeline.selectedWords);
    if (!instance) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    timeline.openGroup(instance.groupId, instance.instanceIdx);
    return;
  }

  if (matched === "timeline.toggleGroupLoop" && focus !== null) {
    event.preventDefault();
    toggleGroupLoop();
    return;
  }

  if (matched === "timeline.closeGroup" && focus !== null && !escapeBelongsElsewhere(event.target)) {
    event.preventDefault();
    timeline.closeGroup();
  }
}

// -- Hook ----------------------------------------------------------------------

function useGroupFocusShortcuts(): void {
  useEffect(() => {
    window.addEventListener("keydown", handleGroupFocusKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleGroupFocusKeyDown, { capture: true });
  }, []);
}

// -- Exports -------------------------------------------------------------------

export { useGroupFocusShortcuts };
