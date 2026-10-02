import { sharedInstancesInLineOrder } from "@/domain/group/shared-timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { replacedOwnTimingNote, showGroupActionToast, showKeptOwnTimingToast } from "@/utils/group-toast";
import { pluralize } from "@/utils/pluralize";

// -- Functions ----------------------------------------------------------------

function shareGroupTimingWithUndo(groupId: string): void {
  const { keptOwnTiming, realigned } = useProjectStore
    .getState()
    .shareGroupTiming(groupId, useAudioStore.getState().duration);
  const { lines, groups } = useProjectStore.getState();
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) return;
  showKeptOwnTimingToast(keptOwnTiming);
  if (keptOwnTiming.length && realigned.length === 0) return;
  const count = sharedInstancesInLineOrder(lines, group).length;
  const shared = `${group.label} shares timing in ${pluralize(count, "instance")}`;
  showGroupActionToast(realigned.length ? `${shared}. ${replacedOwnTimingNote(realigned.length)}` : shared);
}

// -- Exports ------------------------------------------------------------------

export { shareGroupTimingWithUndo };
