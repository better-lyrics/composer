import { sharedInstancesInLineOrder } from "@/domain/group/shared-timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { replacedOwnTimingNote, showGroupActionToast, showKeptOwnTimingToast } from "@/utils/group-toast";
import { pluralize } from "@/utils/pluralize";

// -- Functions ----------------------------------------------------------------

function shareGroupTimingWithUndo(groupId: string): void {
  const before = useProjectStore.getState();
  const { keptOwnTiming, replaced } = before.shareGroupTiming(groupId, useAudioStore.getState().duration);
  const { lines, groups } = useProjectStore.getState();
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) return;
  const committed = lines !== before.lines || groups !== before.groups;
  if (!committed || (keptOwnTiming.length && replaced.length === 0)) {
    showKeptOwnTimingToast(keptOwnTiming, "timeline", committed);
    return;
  }
  showKeptOwnTimingToast(keptOwnTiming, "timeline");
  const count = sharedInstancesInLineOrder(lines, group).length;
  const shared = `${group.label} shares timing in ${pluralize(count, "instance")}`;
  showGroupActionToast(replaced.length ? `${shared}. ${replacedOwnTimingNote(replaced.length)}` : shared);
}

// -- Exports ------------------------------------------------------------------

export { shareGroupTimingWithUndo };
