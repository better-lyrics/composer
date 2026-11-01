import { replacedInstances } from "@/domain/group/replaced-instances";
import { sharesTiming } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { instanceName } from "@/domain/instance/name";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { showGroupActionToast, showSharingBlockedToast } from "@/utils/group-toast";
import { shareGroupTimingWithUndo } from "@/views/timeline/share-group-timing";
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
    store.setInstanceOwnTiming(group.id, instanceIdx, true, useAudioStore.getState().duration);
    showGroupActionToast(`${name} uses its own timing`);
    return;
  }
  if (action === "share-timing") {
    const refusal = store.setInstanceOwnTiming(group.id, instanceIdx, false, useAudioStore.getState().duration);
    if (refusal) {
      showSharingBlockedToast(name, refusal);
      return;
    }
    const after = useProjectStore.getState().lines;
    const replaced = replacedInstances(store.lines, after).length > 0;
    showGroupActionToast(
      replaced ? `${name} shares timing again. Its own timing was replaced.` : `${name} shares timing again`,
    );
    return;
  }
  shareGroupTimingWithUndo(group.id);
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

export { SHARING_MENU_LABELS, applySharingMenuAction, sharingMenuAction, useSharedTimingMenuActions };
