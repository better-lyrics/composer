import { sharedInstancesInLineOrder, sharesTiming } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { instanceName } from "@/domain/instance/name";
import { useProjectStore } from "@/stores/project";
import { showGroupActionToast } from "@/utils/group-toast";
import { pluralize } from "@/utils/pluralize";
import { useCallback } from "react";

// -- Types --------------------------------------------------------------------

type SharingMenuAction = "use-own-timing" | "share-timing" | "share-group-timing";

// -- Constants ----------------------------------------------------------------

const SHARING_MENU_LABELS: Record<SharingMenuAction, string> = {
  "use-own-timing": "Use own timing",
  "share-timing": "Share timing",
  "share-group-timing": "Share timing across group",
};

// -- Functions ----------------------------------------------------------------

function sharingMenuAction(group: LinkGroup | undefined, instanceIdx: number): SharingMenuAction | null {
  if (!group) return null;
  if (!group.sharesTiming) return "share-group-timing";
  return sharesTiming(group, instanceIdx) ? "use-own-timing" : "share-timing";
}

function applySharingMenuAction(action: SharingMenuAction, group: LinkGroup, instanceIdx: number): void {
  const store = useProjectStore.getState();
  const name = instanceName(store.lines, group, instanceIdx);
  if (action === "use-own-timing") {
    store.setInstanceOwnTiming(group.id, instanceIdx, true);
    showGroupActionToast(`${name} uses its own timing`);
    return;
  }
  if (action === "share-timing") {
    store.setInstanceOwnTiming(group.id, instanceIdx, false);
    showGroupActionToast(`${name} shares timing again`);
    return;
  }
  store.shareGroupTiming(group.id);
  const { lines, groups } = useProjectStore.getState();
  const shared = groups.find((candidate) => candidate.id === group.id);
  const count = shared ? sharedInstancesInLineOrder(lines, shared).length : 0;
  showGroupActionToast(`${group.label} shares timing in ${pluralize(count, "instance")}`);
}

// -- Hook ---------------------------------------------------------------------

function useSharedTimingMenuActions(groupId: string, instanceIdx: number, clearContextMenu: () => void) {
  const group = useProjectStore((s) => s.groups.find((candidate) => candidate.id === groupId));
  const action = sharingMenuAction(group, instanceIdx);

  const handleSharingAction = useCallback(() => {
    if (action && group) applySharingMenuAction(action, group, instanceIdx);
    clearContextMenu();
  }, [action, group, instanceIdx, clearContextMenu]);

  return { sharingLabel: action ? SHARING_MENU_LABELS[action] : null, handleSharingAction };
}

// -- Exports ------------------------------------------------------------------

export { useSharedTimingMenuActions };
