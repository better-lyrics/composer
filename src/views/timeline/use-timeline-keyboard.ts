import { useAudioStore } from "@/stores/audio";
import { useConfirmStore } from "@/stores/confirm-store";
import { isAnyModalOpen } from "@/stores/modal-stack";
import { type LyricLine, useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { showGroupActionToast } from "@/utils/group-toast";
import { handleWordChangeWithDivergenceCheck } from "@/utils/word-divergence-flow";
import { convertLineToWord } from "@/utils/sync-helpers";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { copyInstanceToClipboardAndPreview } from "@/views/timeline/copy-instance-to-clipboard";
import { decideAddInstancePlacement } from "@/views/timeline/decide-add-instance-placement";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { createGroupFromSelection, fillSelectionGaps, instanceToTemplate } from "@/views/timeline/group-ops";
import { scrollToInstanceHeader } from "@/views/timeline/scroll-helpers";
import { GUTTER_WIDTH, type WordSelection, useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineClipboard } from "@/views/timeline/use-timeline-clipboard";
import {
  computeRowLayout,
  findWordAtTime,
  getLineTiming,
  getWordsInInstance,
  instanceTimingBounds,
  isLineSynced,
  partitionNudgeSelections,
  shiftSelectionsTogether,
} from "@/views/timeline/utils";
import { type RefObject, useCallback, useEffect } from "react";
import { toast } from "sonner";

// -- Helpers ------------------------------------------------------------------

function currentInstanceFromSelection(
  lines: LyricLine[],
  selectedWords: ReadonlyArray<{ lineId: string }>,
): { groupId: string; instanceIdx: number } | null {
  if (selectedWords.length === 0) return null;
  let groupId: string | null = null;
  let instanceIdx: number | null = null;
  for (const sel of selectedWords) {
    const line = lines.find((l) => l.id === sel.lineId);
    if (!line || line.groupId === undefined || line.instanceIdx === undefined) return null;
    if (groupId === null) {
      groupId = line.groupId;
      instanceIdx = line.instanceIdx;
    } else if (line.groupId !== groupId || line.instanceIdx !== instanceIdx) {
      return null;
    }
  }
  if (groupId === null || instanceIdx === null) return null;
  return { groupId, instanceIdx };
}

function listInstancesOfGroup(lines: LyricLine[], groupId: string): number[] {
  const set = new Set<number>();
  for (const line of lines) {
    if (line.groupId === groupId && line.instanceIdx !== undefined) set.add(line.instanceIdx);
  }
  return [...set].sort((a, b) => a - b);
}

// -- Constants -----------------------------------------------------------------

const WAVEFORM_HEIGHT = 80;
const BG_DROP_ZONE_HEIGHT = 24;

// -- Hook ----------------------------------------------------------------------

function useTimelineKeyboard(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  lines: LyricLine[],
  duration: number,
  onOpenLyricsModal?: () => void,
) {
  const { handleCopy, handleDelete, handleCut, handlePaste } = useTimelineClipboard(lines);

  const handleSetWordTiming = useCallback(
    (edge: "begin" | "end") => {
      const audioEl = useAudioStore.getState().audioElement;
      const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;

      const { selectedWords, zoom, rowHeights, defaultRowHeight } = useTimelineStore.getState();
      const selectedWord = selectedWords[0] ?? null;
      const fromPlayhead = !selectedWord;
      const targetWord = selectedWord ?? findWordAtTime(lines, currentTime);
      if (!targetWord) return;

      const line = lines[targetWord.lineIndex];
      if (!line) return;

      const wordsArray = targetWord.type === "word" ? line.words : line.backgroundWords;
      if (!wordsArray) return;

      const wordIndex = targetWord.wordIndex;
      const word = wordsArray[wordIndex];
      if (!word) return;

      const scrollContainer = scrollContainerRef.current;

      if (fromPlayhead && scrollContainer) {
        const collapsedInstances = useTimelineStore.getState().collapsedInstances;
        const layout = computeRowLayout({
          lines,
          rowHeights,
          defaultRowHeight,
          collapsedInstances,
          waveformHeight: WAVEFORM_HEIGHT,
          bgDropZoneHeight: BG_DROP_ZONE_HEIGHT,
          groupHeaderHeight: GROUP_HEADER_HEIGHT,
        });
        const pos = layout.lineTops.get(line.id);
        if (pos) {
          const visibleTop = scrollContainer.scrollTop;
          const visibleBottom = visibleTop + scrollContainer.clientHeight;
          const rowBottom = pos.top + pos.height;
          const isRowVisible = pos.top >= visibleTop && rowBottom <= visibleBottom;

          if (!isRowVisible) {
            scrollContainer.scrollTo({ top: pos.top - WAVEFORM_HEIGHT, behavior: "instant" });
          }
        }

        const wordLeft = word.begin * zoom;
        const wordRight = word.end * zoom;
        const visibleLeft = scrollContainer.scrollLeft;
        const visibleRight = visibleLeft + scrollContainer.clientWidth - GUTTER_WIDTH;
        const isWordHorizontallyVisible = wordLeft >= visibleLeft && wordRight <= visibleRight;

        if (!isWordHorizontallyVisible) {
          toast("Word is off-screen", {
            action: {
              label: "Jump to word",
              onClick: () => {
                scrollContainer.scrollTo({
                  left: Math.max(0, wordLeft - 50),
                  behavior: "smooth",
                });
              },
            },
          });
        }
      }

      const updatedWords = [...wordsArray];

      if (edge === "begin") {
        const prevEnd = wordIndex > 0 ? wordsArray[wordIndex - 1].end : 0;
        const maxBegin = word.end - useSettingsStore.getState().minWordDuration;
        const clampedBegin = Math.max(prevEnd, Math.min(maxBegin, Math.max(0, currentTime)));
        updatedWords[wordIndex] = { ...word, begin: clampedBegin };
      } else {
        const minEnd = word.begin + useSettingsStore.getState().minWordDuration;
        const nextBegin = wordIndex < wordsArray.length - 1 ? wordsArray[wordIndex + 1].begin : duration;
        const clampedEnd = Math.min(nextBegin, Math.max(minEnd, Math.min(duration, currentTime)));
        updatedWords[wordIndex] = { ...word, end: clampedEnd };
      }

      const updateLineWithHistory = useProjectStore.getState().updateLineWithHistory;
      if (targetWord.type === "word") {
        updateLineWithHistory(line.id, { words: updatedWords });
      } else {
        updateLineWithHistory(line.id, { backgroundWords: updatedWords });
      }
    },
    [lines, duration, scrollContainerRef],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollContainerRef is a stable ref, .current should not be a dep
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (useProjectStore.getState().activeTab !== "timeline") return;
      if (isAnyModalOpen()) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        if (e.shiftKey) {
          useProjectStore.getState().redo();
        } else {
          useProjectStore.getState().undo();
        }
        return;
      }

      if (e.code === "KeyC" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        handleCopy();
        return;
      }

      if (e.code === "KeyX" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        handleCut();
        return;
      }

      if (e.code === "KeyV" && (e.metaKey || e.ctrlKey) && e.shiftKey && !e.repeat) {
        e.preventDefault();
        onOpenLyricsModal?.();
        return;
      }

      if (e.code === "KeyV" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        handlePaste();
        return;
      }

      if (e.code === "KeyA" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        const allSelections: WordSelection[] = [];
        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          for (let wi = 0; wi < (line.words?.length ?? 0); wi++)
            allSelections.push({ lineId: line.id, lineIndex: li, wordIndex: wi, type: "word" });
          for (let wi = 0; wi < (line.backgroundWords?.length ?? 0); wi++)
            allSelections.push({ lineId: line.id, lineIndex: li, wordIndex: wi, type: "bg" });
        }
        useTimelineStore.getState().setSelectedWords(allSelections);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedWords } = useTimelineStore.getState();
        if (selectedWords.length > 0) {
          e.preventDefault();
          handleDelete();
          return;
        }
      }

      if (e.key === "Escape") {
        const { pasteMode } = useTimelineStore.getState();
        if (pasteMode.status === "preview") {
          useTimelineStore.getState().setPasteMode({ status: "idle" });
        } else {
          useTimelineStore.getState().clearSelection();
        }
        return;
      }

      if (e.key === "F2") {
        const { selectedWords: eSel } = useTimelineStore.getState();
        if (eSel.length === 1) {
          e.preventDefault();
          useTimelineStore.getState().setEditingWord({
            lineId: eSel[0].lineId,
            wordIndex: eSel[0].wordIndex,
            type: eSel[0].type,
          });
        }
        return;
      }

      const matched = findMatchingShortcut(e, "timeline");
      if (!matched) return;

      switch (matched) {
        case "timeline.jumpToPlayhead": {
          e.preventDefault();
          const scrollContainer = scrollContainerRef.current;
          if (!scrollContainer) return;

          const audioEl = useAudioStore.getState().audioElement;
          const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
          const { zoom, rowHeights, defaultRowHeight } = useTimelineStore.getState();

          const viewportWidth = scrollContainer.clientWidth;
          scrollContainer.scrollLeft = Math.max(0, currentTime * zoom - viewportWidth / 2 + GUTTER_WIDTH);

          let activeLineIndex = -1;
          for (let i = 0; i < lines.length; i++) {
            const timing = getLineTiming(lines[i]);
            if (timing && currentTime >= timing.begin && currentTime < timing.end) {
              activeLineIndex = i;
              break;
            }
          }

          if (activeLineIndex >= 0) {
            const line = lines[activeLineIndex];
            const collapsedInstances = useTimelineStore.getState().collapsedInstances;
            const layout = computeRowLayout({
              lines,
              rowHeights,
              defaultRowHeight,
              collapsedInstances,
              waveformHeight: WAVEFORM_HEIGHT,
              bgDropZoneHeight: BG_DROP_ZONE_HEIGHT,
              groupHeaderHeight: GROUP_HEADER_HEIGHT,
            });
            const instanceKey =
              line.groupId !== undefined && line.instanceIdx !== undefined
                ? `${line.groupId}:${line.instanceIdx}`
                : null;
            const pos =
              instanceKey && collapsedInstances[instanceKey]
                ? layout.headerTops.get(instanceKey)
                : layout.lineTops.get(line.id);

            if (pos) {
              const viewportHeight = scrollContainer.clientHeight;
              const rowCenter = pos.top + pos.height / 2;
              const targetTop = Math.max(
                0,
                Math.min(scrollContainer.scrollHeight - viewportHeight, rowCenter - viewportHeight / 2),
              );
              scrollContainer.scrollTo({ top: targetTop, behavior: "instant" });
            }
          }
          break;
        }
        case "timeline.toggleFollow":
          useTimelineStore.getState().toggleFollow();
          break;
        case "timeline.togglePreview":
          useTimelineStore.getState().togglePreviewSidebar();
          break;
        case "timeline.setWordBegin":
          e.preventDefault();
          handleSetWordTiming("begin");
          break;
        case "timeline.setWordEnd":
          e.preventDefault();
          handleSetWordTiming("end");
          break;
        case "timeline.insertLineBelow":
        case "timeline.insertLineAbove": {
          const { selectedWords: nSel } = useTimelineStore.getState();
          if (nSel.length === 0) break;
          const lineIndex = nSel[0].lineIndex;
          const agents = useProjectStore.getState().agents;
          const defaultAgentId = agents[0]?.id ?? "v1";
          const newLine = { id: crypto.randomUUID(), text: "", agentId: defaultAgentId };
          const newLines = [...lines];
          const insertIndex = matched === "timeline.insertLineAbove" ? lineIndex : lineIndex + 1;
          newLines.splice(insertIndex, 0, newLine);
          useProjectStore.getState().setLinesWithHistory(newLines);
          break;
        }
        case "timeline.editWord": {
          const { selectedWords: eSel } = useTimelineStore.getState();
          if (eSel.length === 1) {
            e.preventDefault();
            useTimelineStore.getState().setEditingWord({
              lineId: eSel[0].lineId,
              wordIndex: eSel[0].wordIndex,
              type: eSel[0].type,
            });
          }
          break;
        }
        case "timeline.splitSyllable": {
          const { selectedWords: sSel } = useTimelineStore.getState();
          if (sSel.length === 1) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("timeline:split-syllable"));
          }
          break;
        }
        case "timeline.mergeWords": {
          const { selectedWords: mSel } = useTimelineStore.getState();
          if (mSel.length < 2) break;
          const first = mSel[0];
          if (!mSel.every((w) => w.lineId === first.lineId && w.type === first.type)) break;
          const sorted = [...mSel].sort((a, b) => a.wordIndex - b.wordIndex);
          let consecutive = true;
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].wordIndex !== sorted[i - 1].wordIndex + 1) {
              consecutive = false;
              break;
            }
          }
          if (!consecutive) break;
          const mLine = lines.find((l) => l.id === first.lineId);
          if (!mLine) break;
          const mWords = first.type === "word" ? mLine.words : mLine.backgroundWords;
          if (!mWords) break;
          let spaceFree = true;
          for (let i = 0; i < sorted.length - 1; i++) {
            if (mWords[sorted[i].wordIndex].text.endsWith(" ")) {
              spaceFree = false;
              break;
            }
          }
          if (!spaceFree) break;
          e.preventDefault();
          const firstIdx = sorted[0].wordIndex;
          const lastIdx = sorted[sorted.length - 1].wordIndex;
          const mergedText = sorted.map((s) => mWords[s.wordIndex].text).join("");
          const merged = { text: mergedText, begin: mWords[firstIdx].begin, end: mWords[lastIdx].end };
          const updatedWords = [...mWords.slice(0, firstIdx), merged, ...mWords.slice(lastIdx + 1)];
          const newText = updatedWords
            .map((w) => w.text)
            .join("")
            .trimEnd();
          if (first.type === "word") {
            void handleWordChangeWithDivergenceCheck(first.lineId, updatedWords, "words", { text: newText });
          } else {
            void handleWordChangeWithDivergenceCheck(first.lineId, updatedWords, "backgroundWords", {
              backgroundText: newText,
            });
          }
          useTimelineStore.getState().clearSelection();
          break;
        }
        case "timeline.splitIntoWords": {
          const { selectedWords: wSel } = useTimelineStore.getState();
          if (wSel.length === 0) break;
          e.preventDefault();

          const realLines = useProjectStore.getState().lines;
          const lineIds = new Set(wSel.map((w) => w.lineId));
          const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];

          for (const lineId of lineIds) {
            const realLine = realLines.find((l) => l.id === lineId);
            if (!realLine || !isLineSynced(realLine)) continue;
            const converted = convertLineToWord(realLine);
            if (converted.words) {
              updates.push({ id: lineId, updates: { words: converted.words, begin: undefined, end: undefined } });
            }
          }

          if (updates.length === 1) {
            useProjectStore.getState().updateLineWithHistory(updates[0].id, updates[0].updates);
          } else if (updates.length > 1) {
            useProjectStore.getState().updateLinesWithHistory(updates);
          }

          const newSelections: WordSelection[] = [];
          for (const u of updates) {
            const lineIndex = lines.findIndex((l) => l.id === u.id);
            if (lineIndex < 0 || !u.updates.words) continue;
            for (let wi = 0; wi < u.updates.words.length; wi++) {
              newSelections.push({ lineId: u.id, lineIndex, wordIndex: wi, type: "word" });
            }
          }
          if (newSelections.length > 0) {
            useTimelineStore.getState().setSelectedWords(newSelections);
          }
          break;
        }
        case "timeline.expandAll": {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("timeline:expand-all"));
          break;
        }
        case "timeline.createGroup": {
          e.preventDefault();
          const { selectedWords } = useTimelineStore.getState();
          const selectedLineIds = new Set(selectedWords.map((w) => w.lineId));
          if (selectedLineIds.size === 0) {
            toast.error("Select lines to group");
            break;
          }
          const projectState = useProjectStore.getState();
          const filled = fillSelectionGaps(projectState.lines, selectedLineIds);
          if (!filled) {
            toast.error("Some lines in this range are already part of a group");
            break;
          }
          const result = createGroupFromSelection(projectState.lines, filled.expanded, projectState.groups);
          if (!result) {
            toast.error("Could not create group from this selection");
            break;
          }
          projectState.addGroupWithLines(result.group, result.updatedLines);
          const totalCount = filled.expanded.size;
          const noun = totalCount === 1 ? "line" : "lines";
          toast.success(
            filled.addedCount > 0
              ? `Grouped ${totalCount} ${noun} (filled ${filled.addedCount} gap${filled.addedCount === 1 ? "" : "s"})`
              : `Grouped ${totalCount} ${noun}`,
          );
          break;
        }
        case "timeline.duplicateAsLinked": {
          e.preventDefault();
          const { selectedWords } = useTimelineStore.getState();
          const projectState = useProjectStore.getState();

          // Identify a single (groupId, instanceIdx) covered by the selection
          const groupKeys = new Set<string>();
          for (const w of selectedWords) {
            const line = projectState.lines.find((l) => l.id === w.lineId);
            if (line?.groupId !== undefined && line.instanceIdx !== undefined) {
              groupKeys.add(`${line.groupId}:${line.instanceIdx}`);
            }
          }
          if (groupKeys.size !== 1) {
            toast.error("Select all words of one linked instance to duplicate");
            break;
          }
          const [groupKey] = groupKeys;
          const [groupId, instanceIdxStr] = groupKey.split(":");
          const sourceInstanceIdx = Number.parseInt(instanceIdxStr, 10);

          const audioEl = useAudioStore.getState().audioElement;
          const playheadTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
          const template = instanceToTemplate(projectState.lines, groupId, sourceInstanceIdx);
          if (template.length === 0) {
            toast.error("Could not derive instance template");
            break;
          }
          const placement = decideAddInstancePlacement(projectState.lines, template, playheadTime);
          if (placement.kind === "insert") {
            projectState.addInstance(groupId, template, placement.instanceStart, placement.insertAtIndex);
            toast.success("Linked instance added at playhead");
          } else {
            copyInstanceToClipboardAndPreview(projectState.lines, groupId, sourceInstanceIdx);
            toast("No room at the playhead. Cmd+V to paste somewhere clear.");
          }
          break;
        }
        case "timeline.toggleCollapseInstance": {
          const inst = currentInstanceFromSelection(
            useProjectStore.getState().lines,
            useTimelineStore.getState().selectedWords,
          );
          if (!inst) {
            toast.error("Select words inside one instance first");
            break;
          }
          e.preventDefault();
          useTimelineStore.getState().toggleInstanceCollapsed(`${inst.groupId}:${inst.instanceIdx}`);
          break;
        }
        case "timeline.toggleAllCollapsed": {
          e.preventDefault();
          const { collapsedInstances, setInstanceCollapsed } = useTimelineStore.getState();
          const projectLines = useProjectStore.getState().lines;
          const keys = new Set<string>();
          for (const line of projectLines) {
            if (line.groupId !== undefined && line.instanceIdx !== undefined) {
              keys.add(`${line.groupId}:${line.instanceIdx}`);
            }
          }
          if (keys.size === 0) {
            toast.error("No groups in this project");
            break;
          }
          const anyExpanded = [...keys].some((k) => !collapsedInstances[k]);
          for (const k of keys) setInstanceCollapsed(k, anyExpanded);
          break;
        }
        case "timeline.jumpPrevInstance":
        case "timeline.jumpNextInstance": {
          const projectLines = useProjectStore.getState().lines;
          const inst = currentInstanceFromSelection(projectLines, useTimelineStore.getState().selectedWords);
          if (!inst) {
            toast.error("Select words inside one instance first");
            break;
          }
          const all = listInstancesOfGroup(projectLines, inst.groupId);
          if (all.length < 2) {
            toast.error("This group has only one instance");
            break;
          }
          const here = all.indexOf(inst.instanceIdx);
          const dir = matched === "timeline.jumpNextInstance" ? 1 : -1;
          const nextIdx = all[(here + dir + all.length) % all.length];
          e.preventDefault();
          useTimelineStore.getState().setSelectedWords(getWordsInInstance(projectLines, inst.groupId, nextIdx));
          scrollToInstanceHeader(inst.groupId, nextIdx);
          break;
        }
        case "timeline.detachInstance": {
          const inst = currentInstanceFromSelection(
            useProjectStore.getState().lines,
            useTimelineStore.getState().selectedWords,
          );
          if (!inst) {
            toast.error("Select words inside one instance first");
            break;
          }
          e.preventDefault();
          useProjectStore.getState().removeInstance(inst.groupId, inst.instanceIdx);
          showGroupActionToast("Instance detached");
          break;
        }
        case "timeline.deleteGroup": {
          const projectLines = useProjectStore.getState().lines;
          const inst = currentInstanceFromSelection(projectLines, useTimelineStore.getState().selectedWords);
          if (!inst) {
            toast.error("Select words inside one instance first");
            break;
          }
          const group = useProjectStore.getState().groups.find((g) => g.id === inst.groupId);
          if (!group) break;
          e.preventDefault();
          const instanceCount = listInstancesOfGroup(projectLines, inst.groupId).length;
          (async () => {
            const ok = await useConfirmStore.getState().open({
              title: `Delete the "${group.label}" group?`,
              description: `All ${instanceCount} instance${instanceCount === 1 ? "" : "s"} will become standalone lines. They keep their text and timing, but stop updating together.`,
              confirmLabel: "Delete group",
              variant: "destructive",
              settingsKey: "confirmGroupDissolution",
              recoverable: true,
            });
            if (!ok) return;
            useProjectStore.getState().removeGroup(inst.groupId);
            showGroupActionToast("Group deleted");
          })();
          break;
        }
        case "timeline.pingSiblings": {
          const inst = currentInstanceFromSelection(
            useProjectStore.getState().lines,
            useTimelineStore.getState().selectedWords,
          );
          if (!inst) {
            toast.error("Select words inside one instance first");
            break;
          }
          e.preventDefault();
          useTimelineStore.getState().setPingingGroupId(inst.groupId);
          window.setTimeout(() => {
            if (useTimelineStore.getState().pingingGroupId === inst.groupId) {
              useTimelineStore.getState().setPingingGroupId(null);
            }
          }, 700);
          break;
        }
        case "timeline.nudgeLeft":
        case "timeline.nudgeRight": {
          const { selectedWords: nudgeSel } = useTimelineStore.getState();
          if (nudgeSel.length === 0) break;
          e.preventDefault();
          const nudgeAmount = useSettingsStore.getState().nudgeAmount;
          const requestedDelta = matched === "timeline.nudgeLeft" ? -nudgeAmount : nudgeAmount;
          const rawLines = useProjectStore.getState().lines;
          const partitioned = partitionNudgeSelections(rawLines, nudgeSel);
          const result = shiftSelectionsTogether(rawLines, partitioned, requestedDelta, duration);
          if (result.updates.length === 0) break;
          if (result.updates.length === 1) {
            useProjectStore.getState().updateLineWithHistory(result.updates[0].id, result.updates[0].updates);
          } else {
            useProjectStore.getState().updateLinesWithHistory(result.updates);
          }
          break;
        }
        case "timeline.jumpToInstanceStart": {
          const projectLines = useProjectStore.getState().lines;
          const inst = currentInstanceFromSelection(projectLines, useTimelineStore.getState().selectedWords);
          if (!inst) {
            toast.error("Select words inside one instance first");
            break;
          }
          e.preventDefault();
          scrollToInstanceHeader(inst.groupId, inst.instanceIdx);
          break;
        }
        case "timeline.shiftInstanceToPlayhead": {
          const projectLines = useProjectStore.getState().lines;
          const inst = currentInstanceFromSelection(projectLines, useTimelineStore.getState().selectedWords);
          if (!inst) {
            toast.error("Select words inside one instance first");
            break;
          }
          const instanceLines = projectLines.filter(
            (l) => l.groupId === inst.groupId && l.instanceIdx === inst.instanceIdx,
          );
          const { start: earliest } = instanceTimingBounds(instanceLines);
          if (!Number.isFinite(earliest)) break;
          const audioEl = useAudioStore.getState().audioElement;
          const playheadTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
          const delta = playheadTime - earliest;
          if (Math.abs(delta) < 0.001) break;
          e.preventDefault();
          useProjectStore.getState().shiftInstance(inst.groupId, inst.instanceIdx, delta);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSetWordTiming, handleCopy, handleCut, handlePaste, handleDelete, onOpenLyricsModal, lines]);
}

// -- Exports -------------------------------------------------------------------

export { useTimelineKeyboard };
