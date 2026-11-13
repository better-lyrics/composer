import { useMemo } from "react";
import {
  instanceStart,
  isInstanceFullyTimed,
  isSharedLine,
  sharedInstancesInLineOrder,
} from "@/domain/group/shared-timing";
import { templateSourceInstance } from "@/domain/group/template-source";
import { instanceIndicesOf } from "@/domain/instance/enumerate";
import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { fieldWords, mainTrack, timedSyllables, trackField, trackWords } from "@/domain/line/track";
import { isAddressed } from "@/domain/selection/identity";
import { resolveAddress } from "@/domain/selection/resolve";
import { hasIntraGroupGap, isInSyllableGroup } from "@/domain/word/syllable-groups";
import { isAutoAlignAvailable } from "@/stores/alignment";
import { countAlignableLines } from "@/stores/alignment-plan";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import {
  createGroupFromSelection,
  fillSelectionGaps,
  instanceToTemplate,
  lineIdsAreContiguous,
  selectionTouchesAnyGroup,
} from "@/views/timeline/group-ops";
import { computeSplitIntoWordsUpdates, splitTargetsForMenu } from "@/views/timeline/split-lines-into-words";
import { timelineDrawnLines } from "@/views/timeline/timeline-drawn-lines";
import type { ContextMenuTarget } from "@/views/timeline/timeline-store";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import {
  explicitToggleTarget,
  singleSelectedWord,
  syllableMergeTarget,
  wordMergeTarget,
} from "@/views/timeline/word-commands";

// -- Constants ----------------------------------------------------------------

const NO_LINES: LyricLine[] = [];

// -- Selection ----------------------------------------------------------------

// Auto-includes the right-clicked line for word/track/gutter targets so the user
// can right-click a non-selected line and still act on it.
function selectionLineIdsForTarget(target: ContextMenuTarget): Set<string> {
  const ids = new Set<string>(useTimelineStore.getState().selectedWords.map((w) => w.lineId));
  if (target.kind !== "group-banner") ids.add(target.lineId);
  return ids;
}

// -- Hook ---------------------------------------------------------------------

function useContextMenuTargets() {
  const contextMenu = useTimelineStore((s) => s.contextMenu);
  const selectedWords = useTimelineStore((s) => s.selectedWords);
  const rawLines = useProjectStore((s) => s.lines);

  const lines = contextMenu ? timelineDrawnLines(rawLines) : NO_LINES;

  const explicitToggle = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return null;
    return explicitToggleTarget(selectedWords, rawLines);
  }, [contextMenu, selectedWords, rawLines]);

  const wordCommandTargets = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return null;
    return {
      editable: singleSelectedWord(selectedWords),
      syllableMerge: syllableMergeTarget(selectedWords, rawLines),
    };
  }, [contextMenu, selectedWords, rawLines]);

  const clickedSelectionCount = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return null;
    const { lineId, type, syllableId } = contextMenu.target;
    return isAddressed(selectedWords, lineId, type, syllableId) ? selectedWords.length : null;
  }, [contextMenu, selectedWords]);

  const gutterLineGroupInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "gutter") return null;
    const { lineId } = contextMenu.target;
    const realLine = rawLines.find((l) => l.id === lineId);
    if (!realLine?.groupId) return null;
    return { lineId, groupId: realLine.groupId };
  }, [contextMenu, rawLines]);

  const groupableSelection = useMemo(() => {
    if (!contextMenu) return null;
    const selectedLineIds = selectionLineIdsForTarget(contextMenu.target);
    if (selectedLineIds.size < 1) return null;
    if (selectionTouchesAnyGroup(rawLines, selectedLineIds)) return null;
    const filled = fillSelectionGaps(rawLines, selectedLineIds);
    if (!filled) return null;
    const result = createGroupFromSelection(
      rawLines,
      filled.expanded,
      useProjectStore.getState().groups,
      useSettingsStore.getState().shareTimingInNewGroups,
      { duration: useAudioStore.getState().duration },
    );
    if (!result) return null;
    return {
      selectedLineIds: filled.expanded,
      count: filled.expanded.size,
      addedFromGaps: filled.addedCount,
      result,
    };
  }, [contextMenu, rawLines]);

  const conformableSelection = useMemo(() => {
    if (!contextMenu) return null;
    const selectedLineIds = selectionLineIdsForTarget(contextMenu.target);
    if (selectedLineIds.size < 1) return null;
    if (selectionTouchesAnyGroup(rawLines, selectedLineIds)) return null;
    if (!lineIdsAreContiguous(rawLines, selectedLineIds)) return null;

    const options = useProjectStore.getState().groups.flatMap((group) => {
      const firstInstanceIdx = instanceIndicesOf(rawLines, group.id)[0];
      if (firstInstanceIdx === undefined) return [];
      const template = instanceToTemplate(
        rawLines,
        group.id,
        templateSourceInstance(rawLines, group, firstInstanceIdx),
      );
      return template.length === selectedLineIds.size ? [{ group, template }] : [];
    });
    if (options.length === 0) return null;
    return { selectedLineIds, count: selectedLineIds.size, options };
  }, [contextMenu, rawLines]);

  const mergeInfo = useMemo(() => {
    if (!contextMenu) return null;
    return wordMergeTarget(selectedWords, rawLines);
  }, [contextMenu, selectedWords, rawLines]);

  const groupedWordInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return null;
    const resolved = resolveAddress(rawLines, contextMenu.target);
    if (!resolved) return null;
    const { lineId, type, wordIndex } = resolved;
    if (!isInSyllableGroup(trackWords(rawLines[resolved.lineIndex], type) ?? [], wordIndex)) return null;
    return { lineId, field: trackField(type), wordIndex };
  }, [contextMenu, rawLines]);

  const snapNeededInfo = useMemo(() => {
    if (!groupedWordInfo) return null;
    const line = rawLines.find((l) => l.id === groupedWordInfo.lineId);
    const words = line && fieldWords(line, groupedWordInfo.field);
    if (!words) return null;
    return hasIntraGroupGap(words) ? groupedWordInfo : null;
  }, [groupedWordInfo, rawLines]);

  const placeLineHereInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "track") return null;
    const trackTarget = contextMenu.target;
    const targetLine = rawLines.find((l) => l.id === trackTarget.lineId);
    if (!targetLine) return null;
    const canPlace =
      lineText(targetLine).trim() !== "" &&
      !timedSyllables(mainTrack(targetLine)).length &&
      mainTrack(targetLine).begin === undefined;
    return canPlace ? targetLine : null;
  }, [contextMenu, rawLines]);

  const placeAtPlayheadInfo = useMemo(() => {
    if (!contextMenu || (contextMenu.target.kind !== "gutter" && contextMenu.target.kind !== "track")) return null;
    const { lineId } = contextMenu.target;
    const line = rawLines.find((l) => l.id === lineId);
    const groups = useProjectStore.getState().groups;
    const group = groups.find((candidate) => candidate.id === line?.groupId);
    if (!line || !group || !isLinked(line) || !isSharedLine(line, new Map([[group.id, group]]))) return null;
    const { instanceIdx } = line;
    if (instanceStart(rawLines, group.id, instanceIdx) !== null) return null;
    const hasTimedSibling = sharedInstancesInLineOrder(rawLines, group).some(
      (other) => other !== instanceIdx && isInstanceFullyTimed(rawLines, group.id, other),
    );
    return hasTimedSibling ? { groupId: group.id, instanceIdx } : null;
  }, [contextMenu, rawLines]);

  const splitIntoWordsInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return null;
    const updates = computeSplitIntoWordsUpdates(splitTargetsForMenu(contextMenu.target, selectedWords), rawLines);
    if (updates.length === 0) return null;
    return { count: updates.length };
  }, [contextMenu, selectedWords, rawLines]);

  const autoAlignInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "word" || !isAutoAlignAvailable()) return null;
    const targets = splitTargetsForMenu(contextMenu.target, selectedWords).filter((t) => t.type === "word");
    const lineIds = [...new Set(targets.map((t) => t.lineId))];
    const { lineTimed, wordTimed } = countAlignableLines(rawLines, lineIds);
    const count = lineTimed + wordTimed;
    return count > 0 ? { count, lineIds, realign: wordTimed > 0 } : null;
  }, [contextMenu, selectedWords, rawLines]);

  return {
    lines,
    autoAlignInfo,
    explicitToggle,
    wordCommandTargets,
    clickedSelectionCount,
    gutterLineGroupInfo,
    groupableSelection,
    conformableSelection,
    mergeInfo,
    groupedWordInfo,
    snapNeededInfo,
    placeLineHereInfo,
    placeAtPlayheadInfo,
    splitIntoWordsInfo,
  };
}

type ContextMenuTargets = ReturnType<typeof useContextMenuTargets>;

// -- Exports ------------------------------------------------------------------

export type { ContextMenuTargets };
export { useContextMenuTargets };
