import { withNewInstance } from "@/domain/group/own-timing";
import { pickedTemplateSource } from "@/domain/group/template-source";
import { instanceBounds } from "@/domain/instance/bounds";
import { linesOfInstance } from "@/domain/instance/enumerate";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { showGroupActionToast } from "@/utils/group-toast";
import { MOD_KEY } from "@/utils/platform";
import { copyInstanceToClipboardAndPreview } from "@/views/timeline/copy-instance-to-clipboard";
import { decideAddInstancePlacement } from "@/views/timeline/decide-add-instance-placement";
import { instanceToTemplate } from "@/views/timeline/group-ops";
import { jumpToAdjacentInstance } from "@/views/timeline/jump-to-instance";
import { pingGroup } from "@/views/timeline/ping-group";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback } from "react";
import { toast } from "sonner";

// -- Hook ---------------------------------------------------------------------

function useInstanceMenuActions(clearContextMenu: () => void) {
  const contextMenu = useTimelineStore((s) => s.contextMenu);

  const handleDetachInstance = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId, instanceIdx } = contextMenu.target;
    useProjectStore.getState().removeInstance(groupId, instanceIdx);
    showGroupActionToast("Instance detached");
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleToggleCollapse = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId, instanceIdx } = contextMenu.target;
    useTimelineStore.getState().toggleInstanceCollapsed(`${groupId}:${instanceIdx}`);
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleAddInstanceAtPlayhead = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId, instanceIdx } = contextMenu.target;
    const audioEl = useAudioStore.getState().audioElement;
    const playheadTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
    const { lines: projectLines, groups } = useProjectStore.getState();
    const group = groups.find((candidate) => candidate.id === groupId);
    const template = instanceToTemplate(projectLines, groupId, pickedTemplateSource(projectLines, group, instanceIdx));
    if (template.length === 0) {
      toast.error("Could not derive instance template");
      return;
    }
    const placement = decideAddInstancePlacement({
      lines: projectLines,
      groupId,
      template,
      playheadTime,
    });
    if (placement.kind === "fill") {
      useProjectStore
        .getState()
        .setLinesWithHistory(placement.updatedLines, withNewInstance(groups, groupId, placement.instanceIdx));
      toast.success("Linked instance placed in empty rows");
    } else if (placement.kind === "insert") {
      useProjectStore.getState().addInstance(groupId, template, placement.instanceStart, placement.insertAtIndex);
      toast.success("Linked instance added at playhead");
    } else {
      copyInstanceToClipboardAndPreview(projectLines, groupId, instanceIdx);
      toast(`No room at the playhead. ${MOD_KEY}+V to paste somewhere clear.`);
    }
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleShiftToPlayhead = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId, instanceIdx } = contextMenu.target;
    const audioEl = useAudioStore.getState().audioElement;
    const playheadTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
    const projectLines = useProjectStore.getState().lines;
    const instanceLines = linesOfInstance(projectLines, groupId, instanceIdx);
    const bounds = instanceBounds(instanceLines);
    if (!bounds) return;
    const delta = playheadTime - bounds.begin;
    useProjectStore.getState().shiftInstance(groupId, instanceIdx, delta, useAudioStore.getState().duration);
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handlePingSiblings = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    pingGroup(contextMenu.target.groupId);
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleJumpToInstanceOffset = useCallback(
    (direction: 1 | -1) => {
      if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
      jumpToAdjacentInstance(contextMenu.target.groupId, contextMenu.target.instanceIdx, direction);
      clearContextMenu();
    },
    [contextMenu, clearContextMenu],
  );

  const handleJumpPrevInstance = useCallback(() => handleJumpToInstanceOffset(-1), [handleJumpToInstanceOffset]);
  const handleJumpNextInstance = useCallback(() => handleJumpToInstanceOffset(1), [handleJumpToInstanceOffset]);

  return {
    handleDetachInstance,
    handleToggleCollapse,
    handleAddInstanceAtPlayhead,
    handleShiftToPlayhead,
    handlePingSiblings,
    handleJumpPrevInstance,
    handleJumpNextInstance,
  };
}

// -- Exports ------------------------------------------------------------------

export { useInstanceMenuActions };
