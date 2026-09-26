import { instanceIndicesOf } from "@/domain/instance/enumerate";
import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { showGroupActionToast } from "@/utils/group-toast";
import { type ConformFailure, conformLinesToInstance } from "@/views/timeline/conform-lines-to-instance";
import { deleteGroupWithConfirm } from "@/views/timeline/delete-group-with-confirm";
import { scrollToInstanceHeader } from "@/views/timeline/scroll-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { useContextMenuTargets } from "@/views/timeline/use-context-menu-targets";
import { useCallback } from "react";
import { toast } from "sonner";

// -- Interfaces ---------------------------------------------------------------

type ContextMenuTargets = ReturnType<typeof useContextMenuTargets>;

// -- Constants ----------------------------------------------------------------

const CONFORM_FAILURE_MESSAGE: Record<ConformFailure, string> = {
  empty_selection: "Select the lines you want to conform first",
  no_template: "That group has no lines to copy from",
  already_grouped: "Some of those lines already belong to a group",
  unknown_line: "Those lines are no longer in the project",
  not_contiguous: "Select one unbroken run of lines",
  length_mismatch: "Select exactly as many lines as the group has",
};

// -- Hook ---------------------------------------------------------------------

function useGroupMenuActions(targets: ContextMenuTargets, clearContextMenu: () => void) {
  const { groupableSelection, conformableSelection } = targets;
  const contextMenu = useTimelineStore((s) => s.contextMenu);
  const setRenamingGroupId = useTimelineStore((s) => s.setRenamingGroupId);
  const groups = useProjectStore((s) => s.groups);
  const confirm = useConfirm();

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

  const handleConformToGroup = useCallback(
    async (groupId: string) => {
      if (!conformableSelection) return;
      const option = conformableSelection.options.find((o) => o.group.id === groupId);
      if (!option) return;
      const { selectedLineIds, count } = conformableSelection;
      clearContextMenu();

      const ok = await confirm({
        title: `Conform ${count} line${count === 1 ? "" : "s"} to "${option.group.label}"?`,
        description: "Their current text, timing, agent and background vocals are replaced by the group's.",
        confirmLabel: "Conform",
        variant: "destructive",
        settingsKey: "confirmConformToGroup",
        recoverable: true,
      });
      if (!ok) return;

      const projectState = useProjectStore.getState();
      if (!projectState.groups.some((g) => g.id === groupId)) {
        toast.error("That group no longer exists");
        return;
      }
      const audioEl = useAudioStore.getState().audioElement;
      const playheadTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
      const result = conformLinesToInstance({
        lines: projectState.lines,
        groupId,
        template: option.template,
        selectedLineIds,
        playheadTime,
      });
      if (!result.ok || !result.updatedLines) {
        toast.error(result.reason ? CONFORM_FAILURE_MESSAGE[result.reason] : "Could not conform those lines");
        return;
      }
      useProjectStore.getState().setLinesWithHistory(result.updatedLines);
      showGroupActionToast(`Conformed ${count} line${count === 1 ? "" : "s"} to "${option.group.label}"`);
    },
    [conformableSelection, confirm, clearContextMenu],
  );

  const handleDeleteGroup = useCallback(async () => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId } = contextMenu.target;
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const instanceCount = instanceIndicesOf(useProjectStore.getState().lines, groupId).length;

    clearContextMenu();
    await deleteGroupWithConfirm({ groupId, groupLabel: group.label, instanceCount });
  }, [contextMenu, groups, clearContextMenu]);

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
    handleConformToGroup,
    handleDeleteGroup,
    handleRenameStart,
    handleRecolorGroup,
  };
}

// -- Exports ------------------------------------------------------------------

export { useGroupMenuActions };
