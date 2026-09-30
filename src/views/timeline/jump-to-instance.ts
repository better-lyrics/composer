import { instanceIndicesOf } from "@/domain/instance/enumerate";
import { useProjectStore } from "@/stores/project";
import { currentEffectiveFocus } from "@/views/timeline/effective-focus";
import { type GroupFocus, adjacentHeardInstance } from "@/views/timeline/group-focus";
import { scrollToInstanceHeader } from "@/views/timeline/scroll-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getWordsInInstance } from "@/views/timeline/utils";

// -- Helpers ------------------------------------------------------------------

function hearAdjacentInstance(focus: GroupFocus, direction: 1 | -1): void {
  const { lines, groups } = useProjectStore.getState();
  const group = groups.find((candidate) => candidate.id === focus.groupId);
  if (!group) return;
  const next = adjacentHeardInstance(lines, group, focus.hearInstanceIdx, direction);
  if (next !== null) useTimelineStore.getState().openGroup(focus.groupId, next);
}

// -- Functions ----------------------------------------------------------------

function jumpToAdjacentInstance(groupId: string, instanceIdx: number, direction: 1 | -1): void {
  const focus = currentEffectiveFocus();
  if (focus) {
    hearAdjacentInstance(focus, direction);
    return;
  }
  const lines = useProjectStore.getState().lines;
  const all = instanceIndicesOf(lines, groupId);
  if (all.length < 2) return;
  const next = all[(all.indexOf(instanceIdx) + direction + all.length) % all.length];
  useTimelineStore.getState().setSelectedWords(getWordsInInstance(lines, groupId, next));
  scrollToInstanceHeader(groupId, next);
}

// -- Exports ------------------------------------------------------------------

export { jumpToAdjacentInstance };
