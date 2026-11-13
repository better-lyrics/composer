import { addInstance, removeInstance, shiftInstance } from "@/domain/commands/instance-edits";
import { addGroupWithLines } from "@/domain/commands/group-edits";
import { type RefObject, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { type NudgeReport, nudgeSelection, setWordBoundary } from "@/domain/commands/word-timing";
import { fillInstanceRows } from "@/domain/commands/instance-rows";
import { pickedTemplateSource } from "@/domain/group/template-source";
import { instanceBounds } from "@/domain/instance/bounds";
import { instanceCount, linesOfInstance } from "@/domain/instance/enumerate";
import { instanceKey, parseInstanceKey } from "@/domain/instance/key";
import { isLinked } from "@/domain/instance/predicates";
import { currentInstanceFromSelection } from "@/domain/instance/selection-instance";
import { effectiveBounds } from "@/domain/line/bounds";
import type { ReadableLine } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { trackWords } from "@/domain/line/tracks";
import { lineWordSelections } from "@/domain/selection/line-selections";
import { resolveAddress, toAddress } from "@/domain/selection/resolve";
import { normalizeTimes, snapPointTimes } from "@/domain/snap-point/model";
import { noteGuideSignal } from "@/lib/guide-signals";
import { notePlacement } from "@/lib/replay-cue";
import { useAudioStore } from "@/stores/audio";
import { isAnyModalOpen } from "@/stores/escape-layer-stack";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { showGroupActionToast, showGroupedToast, showSharedSongEdgeToast } from "@/utils/group-toast";
import { historyShortcutAction } from "@/utils/history-shortcut";
import { showSelectionRefusal } from "@/utils/selection-refusal-toast";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { focusedControlOwnsKey, isTypingTarget } from "@/utils/typing-target";
import { centreLineRow } from "@/views/timeline/centre-line-row";
import { centerTimeScrollLeft } from "@/views/timeline/coords";
import { copyInstanceToClipboardAndPreview } from "@/views/timeline/copy-instance-to-clipboard";
import { decideAddInstancePlacement } from "@/views/timeline/decide-add-instance-placement";
import { deleteGroupWithConfirm } from "@/views/timeline/delete-group-with-confirm";
import { deleteSelectedWords } from "@/views/timeline/delete-selected-words";
import { currentEffectiveFocus, scrollToFocusStart } from "@/views/timeline/effective-focus";
import { isInFocus } from "@/views/timeline/group-focus";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { createGroupFromSelection, fillSelectionGaps, instanceToTemplate } from "@/views/timeline/group-ops";
import { insertEmptyLine } from "@/views/timeline/insert-empty-line";
import {
  jumpToAdjacentBar,
  jumpToAdjacentGridLine,
  NO_BEAT_GRID_MESSAGE,
  toastUnlessRepeat,
} from "@/views/timeline/jump-to-bar";
import { jumpToAdjacentInstance } from "@/views/timeline/jump-to-instance";
import { showLoupeAfterKeyEdit, storedEdgeTime } from "@/views/timeline/loupe/loupe-target";
import { currentOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { pingGroup } from "@/views/timeline/ping-group";
import { togglePitchLine } from "@/views/timeline/pitch/pitch-line-toggle";
import { playheadTime } from "@/views/timeline/playhead-time";
import { scrollToInstanceHeader } from "@/views/timeline/scroll-helpers";
import { clearLoopRegion, playSelection } from "@/views/timeline/selection-playback";
import { adjacentSnapPoint } from "@/views/timeline/snap-marker-math";
import { splitLinesIntoWords } from "@/views/timeline/split-lines-into-words";
import { escapeStepTiming, pressStepShortcut } from "@/views/timeline/step-timing/press-step-key";
import { AUTO_ALIGN_EVENT } from "@/views/timeline/timeline-auto-align";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineClipboard } from "@/views/timeline/use-timeline-clipboard";
import { computeRowLayout } from "@/views/timeline/utils";
import { readViewScroll, scrollView, smoothScrollView } from "@/views/timeline/view-scroll";
import { findBoundaryTarget, findWordsAtTime, pickNextWordAtPlayhead } from "@/views/timeline/word-at-playhead";
import {
  explicitToggleTarget,
  runExplicitToggle,
  runSyllableMerge,
  runWordMerge,
  singleSelectedWord,
  syllableMergeTarget,
  wordMergeTarget,
} from "@/views/timeline/word-commands";

// -- Hook ----------------------------------------------------------------------

function useTimelineKeyboard(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  lines: ReadableLine[],
  duration: number,
  onOpenLyricsModal?: () => void,
) {
  const { handleCopy, handleCut, handlePaste } = useTimelineClipboard(lines);

  const handleSetWordTiming = useCallback(
    (edge: "begin" | "end") => {
      const currentTime = playheadTime();

      const { selectedWords, zoom, rowHeights, defaultRowHeight } = useTimelineStore.getState();
      const selectedWord = selectedWords[0] ? resolveAddress(lines, selectedWords[0]) : null;
      const fromPlayhead = !selectedWord;
      const targetWord = selectedWord ?? findBoundaryTarget(lines, currentTime, edge, currentEffectiveFocus());
      if (!targetWord) {
        toast(edge === "begin" ? "No word starts after the playhead" : "No word ends before the playhead");
        return;
      }

      const line = lines[targetWord.lineIndex];
      if (!line) return;

      const wordsArray = trackWords(line, targetWord.type);
      if (!wordsArray) return;

      const wordIndex = targetWord.wordIndex;
      const word = wordsArray[wordIndex];
      if (!word) return;

      const scrollContainer = scrollContainerRef.current;

      if (fromPlayhead && scrollContainer) {
        const { collapsedInstances, focusedGroup } = useTimelineStore.getState();
        const layout = computeRowLayout({
          lines,
          rowHeights,
          defaultRowHeight,
          collapsedInstances,
          focusedGroup,
          waveformHeight: currentOverviewBandHeight(),
          groupHeaderHeight: GROUP_HEADER_HEIGHT,
        });
        const pos = layout.lineTops.get(line.id);
        if (pos) {
          const visibleTop = readViewScroll(scrollContainer).top;
          const visibleBottom = visibleTop + scrollContainer.clientHeight;
          const rowBottom = pos.top + pos.height;
          const isRowVisible = pos.top >= visibleTop && rowBottom <= visibleBottom;

          if (!isRowVisible) {
            scrollView(scrollContainer, null, pos.top - currentOverviewBandHeight());
          }
        }

        const wordLeft = word.begin * zoom;
        const wordRight = word.end * zoom;
        const visibleLeft = readViewScroll(scrollContainer).left;
        const visibleRight = visibleLeft + scrollContainer.clientWidth - GUTTER_WIDTH;
        const isWordHorizontallyVisible = wordLeft >= visibleLeft && wordRight <= visibleRight;

        if (!isWordHorizontallyVisible) {
          toast("Word is off-screen", {
            action: {
              label: "Jump to word",
              onClick: () => {
                smoothScrollView(scrollContainer, Math.max(0, wordLeft - 50));
              },
            },
          });
        }
      }

      const settings = useSettingsStore.getState();
      useProjectStore.getState().commit(
        setWordBoundary({
          address: toAddress(targetWord),
          edge,
          time: currentTime,
          minDuration: settings.minWordDuration,
          rolling: settings.rollingEdit,
          syllablesFollowRolling: settings.syllablesFollowRolling,
          duration,
        }),
      );
      noteGuideSignal("timeline.resize");
      showLoupeAfterKeyEdit(targetWord, edge, word[edge]);
    },
    [lines, duration, scrollContainerRef],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollContainerRef is a stable ref, .current should not be a dep
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (useProjectStore.getState().activeTab !== "timeline") return;
      if (isAnyModalOpen()) return;
      if (isTypingTarget(e.target) || focusedControlOwnsKey(e)) return;

      const historyAction = historyShortcutAction(e, { scope: "timeline" });
      if (historyAction) {
        e.preventDefault();
        if (e.repeat) return;
        const undoes = historyAction === "undo" && useProjectStore.getState().canUndo();
        useProjectStore.getState()[historyAction]();
        if (undoes) noteGuideSignal("timeline.undo");
        return;
      }

      const matched = findMatchingShortcut(e, "timeline");
      const claimedByUser = matched !== null && useShortcutBindingsStore.getState().overrides[matched] !== undefined;
      if (matched === "timeline.importLyrics") {
        e.preventDefault();
        onOpenLyricsModal?.();
        return;
      }

      if (!claimedByUser) {
        if (e.code === "KeyA" && (e.metaKey || e.ctrlKey) && !e.repeat) {
          e.preventDefault();
          const focus = currentEffectiveFocus();
          const inFocus = lines.filter((line) => isInFocus(line, focus));
          useTimelineStore.getState().setSelectedWords(inFocus.flatMap(lineWordSelections));
          return;
        }

        if (e.key === "Escape") {
          // A modal or panel that closed on this Escape already used it.
          if (e.defaultPrevented) return;
          const { pasteMode } = useTimelineStore.getState();
          if (pasteMode.status === "preview") {
            useTimelineStore.getState().setPasteMode({ status: "idle" });
          } else if (!escapeStepTiming()) {
            clearLoopRegion();
            useTimelineStore.getState().clearSelection();
          }
          return;
        }

        if (e.key === "F2") {
          const { selectedWords: eSel } = useTimelineStore.getState();
          if (eSel.length === 1) {
            e.preventDefault();
            useTimelineStore.getState().setEditingWord(eSel[0]);
            noteGuideSignal("timeline.editTextDirect");
          }
          return;
        }
      }

      if (!matched) return;

      switch (matched) {
        case "timeline.deleteSelection":
        case "timeline.deleteSelectionAlternate": {
          const { hoveredSnapPointId, selectedWords } = useTimelineStore.getState();
          if (hoveredSnapPointId !== null) {
            e.preventDefault();
            useProjectStore.getState().removeCustomSnapPoint(hoveredSnapPointId);
            useTimelineStore.getState().setHoveredSnapPointId(null);
          } else if (selectedWords.length > 0) {
            e.preventDefault();
            deleteSelectedWords();
            noteGuideSignal("timeline.deleteKey");
          }
          return;
        }
        case "timeline.jumpToPlayhead": {
          e.preventDefault();
          const scrollContainer = scrollContainerRef.current;
          if (!scrollContainer) return;

          const currentTime = playheadTime();
          const { zoom } = useTimelineStore.getState();

          scrollView(scrollContainer, centerTimeScrollLeft(currentTime, zoom, scrollContainer.clientWidth));

          const activeLine = lines.find((line) => {
            const timing = effectiveBounds(line);
            return timing !== null && currentTime >= timing.begin && currentTime < timing.end;
          });
          if (activeLine) centreLineRow(scrollContainer, lines, activeLine);
          break;
        }
        case "timeline.selectWordAtPlayhead": {
          e.preventDefault();
          const currentTime = playheadTime();
          const matches = findWordsAtTime(lines, currentTime, currentEffectiveFocus());
          const next = pickNextWordAtPlayhead(matches, useTimelineStore.getState().selectedWords);
          if (!next) {
            toast("No word under the playhead");
            break;
          }
          useTimelineStore.getState().setSelectedWords([next]);
          noteGuideSignal("timeline.atPlayhead");
          break;
        }
        case "timeline.playSelection":
          if (!playSelection()) break;
          e.preventDefault();
          noteGuideSignal("timeline.play");
          noteGuideSignal("timeline.playSelectionKey");
          break;
        case "timeline.toggleFollow":
          useSettingsStore.getState().toggle("followPlayhead");
          break;
        case "timeline.togglePreview":
          useSettingsStore.getState().toggle("previewSidebar");
          if (useSettingsStore.getState().previewSidebar) noteGuideSignal("preview.sidebar");
          break;
        case "timeline.copy":
          e.preventDefault();
          handleCopy();
          break;
        case "timeline.cut":
          e.preventDefault();
          handleCut();
          break;
        case "timeline.paste":
          e.preventDefault();
          handlePaste();
          break;
        case "timeline.toggleSnap":
          useSettingsStore.getState().toggle("timelineSnap");
          noteGuideSignal("timeline.snapToggle");
          break;
        case "timeline.toggleBeatGrid": {
          if (!useProjectStore.getState().beatGrid) {
            toast(NO_BEAT_GRID_MESSAGE);
            break;
          }
          useSettingsStore.getState().toggle("beatGridVisible");
          if (useSettingsStore.getState().beatGridVisible) noteGuideSignal("timeline.beats");
          break;
        }
        case "timeline.toggleSpectrum":
          useSettingsStore.getState().toggle("showSpectrum");
          if (useSettingsStore.getState().showSpectrum) noteGuideSignal("timeline.spectrum");
          break;
        case "timeline.autoAlign":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent(AUTO_ALIGN_EVENT));
          break;
        case "timeline.togglePitchLine":
          togglePitchLine();
          break;
        case "timeline.toggleRollingEdit":
          useSettingsStore.getState().toggle("rollingEdit");
          break;
        case "timeline.toggleMarkerMode":
          e.preventDefault();
          useTimelineStore.getState().toggleMarkerMode();
          break;
        case "timeline.dropSnapMarkerAtPlayhead": {
          e.preventDefault();
          const playheadAt = playheadTime();
          useProjectStore.getState().addCustomSnapPoint(playheadAt);
          noteGuideSignal("timeline.markers");
          break;
        }
        case "timeline.toggleTextVariant":
          useTimelineStore.getState().toggleTextVariant();
          break;
        case "timeline.setWordBegin":
        case "timeline.setWordEnd":
        case "timeline.stepWord":
        case "timeline.stepTimingOff":
          e.preventDefault();
          if (pressStepShortcut(matched, lines, duration)) break;
          handleSetWordTiming(matched === "timeline.setWordBegin" ? "begin" : "end");
          break;
        case "timeline.insertLineBelow":
        case "timeline.insertLineAbove": {
          const { selectedWords: nSel } = useTimelineStore.getState();
          if (nSel.length === 0) break;
          const position = matched === "timeline.insertLineAbove" ? "above" : "below";
          insertEmptyLine(nSel[0].lineId, position);
          break;
        }
        case "timeline.editWord": {
          const { selectedWords } = useTimelineStore.getState();
          const editable = singleSelectedWord(selectedWords);
          if (!editable) {
            showSelectionRefusal("editText", selectedWords);
            break;
          }
          e.preventDefault();
          useTimelineStore.getState().setEditingWord(editable);
          noteGuideSignal("timeline.editTextDirect");
          break;
        }
        case "timeline.splitSyllable":
        case "timeline.splitWord": {
          const { selectedWords } = useTimelineStore.getState();
          if (!singleSelectedWord(selectedWords)) {
            showSelectionRefusal("split", selectedWords);
            break;
          }
          e.preventDefault();
          const eventName = matched === "timeline.splitWord" ? "timeline:split-word" : "timeline:split-syllable";
          window.dispatchEvent(new CustomEvent(eventName));
          break;
        }
        case "timeline.mergeWords": {
          const { selectedWords } = useTimelineStore.getState();
          const merge = wordMergeTarget(selectedWords, useProjectStore.getState().lines);
          if (!merge) {
            showSelectionRefusal("mergeWords", selectedWords);
            break;
          }
          e.preventDefault();
          runWordMerge(merge);
          break;
        }
        case "timeline.mergeSyllablesIntoWord": {
          const { selectedWords } = useTimelineStore.getState();
          const merge = syllableMergeTarget(selectedWords, useProjectStore.getState().lines);
          if (!merge) {
            showSelectionRefusal("joinSyllables", selectedWords);
            break;
          }
          e.preventDefault();
          runSyllableMerge(merge);
          break;
        }
        case "timeline.splitIntoWords": {
          const { selectedWords: wSel } = useTimelineStore.getState();
          if (wSel.length === 0) break;
          e.preventDefault();
          splitLinesIntoWords(wSel, lines);
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
          const result = createGroupFromSelection(
            projectState.lines,
            filled.expanded,
            projectState.groups,
            useSettingsStore.getState().shareTimingInNewGroups,
            { duration: useAudioStore.getState().duration },
          );
          if (!result) {
            toast.error("Could not create group from this selection");
            break;
          }
          projectState.commit(addGroupWithLines(result.group, result.updatedLines));
          noteGuideSignal("edit.group");
          showGroupedToast(result.group, filled.expanded.size, filled.addedCount);
          break;
        }
        case "timeline.duplicateAsLinked": {
          e.preventDefault();
          const { selectedWords } = useTimelineStore.getState();
          const projectState = useProjectStore.getState();

          const linesById = new Map<string, LyricLine>();
          for (const l of projectState.lines) linesById.set(l.id, l);
          const groupKeys = new Set<string>();
          for (const w of selectedWords) {
            const line = linesById.get(w.lineId);
            if (line && isLinked(line)) {
              groupKeys.add(instanceKey(line.groupId, line.instanceIdx));
            }
          }
          if (groupKeys.size !== 1) {
            toast.error("Select all words of one linked instance to duplicate");
            break;
          }
          const [groupKey] = groupKeys;
          const { groupId, instanceIdx: sourceInstanceIdx } = parseInstanceKey(groupKey);

          const playheadAt = playheadTime();
          const group = projectState.groups.find((candidate) => candidate.id === groupId);
          const template = instanceToTemplate(
            projectState.lines,
            groupId,
            pickedTemplateSource(projectState.lines, group, sourceInstanceIdx),
          );
          if (template.length === 0) {
            toast.error("Could not derive instance template");
            break;
          }
          const placement = decideAddInstancePlacement({
            lines: projectState.lines,
            groupId,
            template,
            playheadTime: playheadAt,
          });
          if (placement.kind === "fill") {
            projectState.commit(fillInstanceRows(groupId, placement.instanceIdx, placement.updatedLines));
            toast.success("Linked instance placed in empty rows");
          } else if (placement.kind === "insert") {
            projectState.commit(addInstance(groupId, template, placement.instanceStart, placement.insertAtIndex));
            toast.success("Linked instance added at playhead");
          } else {
            copyInstanceToClipboardAndPreview(projectState.lines, groupId, sourceInstanceIdx);
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
          useTimelineStore.getState().toggleInstanceCollapsed(instanceKey(inst.groupId, inst.instanceIdx));
          break;
        }
        case "timeline.toggleAllCollapsed": {
          e.preventDefault();
          const { collapsedInstances, setInstanceCollapsed } = useTimelineStore.getState();
          const projectLines = useProjectStore.getState().lines;
          const keys = new Set<string>();
          for (const line of projectLines) {
            if (isLinked(line)) {
              keys.add(instanceKey(line.groupId, line.instanceIdx));
            }
          }
          if (keys.size === 0) {
            toast.error("No groups in this project");
            break;
          }
          const anyExpanded = [...keys].some((k) => !collapsedInstances[k]);
          for (const k of keys) setInstanceCollapsed(k, anyExpanded);
          noteGuideSignal("timeline.collapseAll");
          break;
        }
        case "timeline.jumpPrevInstance":
        case "timeline.jumpNextInstance": {
          const projectLines = useProjectStore.getState().lines;
          const focus = currentEffectiveFocus();
          const inst = focus
            ? { groupId: focus.groupId, instanceIdx: focus.hearInstanceIdx }
            : currentInstanceFromSelection(projectLines, useTimelineStore.getState().selectedWords);
          if (!inst) {
            toastUnlessRepeat("Select words inside one instance first", e.repeat, toast.error);
            break;
          }
          if (instanceCount(projectLines, inst.groupId) < 2) {
            toastUnlessRepeat("This group has only one instance", e.repeat, toast.error);
            break;
          }
          e.preventDefault();
          jumpToAdjacentInstance(inst.groupId, inst.instanceIdx, matched === "timeline.jumpNextInstance" ? 1 : -1);
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
          useProjectStore.getState().commit(removeInstance(inst.groupId, inst.instanceIdx));
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
          const count = instanceCount(projectLines, inst.groupId);
          void deleteGroupWithConfirm({ groupId: inst.groupId, groupLabel: group.label, instanceCount: count });
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
          pingGroup(inst.groupId);
          break;
        }
        case "timeline.nudgeLeft":
        case "timeline.nudgeRight": {
          const { selectedWords: nudgeSel } = useTimelineStore.getState();
          if (nudgeSel.length === 0) break;
          e.preventDefault();
          const nudgeAmount = useSettingsStore.getState().nudgeAmount;
          const requestedDelta = matched === "timeline.nudgeLeft" ? -nudgeAmount : nudgeAmount;
          const nudgedFrom = storedEdgeTime(nudgeSel[0], "begin");
          let nudge = null as NudgeReport | null;
          useProjectStore
            .getState()
            .commit(nudgeSelection(nudgeSel, requestedDelta, duration, (reported) => (nudge = reported)));
          if (nudge?.sharedCopyLimited) showSharedSongEdgeToast();
          if (!nudge?.moved) break;
          noteGuideSignal("timeline.nudge");
          if (nudgedFrom !== null) showLoupeAfterKeyEdit(nudgeSel[0], "begin", nudgedFrom);
          break;
        }
        case "timeline.jumpToInstanceStart": {
          const focusScrollContainer = scrollContainerRef.current;
          if (currentEffectiveFocus() && focusScrollContainer) {
            e.preventDefault();
            scrollToFocusStart(focusScrollContainer);
            break;
          }
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
        case "timeline.toggleExplicit": {
          const toggle = explicitToggleTarget(
            useTimelineStore.getState().selectedWords,
            useProjectStore.getState().lines,
          );
          if (!toggle) break;
          e.preventDefault();
          runExplicitToggle(toggle);
          break;
        }
        case "timeline.shiftInstanceToPlayhead": {
          const projectLines = useProjectStore.getState().lines;
          const inst = currentInstanceFromSelection(projectLines, useTimelineStore.getState().selectedWords);
          if (!inst) {
            toast.error("Select words inside one instance first");
            break;
          }
          const instanceLines = linesOfInstance(projectLines, inst.groupId, inst.instanceIdx);
          const bounds = instanceBounds(instanceLines);
          if (!bounds) break;
          const playheadAt = playheadTime();
          const delta = playheadAt - bounds.begin;
          if (Math.abs(delta) < 0.001) break;
          e.preventDefault();
          useProjectStore
            .getState()
            .commit(shiftInstance(inst.groupId, inst.instanceIdx, delta, useAudioStore.getState().duration));
          break;
        }
        case "timeline.jumpPrevBar":
        case "timeline.jumpNextBar":
          e.preventDefault();
          jumpToAdjacentBar(matched === "timeline.jumpNextBar" ? 1 : -1, e.repeat);
          break;
        case "timeline.jumpPrevGridLine":
        case "timeline.jumpNextGridLine":
          e.preventDefault();
          jumpToAdjacentGridLine(matched === "timeline.jumpNextGridLine" ? 1 : -1, e.repeat);
          break;
        case "timeline.jumpPrevSnapPoint":
        case "timeline.jumpNextSnapPoint":
        case "timeline.jumpPrevSnapPointFine":
        case "timeline.jumpNextSnapPointFine": {
          e.preventDefault();
          const dir: 1 | -1 = matched.includes("Next") ? 1 : -1;
          const fine = matched.includes("Fine");
          const current = playheadTime();
          const pins = useProjectStore.getState().customSnapPoints;
          const onsets = fine ? useTimelineStore.getState().vocalOnsetSnapPoints : [];
          const points = normalizeTimes([...snapPointTimes(pins), ...onsets]);
          const target = adjacentSnapPoint(points, current, dir);
          if (target === null) {
            if (!e.repeat) toast(fine ? "No snap point or onset that way" : "No snap point that way");
            break;
          }
          useAudioStore.getState().seekTo(target);
          notePlacement(target, "keyboard");
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSetWordTiming, handleCopy, handleCut, handlePaste, onOpenLyricsModal, lines, duration, scrollContainerRef]);
}

// -- Exports -------------------------------------------------------------------

export { useTimelineKeyboard };
