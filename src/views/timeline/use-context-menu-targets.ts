import { instanceIndicesOf } from "@/domain/instance/enumerate";
import { getEffectiveLines } from "@/domain/line/effective-words";
import { isLineSynced } from "@/domain/line/predicates";
import { contiguousSelectionRun } from "@/domain/selection/contiguous";
import { hasIntraGroupGap } from "@/domain/word/syllable-groups";
import { useProjectStore } from "@/stores/project";
import {
  createGroupFromSelection,
  fillSelectionGaps,
  instanceToTemplate,
  lineIdsAreContiguous,
  selectionTouchesAnyGroup,
} from "@/views/timeline/group-ops";
import type { ContextMenuTarget } from "@/views/timeline/timeline-store";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useMemo } from "react";

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

  const lines = useMemo(() => getEffectiveLines(rawLines), [rawLines]);

  const explicitToggleContext = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return null;
    const { lineId, wordIndex, type } = contextMenu.target;
    const line = rawLines.find((l) => l.id === lineId);
    if (!line) return null;
    const field: "words" | "backgroundWords" = type === "word" ? "words" : "backgroundWords";
    const wordsArray = line[field];
    if (!wordsArray || wordsArray.length === 0) return null;

    const selectedWords = useTimelineStore.getState().selectedWords;
    const selectionMatchesTarget = selectedWords.some(
      (w) => w.lineId === lineId && w.type === type && w.wordIndex === wordIndex,
    );
    const indices =
      selectionMatchesTarget && selectedWords.length > 1
        ? selectedWords.flatMap((w) => (w.lineId === lineId && w.type === type ? [w.wordIndex] : []))
        : [wordIndex];

    const allMarked = indices.every((i) => wordsArray[i]?.explicit === true);
    return { lineId, field, indices, allMarked };
  }, [contextMenu, rawLines]);

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
    const result = createGroupFromSelection(rawLines, filled.expanded, useProjectStore.getState().groups);
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
      const template = instanceToTemplate(rawLines, group.id, firstInstanceIdx);
      return template.length === selectedLineIds.size ? [{ group, template }] : [];
    });
    if (options.length === 0) return null;
    return { selectedLineIds, count: selectedLineIds.size, options };
  }, [contextMenu, rawLines]);

  const mergeInfo = useMemo(() => {
    const run = contiguousSelectionRun(selectedWords);
    if (!run) return null;

    const line = lines.find((l) => l.id === run.lineId);
    if (!line) return null;
    const wordsArray = run.type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return null;

    return { indices: run.indices, lineId: run.lineId, type: run.type };
  }, [selectedWords, lines]);

  const groupedWordInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return null;
    const { lineId, wordIndex, type } = contextMenu.target;
    const line = rawLines.find((l) => l.id === lineId);
    if (!line) return null;
    const field: "words" | "backgroundWords" = type === "word" ? "words" : "backgroundWords";
    const word = line[field]?.[wordIndex];
    if (!word || word.syllableGroupId === undefined) return null;
    return { lineId, field, wordIndex };
  }, [contextMenu, rawLines]);

  const snapNeededInfo = useMemo(() => {
    if (!groupedWordInfo) return null;
    const line = rawLines.find((l) => l.id === groupedWordInfo.lineId);
    const words = line?.[groupedWordInfo.field];
    if (!words) return null;
    return hasIntraGroupGap(words) ? groupedWordInfo : null;
  }, [groupedWordInfo, rawLines]);

  const placeLineHereInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "track") return null;
    const trackTarget = contextMenu.target;
    const targetLine = rawLines.find((l) => l.id === trackTarget.lineId);
    if (!targetLine) return null;
    const canPlace = targetLine.text.trim() !== "" && !targetLine.words?.length && targetLine.begin === undefined;
    return canPlace ? targetLine : null;
  }, [contextMenu, rawLines]);

  const splitIntoWordsInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return null;
    const target = contextMenu.target;

    const selectedLineIds = new Set(selectedWords.map((w) => w.lineId));
    const targetIds =
      selectedLineIds.has(target.lineId) && selectedLineIds.size > 0 ? [...selectedLineIds] : [target.lineId];

    const rawLinesById = new Map(rawLines.map((l) => [l.id, l] as const));
    const lineSyncedIds = targetIds.filter((id) => {
      const realLine = rawLinesById.get(id);
      return realLine && isLineSynced(realLine);
    });

    if (lineSyncedIds.length === 0) return null;
    return { count: lineSyncedIds.length };
  }, [contextMenu, selectedWords, rawLines]);

  return {
    lines,
    explicitToggleContext,
    gutterLineGroupInfo,
    groupableSelection,
    conformableSelection,
    mergeInfo,
    groupedWordInfo,
    snapNeededInfo,
    placeLineHereInfo,
    splitIntoWordsInfo,
  };
}

// -- Exports ------------------------------------------------------------------

export { useContextMenuTargets };
