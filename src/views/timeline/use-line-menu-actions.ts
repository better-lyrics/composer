import { useCallback } from "react";
import { detachLine, placeInstance } from "@/domain/commands/instance-edits";
import { deleteLine } from "@/domain/commands/instance-rows";
import { placeLineAt } from "@/domain/commands/line-timing";
import { isRefused } from "@/domain/commands/outcome";
import { assignSinger } from "@/domain/commands/singer";
import { isSharedLine } from "@/domain/group/shared-timing";
import { instanceName } from "@/domain/instance/name";
import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { mainTrack } from "@/domain/line/track";
import { useAutoAlign } from "@/hooks/use-auto-align";
import { noteGuideSignal } from "@/lib/guide-signals";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { showGroupActionToast, showPlacementBlockedToast } from "@/utils/group-toast";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { insertEmptyLine } from "@/views/timeline/insert-empty-line";
import { splitLinesIntoWords, splitTargetsForMenu } from "@/views/timeline/split-lines-into-words";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { ContextMenuTargets } from "@/views/timeline/use-context-menu-targets";

// -- Functions ----------------------------------------------------------------

function sharedInstanceNameOf(lines: readonly LyricLine[], lineId: string): string | null {
  const line = lines.find((candidate) => candidate.id === lineId);
  const groupsById = new Map(useProjectStore.getState().groups.map((group) => [group.id, group]));
  if (!line || !isLinked(line) || !isSharedLine(line, groupsById)) return null;
  const group = groupsById.get(line.groupId);
  return group ? instanceName(lines, group, line.instanceIdx) : null;
}

// -- Hook ---------------------------------------------------------------------

function useLineMenuActions(targets: ContextMenuTargets, clearContextMenu: () => void) {
  const { lines, gutterLineGroupInfo, placeAtPlayheadInfo, autoAlignInfo } = targets;
  const { autoAlign } = useAutoAlign();
  const contextMenu = useTimelineStore((s) => s.contextMenu);
  const selectedWords = useTimelineStore((s) => s.selectedWords);
  const rawLines = useProjectStore((s) => s.lines);

  const handlePlaceLineHere = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "track") return;
    const { lineId, time } = contextMenu.target;
    const line = rawLines.find((l) => l.id === lineId);
    if (!line) return;
    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const wordCount = splitIntoWordsWithMeta(lineText(line)).parts.length;
    const lineDuration = Math.max(wordCount, 1) * wordDuration;
    useProjectStore.getState().commit(placeLineAt(lineId, time, time + lineDuration));
    clearContextMenu();
  }, [contextMenu, rawLines, clearContextMenu]);

  const handlePlaceAtPlayhead = useCallback(() => {
    if (!placeAtPlayheadInfo) return;
    const audio = useAudioStore.getState();
    const playheadTime = livePlaybackTime();
    const { groupId, instanceIdx } = placeAtPlayheadInfo;
    if (
      isRefused(useProjectStore.getState().commit(placeInstance(groupId, instanceIdx, playheadTime, audio.duration)))
    ) {
      showPlacementBlockedToast();
    }
    clearContextMenu();
  }, [placeAtPlayheadInfo, clearContextMenu]);

  const handleAddLine = useCallback(
    (position: "above" | "below") => {
      if (!contextMenu || contextMenu.target.kind !== "gutter") return;
      insertEmptyLine(contextMenu.target.lineId, position);
      clearContextMenu();
    },
    [contextMenu, clearContextMenu],
  );

  const handleDeleteLine = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "gutter") return;
    const lineId = contextMenu.target.lineId;
    const sharedName = sharedInstanceNameOf(rawLines, lineId);
    useProjectStore.getState().commit(deleteLine(lineId));
    if (sharedName) showGroupActionToast(`Line deleted from ${sharedName}. Its timing no longer copies there.`);
    clearContextMenu();
  }, [contextMenu, rawLines, clearContextMenu]);

  const handleDetachLine = useCallback(() => {
    if (!gutterLineGroupInfo) return;
    useProjectStore.getState().commit(detachLine(gutterLineGroupInfo.lineId));
    showGroupActionToast("Line detached");
    clearContextMenu();
  }, [gutterLineGroupInfo, clearContextMenu]);

  const handleAssignAgent = useCallback(
    (agentId: string) => {
      if (!contextMenu || contextMenu.target.kind !== "gutter") return;
      const { lineId } = contextMenu.target;
      const line = rawLines.find((candidate) => candidate.id === lineId);
      if (!line || mainTrack(line).agentId !== agentId) {
        useProjectStore.getState().commit(assignSinger([lineId], agentId));
        noteGuideSignal("edit.singer");
      }
      clearContextMenu();
    },
    [contextMenu, rawLines, clearContextMenu],
  );

  const handleSplitIntoWords = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return;
    splitLinesIntoWords(splitTargetsForMenu(contextMenu.target, selectedWords), lines);
    clearContextMenu();
  }, [contextMenu, selectedWords, lines, clearContextMenu]);

  const handleAutoAlign = useCallback(() => {
    if (!autoAlignInfo) return;
    void autoAlign(autoAlignInfo.lineIds, { realign: autoAlignInfo.realign });
    clearContextMenu();
  }, [autoAlignInfo, autoAlign, clearContextMenu]);

  return {
    activeAgentIdAt: (lineIndex: number) => lines[lineIndex] && mainTrack(lines[lineIndex]).agentId,
    handleAutoAlign,
    handlePlaceLineHere,
    handlePlaceAtPlayhead,
    handleAddLine,
    handleDeleteLine,
    handleDetachLine,
    handleAssignAgent,
    handleSplitIntoWords,
  };
}

// -- Exports ------------------------------------------------------------------

export { useLineMenuActions };
