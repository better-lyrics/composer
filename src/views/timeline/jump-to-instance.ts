import { instanceIndicesOf } from "@/domain/instance/enumerate";
import { useProjectStore } from "@/stores/project";
import { currentEffectiveFocus } from "@/views/timeline/effective-focus";
import { type GroupFocus, adjacentHeardInstance, adjacentInstance } from "@/views/timeline/group-focus";
import { hearInstance } from "@/views/timeline/hear-instance";
import { scrollToInstanceHeader } from "@/views/timeline/scroll-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getWordsInInstance } from "@/views/timeline/utils";

// -- Helpers ------------------------------------------------------------------

function hearAdjacentInstance(focus: GroupFocus, direction: 1 | -1): void {
  const { lines, groups } = useProjectStore.getState();
  const group = groups.find((candidate) => candidate.id === focus.groupId);
  if (!group) return;
  const next = adjacentHeardInstance(lines, group, focus.hearInstanceIdx, direction);
  if (next !== null) hearInstance(focus.groupId, focus.hearInstanceIdx, next);
}

// -- Functions ----------------------------------------------------------------

function jumpToAdjacentInstance(groupId: string, instanceIdx: number, direction: 1 | -1): void {
  const focus = currentEffectiveFocus();
  if (focus) {
    hearAdjacentInstance(focus, direction);
    return;
  }
  const lines = useProjectStore.getState().lines;
  const next = adjacentInstance(instanceIndicesOf(lines, groupId), instanceIdx, direction);
  if (next === null) return;
  useTimelineStore.getState().setSelectedWords(getWordsInInstance(lines, groupId, next));
  scrollToInstanceHeader(groupId, next);
}

// -- Exports ------------------------------------------------------------------

export { jumpToAdjacentInstance };
