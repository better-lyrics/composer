import { sharedInstancesInLineOrder } from "@/domain/group/shared-timing";
import { useProjectStore } from "@/stores/project";
import { showGroupActionToast, showKeptOwnTimingToast } from "@/utils/group-toast";
import { pluralize } from "@/utils/pluralize";

// -- Functions ----------------------------------------------------------------

function shareGroupTimingWithUndo(groupId: string): void {
  useProjectStore.getState().shareGroupTiming(groupId);
  const { lines, groups } = useProjectStore.getState();
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) return;
  if (group.ownTimingInstances?.length) {
    showKeptOwnTimingToast(lines, [group]);
    return;
  }
  const count = sharedInstancesInLineOrder(lines, group).length;
  showGroupActionToast(`${group.label} shares timing in ${pluralize(count, "instance")}`);
}

// -- Exports ------------------------------------------------------------------

export { shareGroupTimingWithUndo };
