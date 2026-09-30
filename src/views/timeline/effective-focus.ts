import { useProjectStore } from "@/stores/project";
import { type GroupFocus, effectiveFocus } from "@/views/timeline/group-focus";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions ----------------------------------------------------------------

function currentEffectiveFocus(): GroupFocus | null {
  return effectiveFocus(useProjectStore.getState().lines, useTimelineStore.getState().focusedGroup);
}

// -- Hooks --------------------------------------------------------------------

function useEffectiveFocus(): GroupFocus | null {
  const focusedGroup = useTimelineStore((s) => s.focusedGroup);
  return useProjectStore((s) => effectiveFocus(s.lines, focusedGroup));
}

// -- Exports ------------------------------------------------------------------

export { currentEffectiveFocus, useEffectiveFocus };
