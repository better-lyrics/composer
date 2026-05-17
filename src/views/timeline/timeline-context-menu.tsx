import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { getAgentColor, useProjectStore } from "@/stores/project";
import type { LyricLine, WordTiming } from "@/stores/project";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { useSettingsStore } from "@/stores/settings";
import { formatKey } from "@/ui/help-modal";
import { GROUP_COLORS } from "@/utils/group-colors";
import { showGroupActionToast } from "@/utils/group-toast";
import { isMac, MOD_KEY } from "@/utils/platform";
import { convertLineToWord, splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { absorbDeletedSyllablesIntoNeighbors } from "@/utils/syllable-groups";
import { addTrailingSpaceIfMissing, findInsertionSlot, trimTrailingSpaceFromLast } from "@/utils/word-spaces";
import { copyInstanceToClipboardAndPreview } from "@/views/timeline/copy-instance-to-clipboard";
import { decideAddInstancePlacement } from "@/views/timeline/decide-add-instance-placement";
import { createGroupFromSelection, fillSelectionGaps, instanceToTemplate } from "@/views/timeline/group-ops";
import { scrollToInstanceHeader } from "@/views/timeline/scroll-helpers";
import { type WordSelection, useTimelineStore } from "@/views/timeline/timeline-store";
import { getEffectiveLines, instanceTimingBounds, isLineSynced } from "@/views/timeline/utils";
import { IconCommand } from "@tabler/icons-react";
import { flip, FloatingPortal, shift, useFloating } from "@floating-ui/react";
import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { toast } from "sonner";

function MenuItem({
  label,
  onClick,
  danger,
  shortcut,
}: { label: string; onClick: () => void; danger?: boolean; shortcut?: string[] }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-4 px-3 py-1.5 text-sm cursor-pointer rounded-md transition-colors ${
        danger ? "text-composer-error hover:bg-composer-error/10" : "text-composer-text hover:bg-composer-button"
      }`}
    >
      <span>{label}</span>
      {shortcut && (
        <span className="inline-flex items-center gap-0.5">
          {shortcut.map((key) => (
            <span
              key={key}
              className="inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-medium rounded bg-white/10 text-composer-text-muted leading-none shadow-[0_2px_0_0_rgba(0,0,0,0.3)]"
            >
              {key === "Mod" && isMac ? <IconCommand className="size-2.5" /> : formatKey(key)}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-composer-border" />;
}

// -- Component ----------------------------------------------------------------

const TimelineContextMenu: React.FC = () => {
  const contextMenu = useTimelineStore((s) => s.contextMenu);
  const clearContextMenu = useTimelineStore((s) => s.clearContextMenu);

  const { refs, floatingStyles } = useFloating({
    placement: "bottom-start",
    middleware: [flip({ fallbackPlacements: ["top-start", "bottom-end", "top-end"] }), shift({ padding: 8 })],
  });

  const rawLines = useProjectStore((s) => s.lines);
  const agents = useProjectStore((s) => s.agents);
  const groups = useProjectStore((s) => s.groups);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const setLinesWithHistory = useProjectStore((s) => s.setLinesWithHistory);
  const toggleWordExplicit = useProjectStore((s) => s.toggleWordExplicit);
  const duration = useAudioStore((s) => s.duration);
  const confirm = useConfirm();

  const lines = useMemo(() => getEffectiveLines(rawLines), [rawLines]);

  const setRenamingGroupId = useTimelineStore((s) => s.setRenamingGroupId);

  useLayoutEffect(() => {
    if (!contextMenu) return;
    const { x, y } = contextMenu;
    refs.setPositionReference({
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        x,
        y,
        top: y,
        left: x,
        right: x,
        bottom: y,
      }),
    });
  }, [contextMenu, refs]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      const el = refs.floating.current;
      if (el && !el.contains(e.target as Node)) {
        clearContextMenu();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearContextMenu();
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu, clearContextMenu, refs.floating]);

  const handleEditWord = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return;
    const { lineId, wordIndex, type } = contextMenu.target;
    useTimelineStore.getState().setEditingWord({ lineId, wordIndex, type });
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleSplitSyllables = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return;
    const { lineId, wordIndex, type } = contextMenu.target;
    useTimelineStore.getState().setEditingWord(null);
    // Store target info and open syllable splitter via editingWord with a flag
    // For now, use the keyboard shortcut approach - set selection and close menu
    const lineIndex = contextMenu.target.lineIndex;
    useTimelineStore.getState().setSelectedWords([{ lineId, lineIndex, wordIndex, type }]);
    clearContextMenu();
    // Dispatch a custom event so the syllable splitter can pick it up
    window.dispatchEvent(new CustomEvent("timeline:split-syllable"));
  }, [contextMenu, clearContextMenu]);

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

  const handleToggleExplicit = useCallback(() => {
    if (!explicitToggleContext) return;
    const { lineId, field, indices } = explicitToggleContext;
    toggleWordExplicit(lineId, field, indices);
    clearContextMenu();
  }, [explicitToggleContext, toggleWordExplicit, clearContextMenu]);

  const handleDeleteWord = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return;
    const { lineId, wordIndex, type } = contextMenu.target;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const wordsArray = type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return;

    const absorbed = absorbDeletedSyllablesIntoNeighbors(wordsArray, [wordIndex]);
    const remaining = absorbed.filter((_, i) => i !== wordIndex);
    if (type === "word") {
      updateLineWithHistory(lineId, { words: remaining });
    } else {
      updateLineWithHistory(lineId, {
        backgroundWords: remaining.length > 0 ? remaining : undefined,
        backgroundText: remaining.length > 0 ? remaining.map((w) => w.text).join("") : undefined,
      });
    }
    clearContextMenu();
  }, [contextMenu, lines, updateLineWithHistory, clearContextMenu]);

  const handleAddWordHere = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "track") return;
    const { lineId, time, type } = contextMenu.target;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const existingWords = type === "word" ? line.words : line.backgroundWords;
    const slot = findInsertionSlot(existingWords ?? [], time, wordDuration, duration);
    if (!slot) {
      clearContextMenu();
      return;
    }

    const newWord: WordTiming = { text: "... ", begin: slot.begin, end: slot.end };
    const existing = existingWords ?? [];
    const prevLast = existing[existing.length - 1];
    const sorted = [...existing, newWord].sort((a, b) => a.begin - b.begin);
    const newIndex = sorted.indexOf(newWord);
    const reconciled = prevLast ? addTrailingSpaceIfMissing(sorted, prevLast) : sorted;
    const words = trimTrailingSpaceFromLast(reconciled);

    if (type === "word") {
      updateLineWithHistory(lineId, { words });
    } else {
      updateLineWithHistory(lineId, {
        backgroundWords: words,
        backgroundText: words.map((w) => w.text).join(""),
      });
    }
    useTimelineStore.getState().setEditingWord({ lineId, wordIndex: newIndex, type });
    clearContextMenu();
  }, [contextMenu, lines, duration, updateLineWithHistory, clearContextMenu]);

  const handlePlaceLineHere = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "track") return;
    const { lineId, time } = contextMenu.target;
    const line = rawLines.find((l) => l.id === lineId);
    if (!line) return;
    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const wordCount = splitIntoWordsWithMeta(line.text).parts.length;
    const lineDuration = Math.max(wordCount, 1) * wordDuration;
    updateLineWithHistory(lineId, {
      begin: time,
      end: time + lineDuration,
    });
    clearContextMenu();
  }, [contextMenu, rawLines, updateLineWithHistory, clearContextMenu]);

  const handleAddLine = useCallback(
    (position: "above" | "below") => {
      if (!contextMenu || contextMenu.target.kind !== "gutter") return;
      // Operate on raw lines, not effective lines. getEffectiveLines synthesises
      // single-word arrays for line-synced rows; if we wrote those back via
      // setLinesWithHistory, every line-synced row would silently flip to
      // word-synced (and TTML granularity would change on save).
      const lineId = contextMenu.target.lineId;
      const targetIndex = rawLines.findIndex((l) => l.id === lineId);
      if (targetIndex === -1) return;
      const defaultAgentId = agents?.[0]?.id ?? "v1";
      const newLine = { id: crypto.randomUUID(), text: "", agentId: defaultAgentId };
      const newLines = [...rawLines];
      const insertIndex = position === "above" ? targetIndex : targetIndex + 1;
      newLines.splice(insertIndex, 0, newLine);
      setLinesWithHistory(newLines);
      clearContextMenu();
    },
    [contextMenu, rawLines, agents, setLinesWithHistory, clearContextMenu],
  );

  const handleDeleteLine = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "gutter") return;
    const lineId = contextMenu.target.lineId;
    const newLines = rawLines.filter((l) => l.id !== lineId);
    setLinesWithHistory(newLines);
    clearContextMenu();
  }, [contextMenu, rawLines, setLinesWithHistory, clearContextMenu]);

  const gutterLineGroupInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "gutter") return null;
    const { lineId } = contextMenu.target;
    const realLine = rawLines.find((l) => l.id === lineId);
    if (!realLine?.groupId) return null;
    return { lineId, groupId: realLine.groupId };
  }, [contextMenu, rawLines]);

  const handleDetachLine = useCallback(() => {
    if (!gutterLineGroupInfo) return;
    useProjectStore.getState().detachLine(gutterLineGroupInfo.lineId);
    showGroupActionToast("Line detached");
    clearContextMenu();
  }, [gutterLineGroupInfo, clearContextMenu]);

  const handleJumpToGroupFromBanner = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId, instanceIdx } = contextMenu.target;
    scrollToInstanceHeader(groupId, instanceIdx);
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const groupableSelection = useMemo(() => {
    if (!contextMenu) return null;
    const target = contextMenu.target;
    const selectedWords = useTimelineStore.getState().selectedWords;
    const selectedLineIds = new Set<string>(selectedWords.map((w) => w.lineId));
    // Auto-include the right-clicked line for word/track/gutter targets so the user can
    // right-click on a non-selected line and still get "Group this line".
    if (target.kind === "gutter" || target.kind === "track" || target.kind === "word") {
      selectedLineIds.add(target.lineId);
    }
    if (selectedLineIds.size < 1) return null;
    const rawLinesById = new Map<string, LyricLine>();
    for (const l of rawLines) rawLinesById.set(l.id, l);
    for (const id of selectedLineIds) {
      const line = rawLinesById.get(id);
      if (line?.groupId !== undefined) return null;
    }
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

  const handleCreateGroupFromSelection = useCallback(() => {
    if (!groupableSelection) return;
    const projectState = useProjectStore.getState();
    projectState.addGroupWithLines(groupableSelection.result.group, groupableSelection.result.updatedLines);
    toast.success(`Grouped ${groupableSelection.count} line${groupableSelection.count === 1 ? "" : "s"}`);
    clearContextMenu();
  }, [groupableSelection, clearContextMenu]);

  const handleAssignAgent = useCallback(
    (agentId: string) => {
      if (!contextMenu || contextMenu.target.kind !== "gutter") return;
      const { lineId } = contextMenu.target;
      updateLineWithHistory(lineId, { agentId });
      clearContextMenu();
    },
    [contextMenu, updateLineWithHistory, clearContextMenu],
  );

  const selectedWords = useTimelineStore((s) => s.selectedWords);

  const handleSplitIntoWords = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return;
    const { lineId } = contextMenu.target;

    const selectedLineIds = new Set(selectedWords.map((w) => w.lineId));
    const targetIds = selectedLineIds.has(lineId) && selectedLineIds.size > 0 ? [...selectedLineIds] : [lineId];

    const rawLinesByIdSplit = new Map<string, LyricLine>();
    for (const l of rawLines) rawLinesByIdSplit.set(l.id, l);
    const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];
    for (const id of targetIds) {
      const realLine = rawLinesByIdSplit.get(id);
      if (!realLine || !isLineSynced(realLine)) continue;
      const converted = convertLineToWord(realLine);
      if (converted.words) {
        updates.push({ id, updates: { words: converted.words, begin: undefined, end: undefined } });
      }
    }

    if (updates.length === 1) {
      updateLineWithHistory(updates[0].id, updates[0].updates);
    } else if (updates.length > 1) {
      useProjectStore.getState().updateLinesWithHistory(updates);
    }

    const lineIndexById = new Map<string, number>();
    for (let i = 0; i < lines.length; i++) lineIndexById.set(lines[i].id, i);
    const newSelections: Array<{ lineId: string; lineIndex: number; wordIndex: number; type: "word" | "bg" }> = [];
    for (const u of updates) {
      const lineIndex = lineIndexById.get(u.id);
      if (lineIndex === undefined || !u.updates.words) continue;
      for (let wi = 0; wi < u.updates.words.length; wi++) {
        newSelections.push({ lineId: u.id, lineIndex, wordIndex: wi, type: "word" });
      }
    }
    if (newSelections.length > 0) {
      useTimelineStore.getState().setSelectedWords(newSelections);
    }

    clearContextMenu();
  }, [contextMenu, rawLines, selectedWords, lines, updateLineWithHistory, clearContextMenu]);

  const mergeInfo = useMemo(() => {
    if (selectedWords.length < 2) return null;
    const first = selectedWords[0];
    const allSameLine = selectedWords.every((w) => w.lineId === first.lineId && w.type === first.type);
    if (!allSameLine) return null;

    const sorted = selectedWords.toSorted((a, b) => a.wordIndex - b.wordIndex);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].wordIndex !== sorted[i - 1].wordIndex + 1) return null;
    }

    const line = lines.find((l) => l.id === first.lineId);
    if (!line) return null;
    const wordsArray = first.type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return null;

    // Check no trailing spaces between merged words (except the last one)
    for (let i = 0; i < sorted.length - 1; i++) {
      const w = wordsArray[sorted[i].wordIndex];
      if (!w) return null;
      if (w.text.endsWith(" ")) return null;
    }

    return { sorted, lineId: first.lineId, type: first.type };
  }, [selectedWords, lines]);

  const syllableGroupInfo = useMemo(() => {
    if (selectedWords.length < 2) return null;
    const first = selectedWords[0];
    const allSameLine = selectedWords.every((w) => w.lineId === first.lineId && w.type === first.type);
    if (!allSameLine) return null;

    const sorted = selectedWords.toSorted((a, b) => a.wordIndex - b.wordIndex);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].wordIndex !== sorted[i - 1].wordIndex + 1) return null;
    }

    const line = lines.find((l) => l.id === first.lineId);
    if (!line) return null;
    const wordsArray = first.type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return null;

    return { sorted, lineId: first.lineId, type: first.type };
  }, [selectedWords, lines]);

  const handleMergeIntoSyllables = useCallback(() => {
    if (!syllableGroupInfo) return;
    const { sorted, lineId, type } = syllableGroupInfo;
    const field = type === "word" ? "words" : "backgroundWords";
    useProjectStore.getState().mergeWordsIntoSyllableGroup(
      lineId,
      field,
      sorted.map((s) => s.wordIndex),
    );
    clearContextMenu();
  }, [syllableGroupInfo, clearContextMenu]);

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

  const handleMergeSyllables = useCallback(() => {
    if (!groupedWordInfo) return;
    useProjectStore
      .getState()
      .mergeSyllableGroupIntoWord(groupedWordInfo.lineId, groupedWordInfo.field, [groupedWordInfo.wordIndex]);
    clearContextMenu();
  }, [groupedWordInfo, clearContextMenu]);

  const handleSnapSyllables = useCallback(() => {
    if (!groupedWordInfo) return;
    useProjectStore.getState().snapSyllablesFlush(groupedWordInfo.lineId, groupedWordInfo.field);
    clearContextMenu();
  }, [groupedWordInfo, clearContextMenu]);

  const handleMergeWords = useCallback(() => {
    if (!mergeInfo) return;
    const { sorted, lineId, type } = mergeInfo;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const wordsArray = type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return;

    const firstIdx = sorted[0].wordIndex;
    const lastIdx = sorted[sorted.length - 1].wordIndex;
    const mergedText = sorted.map((s) => wordsArray[s.wordIndex].text).join("");
    const merged: WordTiming = {
      text: mergedText,
      begin: wordsArray[firstIdx].begin,
      end: wordsArray[lastIdx].end,
    };

    const updatedWords = [...wordsArray.slice(0, firstIdx), merged, ...wordsArray.slice(lastIdx + 1)];

    if (type === "word") {
      updateLineWithHistory(lineId, {
        words: updatedWords,
        text: updatedWords
          .map((w) => w.text)
          .join("")
          .trimEnd(),
      });
    } else {
      updateLineWithHistory(lineId, {
        backgroundWords: updatedWords,
        backgroundText: updatedWords
          .map((w) => w.text)
          .join("")
          .trimEnd(),
      });
    }

    useTimelineStore.getState().clearSelection();
    clearContextMenu();
  }, [mergeInfo, lines, updateLineWithHistory, clearContextMenu]);

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
    const projectLines = useProjectStore.getState().lines;
    const template = instanceToTemplate(projectLines, groupId, instanceIdx);
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
      useProjectStore.getState().setLinesWithHistory(placement.updatedLines);
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
    const instanceLines = projectLines.filter((l) => l.groupId === groupId && l.instanceIdx === instanceIdx);
    const { start: earliest } = instanceTimingBounds(instanceLines);
    if (!Number.isFinite(earliest)) return;
    const delta = playheadTime - earliest;
    useProjectStore.getState().shiftInstance(groupId, instanceIdx, delta);
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

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

  const handlePingSiblings = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId } = contextMenu.target;
    useTimelineStore.getState().setPingingGroupId(groupId);
    window.setTimeout(() => {
      if (useTimelineStore.getState().pingingGroupId === groupId) {
        useTimelineStore.getState().setPingingGroupId(null);
      }
    }, 700);
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleJumpToInstanceOffset = useCallback(
    (direction: 1 | -1) => {
      if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
      const { groupId, instanceIdx } = contextMenu.target;
      const projectLines = useProjectStore.getState().lines;
      const indices = new Set<number>();
      for (const l of projectLines) {
        if (l.groupId === groupId && l.instanceIdx !== undefined) indices.add(l.instanceIdx);
      }
      const sorted = Array.from(indices).sort((a, b) => a - b);
      if (sorted.length < 2) return;
      const here = sorted.indexOf(instanceIdx);
      const next = sorted[(here + direction + sorted.length) % sorted.length];
      const wordsInNext: WordSelection[] = [];
      for (let li = 0; li < projectLines.length; li++) {
        const line = projectLines[li];
        if (line.groupId !== groupId || line.instanceIdx !== next) continue;
        for (let wi = 0; wi < (line.words?.length ?? 0); wi++) {
          wordsInNext.push({ lineId: line.id, lineIndex: li, wordIndex: wi, type: "word" });
        }
        for (let wi = 0; wi < (line.backgroundWords?.length ?? 0); wi++) {
          wordsInNext.push({ lineId: line.id, lineIndex: li, wordIndex: wi, type: "bg" });
        }
      }
      useTimelineStore.getState().setSelectedWords(wordsInNext);
      scrollToInstanceHeader(groupId, next);
      clearContextMenu();
    },
    [contextMenu, clearContextMenu],
  );

  const handleJumpPrevInstance = useCallback(() => handleJumpToInstanceOffset(-1), [handleJumpToInstanceOffset]);
  const handleJumpNextInstance = useCallback(() => handleJumpToInstanceOffset(1), [handleJumpToInstanceOffset]);

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

  if (!contextMenu) return null;

  const { target } = contextMenu;

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        className="z-100 min-w-36 p-1 border shadow-2xl rounded-lg bg-composer-bg border-composer-border select-none"
        style={floatingStyles}
      >
        {target.kind === "word" && (
          <>
            <MenuItem label="Edit text" shortcut={["E"]} onClick={handleEditWord} />
            <MenuItem label="Split syllables" shortcut={["S"]} onClick={handleSplitSyllables} />
            {mergeInfo && <MenuItem label="Merge words" shortcut={["M"]} onClick={handleMergeWords} />}
            {syllableGroupInfo && (
              <MenuItem
                label="Merge into one word"
                shortcut={getEffectiveKeysArray("timeline.mergeIntoSyllables")}
                onClick={handleMergeIntoSyllables}
              />
            )}
            {groupedWordInfo && (
              <MenuItem
                label="Merge syllables"
                shortcut={getEffectiveKeysArray("timeline.mergeSyllablesIntoWord")}
                onClick={handleMergeSyllables}
              />
            )}
            {groupedWordInfo && <MenuItem label="Snap syllables flush" onClick={handleSnapSyllables} />}
            {splitIntoWordsInfo && (
              <>
                <MenuDivider />
                <MenuItem
                  label={
                    splitIntoWordsInfo.count > 1
                      ? `Split ${splitIntoWordsInfo.count} lines into words`
                      : "Split into words"
                  }
                  shortcut={getEffectiveKeysArray("timeline.splitIntoWords")}
                  onClick={handleSplitIntoWords}
                />
              </>
            )}
            {groupableSelection && (
              <>
                <MenuDivider />
                <MenuItem
                  label={
                    groupableSelection.count > 1
                      ? `Group ${groupableSelection.count} lines${groupableSelection.addedFromGaps > 0 ? ` (incl. ${groupableSelection.addedFromGaps} gap)` : ""}`
                      : "Group this line"
                  }
                  shortcut={getEffectiveKeysArray("timeline.createGroup")}
                  onClick={handleCreateGroupFromSelection}
                />
              </>
            )}
            {explicitToggleContext && (
              <>
                <MenuDivider />
                <MenuItem
                  label={
                    explicitToggleContext.allMarked
                      ? explicitToggleContext.indices.length > 1
                        ? `Unmark ${explicitToggleContext.indices.length} as explicit`
                        : "Unmark explicit"
                      : explicitToggleContext.indices.length > 1
                        ? `Mark ${explicitToggleContext.indices.length} as explicit`
                        : "Mark as explicit"
                  }
                  shortcut={getEffectiveKeysArray("timeline.toggleExplicit")}
                  onClick={handleToggleExplicit}
                />
              </>
            )}
            <MenuDivider />
            <MenuItem
              label={groupedWordInfo ? "Delete syllable" : "Delete word"}
              shortcut={["Del"]}
              onClick={handleDeleteWord}
              danger
            />
          </>
        )}

        {target.kind === "track" && (
          <>
            <MenuItem label="Add word here" shortcut={["Double Click"]} onClick={handleAddWordHere} />
            {placeLineHereInfo && <MenuItem label="Place line here" onClick={handlePlaceLineHere} />}
            {groupableSelection && (
              <>
                <MenuDivider />
                <MenuItem
                  label={
                    groupableSelection.count > 1
                      ? `Group ${groupableSelection.count} lines${groupableSelection.addedFromGaps > 0 ? ` (incl. ${groupableSelection.addedFromGaps} gap)` : ""}`
                      : "Group this line"
                  }
                  shortcut={getEffectiveKeysArray("timeline.createGroup")}
                  onClick={handleCreateGroupFromSelection}
                />
              </>
            )}
          </>
        )}

        {target.kind === "gutter" && (
          <>
            <MenuItem label="Add line above" shortcut={["Shift", "N"]} onClick={() => handleAddLine("above")} />
            <MenuItem label="Add line below" shortcut={["N"]} onClick={() => handleAddLine("below")} />
            {groupableSelection && (
              <>
                <MenuDivider />
                <MenuItem
                  label={
                    groupableSelection.count > 1
                      ? `Group ${groupableSelection.count} lines${groupableSelection.addedFromGaps > 0 ? ` (incl. ${groupableSelection.addedFromGaps} gap)` : ""}`
                      : "Group this line"
                  }
                  shortcut={getEffectiveKeysArray("timeline.createGroup")}
                  onClick={handleCreateGroupFromSelection}
                />
              </>
            )}
            <MenuDivider />
            {agents.length > 1 && (
              <>
                <p className="px-3 py-1 text-xs text-composer-text-muted">Assign agent</p>
                <div className="flex flex-col gap-px">
                  {agents.map((agent) => {
                    const color = getAgentColor(agent.id);
                    const line = lines[target.lineIndex];
                    const isActive = line?.agentId === agent.id;
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => handleAssignAgent(agent.id)}
                        className={`w-full text-left px-2 py-1 text-sm cursor-pointer rounded-md flex items-center gap-2 transition-colors ${
                          isActive
                            ? "bg-composer-accent/15 text-composer-text"
                            : "text-composer-text hover:bg-composer-button"
                        }`}
                      >
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        {agent.name || agent.id}
                      </button>
                    );
                  })}
                </div>
                <MenuDivider />
              </>
            )}
            {gutterLineGroupInfo && (
              <>
                <MenuItem label="Detach this line" onClick={handleDetachLine} />
                <MenuDivider />
              </>
            )}
            <MenuItem label="Delete line" onClick={handleDeleteLine} danger />
          </>
        )}

        {target.kind === "group-banner" && (
          <>
            <MenuItem
              label={
                useTimelineStore.getState().collapsedInstances[`${target.groupId}:${target.instanceIdx}`]
                  ? "Expand instance"
                  : "Collapse instance"
              }
              shortcut={getEffectiveKeysArray("timeline.toggleCollapseInstance")}
              onClick={handleToggleCollapse}
            />
            <MenuItem
              label={target.source === "gutter" ? "Jump to group" : "Jump to start"}
              shortcut={getEffectiveKeysArray("timeline.jumpToInstanceStart")}
              onClick={handleJumpToGroupFromBanner}
            />
            <MenuItem
              label="Ping siblings"
              shortcut={getEffectiveKeysArray("timeline.pingSiblings")}
              onClick={handlePingSiblings}
            />
            <MenuDivider />
            <MenuItem
              label="Add instance at playhead"
              shortcut={getEffectiveKeysArray("timeline.duplicateAsLinked")}
              onClick={handleAddInstanceAtPlayhead}
            />
            <MenuItem
              label="Shift instance to playhead"
              shortcut={getEffectiveKeysArray("timeline.shiftInstanceToPlayhead")}
              onClick={handleShiftToPlayhead}
            />
            <MenuItem
              label="Jump to previous instance"
              shortcut={getEffectiveKeysArray("timeline.jumpPrevInstance")}
              onClick={handleJumpPrevInstance}
            />
            <MenuItem
              label="Jump to next instance"
              shortcut={getEffectiveKeysArray("timeline.jumpNextInstance")}
              onClick={handleJumpNextInstance}
            />
            <MenuDivider />
            <MenuItem label="Rename" shortcut={["Double Click"]} onClick={handleRenameStart} />
            <MenuDivider />
            <p className="px-3 pt-1.5 pb-1 text-xs text-composer-text-muted">Recolor</p>
            <div className="px-3 pb-1.5 grid grid-cols-5 gap-1.5">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => handleRecolorGroup(c)}
                  className="size-6 rounded-md cursor-pointer border border-white/10 hover:ring-2 hover:ring-white/40 transition-[box-shadow]"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <MenuDivider />
            <MenuItem
              label="Detach instance"
              shortcut={getEffectiveKeysArray("timeline.detachInstance")}
              onClick={handleDetachInstance}
            />
            <MenuItem
              label="Delete group"
              shortcut={getEffectiveKeysArray("timeline.deleteGroup")}
              onClick={handleDeleteGroup}
              danger
            />
          </>
        )}
      </div>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimelineContextMenu };
