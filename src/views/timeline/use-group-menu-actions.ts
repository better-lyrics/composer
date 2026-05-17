import type { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { showGroupActionToast } from "@/utils/group-toast";
import { scrollToInstanceHeader } from "@/views/timeline/scroll-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { useContextMenuTargets } from "@/views/timeline/use-context-menu-targets";
import { useCallback } from "react";
import { toast } from "sonner";

// -- Interfaces ---------------------------------------------------------------

type ContextMenuTargets = ReturnType<typeof useContextMenuTargets>;
type Confirm = ReturnType<typeof useConfirm>;

// -- Hook ---------------------------------------------------------------------

function useGroupMenuActions(targets: ContextMenuTargets, clearContextMenu: () => void, confirm: Confirm) {
  const { groupableSelection } = targets;
  const contextMenu = useTimelineStore((s) => s.contextMenu);
  const setRenamingGroupId = useTimelineStore((s) => s.setRenamingGroupId);
  const groups = useProjectStore((s) => s.groups);

  const handleJumpToGroupFromBanner = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId, instanceIdx } = contextMenu.target;
    scrollToInstanceHeader(groupId, instanceIdx);
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleCreateGroupFromSelection = useCallback(() => {
    if (!groupableSelection) return;
    const projectState = useProjectStore.getState();
    projectState.addGroupWithLines(groupableSelection.result.group, groupableSelection.result.updatedLines);
    toast.success(`Grouped ${groupableSelection.count} line${groupableSelection.count === 1 ? "" : "s"}`);
    clearContextMenu();
  }, [groupableSelection, clearContextMenu]);

  const handleDeleteGroup = useCallback(async () => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId } = contextMenu.target;
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const projectLines = useProjectStore.getState().lines;
    const instanceCount = new Set(
      projectLines.flatMap((l) => (l.groupId === groupId && l.instanceIdx !== undefined ? [l.instanceIdx] : [])),
    ).size;

    clearContextMenu();
    const ok = await confirm({
      title: `Delete the "${group.label}" group?`,
      description: `All ${instanceCount} instance${instanceCount === 1 ? "" : "s"} will become standalone lines. They keep their text and timing, but stop updating together.`,
      confirmLabel: "Delete group",
      variant: "destructive",
      settingsKey: "confirmGroupDissolution",
      recoverable: true,
    });
    if (!ok) return;
    useProjectStore.getState().removeGroup(groupId);
    showGroupActionToast("Group deleted");
  }, [contextMenu, groups, confirm, clearContextMenu]);

  const handleRenameStart = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId, instanceIdx } = contextMenu.target;
    setRenamingGroupId(groupId, instanceIdx);
    clearContextMenu();
  }, [contextMenu, clearContextMenu, setRenamingGroupId]);

  const handleRecolorGroup = useCallback(
    (color: string) => {
      if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
      useProjectStore.getState().updateGroup(contextMenu.target.groupId, { color });
      clearContextMenu();
    },
    [contextMenu, clearContextMenu],
  );

  return {
    handleJumpToGroupFromBanner,
    handleCreateGroupFromSelection,
    handleDeleteGroup,
    handleRenameStart,
    handleRecolorGroup,
  };
}

// -- Exports ------------------------------------------------------------------

export { useGroupMenuActions };
