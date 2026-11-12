import { timeRangeResolver } from "@/domain/group/shared-timing";
import { effectiveTrackWords, type ReadableLine } from "@/domain/line/effective-words";
import type { WordSelection } from "@/domain/selection/model";
import { nextCursorSlot, nextStepSlot } from "@/domain/step-timing/step-cursor";
import { chainedNext } from "@/domain/step-timing/step-queue";
import type { StepKey, StepRefusal } from "@/domain/step-timing/step-write";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { writeStepKey } from "@/utils/timing/step-key-write";
import { toast } from "@/utils/toast";
import { currentEffectiveFocus } from "@/views/timeline/effective-focus";
import { isInFocus } from "@/views/timeline/group-focus";
import { playheadTime } from "@/views/timeline/playhead-time";
import { clearLoopRegion } from "@/views/timeline/selection-playback";
import { isWholeLane, liveStepSelection } from "@/views/timeline/step-timing/step-selection";
import { stepSkipView } from "@/views/timeline/step-timing/step-skip-view";
import { rememberStepPress } from "@/views/timeline/step-timing/step-undo";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { findBoundaryTarget } from "@/views/timeline/word-at-playhead";

// -- Helpers ------------------------------------------------------------------

function refusalMessage(refusal: StepRefusal): string {
  if (refusal.reason === "beforePrevious") {
    const word = refusal.previousWord.trim();
    return `This time is before “${word}” ends. Click “${word}” to retime it.`;
  }
  if (refusal.reason === "songStart") return "This word can't start before the song does.";
  return "There is no room for the words after this one before the song ends.";
}

// The toast's Undo stays only while the press is still the latest step, so it never undoes a later edit.
function showEndedPreviousToast(previousWord: string): void {
  const { history, historyIndex } = useProjectStore.getState();
  const press = history[historyIndex];
  const isLatest = (state: { history: readonly unknown[]; historyIndex: number }) =>
    state.history[state.historyIndex] === press;
  const undoPress = () => {
    const project = useProjectStore.getState();
    if (isLatest(project)) project.undo();
  };
  const stopFollowing = () => unsubscribe();
  const toastId = toast(`“${previousWord.trim()}” now ends here too.`, {
    action: { label: "Undo", onClick: undoPress },
    onDismiss: stopFollowing,
    onAutoClose: stopFollowing,
  });
  const unsubscribe = useProjectStore.subscribe((state) => {
    if (isLatest(state)) return;
    unsubscribe();
    toast.dismiss(toastId);
  });
}

// -- Functions ----------------------------------------------------------------

function pressStepKey(key: StepKey, lines: ReadableLine[], duration: number): void {
  const time = playheadTime();
  const focus = currentEffectiveFocus();
  const timeline = useTimelineStore.getState();
  const live = liveStepSelection(lines, timeline.selectedWords, timeline.stepQueue);
  const cursor = live.cursor ?? findBoundaryTarget(lines, time, key === "start" ? "begin" : "end", focus, true);
  if (!cursor) {
    toast(key === "start" ? "No word starts after this point" : "No word ends before this point");
    return;
  }
  const line = lines[cursor.lineIndex];
  const word = line ? effectiveTrackWords(line, cursor.type)?.[cursor.wordIndex] : undefined;
  if (!line || !word) return;
  const project = useProjectStore.getState();
  const { skippedLineIds } = stepSkipView(lines, project.groups, timeline.collapsedInstances, line);
  const include = (candidate: ReadableLine) => isInFocus(candidate, focus) && !skippedLineIds.has(candidate.id);
  const rangeOf = timeRangeResolver(project.lines, project.groups, duration);
  const queue = live.cursor ? live.queue : null;
  if (queue && timeline.stepQueue && queue.length !== timeline.stepQueue.length) timeline.setSelectedWords(queue, true);
  const next =
    key === "start"
      ? null
      : nextCursorSlot(lines, cursor, queue, include, useSettingsStore.getState().stepTimingBackground);
  const startNext = key === "step" ? chainedNext(cursor, next, nextStepSlot(lines, cursor, include)) : null;
  const outcome = writeStepKey({
    lines,
    groups: project.groups,
    cursor,
    startNext,
    key,
    time,
    minDuration: useSettingsStore.getState().minWordDuration,
    rangeOf,
    updateLinesWithHistory: project.updateLinesWithHistory,
  });
  if (outcome?.kind === "refused") {
    toast(refusalMessage(outcome.refusal));
    timeline.setSelectedWords([cursor]);
    return;
  }
  if (outcome?.endedPrevious) showEndedPreviousToast(outcome.endedPrevious);
  noteGuideSignal("timeline.stepTiming");
  const leftLine = cursor.type === "word" && next?.lineId !== cursor.lineId;
  if (leftLine && effectiveTrackWords(line, "bg")?.length) noteGuideSignal("timeline.stepPastBackground");
  if (queue && key !== "start" && !next) noteGuideSignal("timeline.stepQueueEnd");
  // The queue outlives its last word, so the keys never leave the chosen words.
  timeline.setSelectedWords([next ?? cursor]);
  rememberStepPress({ selectedWords: [cursor], stepQueue: queue });
}

function setStepTimingMode(on: boolean): void {
  useTimelineStore.getState().setStepTiming(on);
  if (on) noteGuideSignal("timeline.stepTimingOn");
}

// Returns false for a timing key outside Step timing, which then sets the word under the playhead as usual.
function pressStepShortcut(id: string, lines: ReadableLine[], duration: number): boolean {
  const { stepTiming } = useTimelineStore.getState();
  if (id === "timeline.stepTimingOff") setStepTimingMode(!stepTiming);
  else if (id === "timeline.stepWord" && !stepTiming) noteGuideSignal("timeline.stepKeyWhileOff");
  else if (!stepTiming) return false;
  else
    pressStepKey(
      id === "timeline.stepWord" ? "step" : id === "timeline.setWordBegin" ? "start" : "end",
      lines,
      duration,
    );
  return true;
}

// In Step timing, Escape clears a loop, then the selection, then leaves the mode. Returns false outside it.
function escapeStepTiming(): boolean {
  const { stepTiming, loopRegion, selectedWords, clearSelection, setStepTiming } = useTimelineStore.getState();
  if (!stepTiming) return false;
  if (loopRegion) clearLoopRegion();
  else if (selectedWords.length > 0) clearSelection();
  else setStepTiming(false);
  return true;
}

function toggleStepLane(lineId: string, lineIndex: number, type: WordSelection["type"], wordCount: number): void {
  const lane = Array.from({ length: wordCount }, (_, wordIndex) => ({ lineId, lineIndex, wordIndex, type }));
  const { stepQueue, selectedWords, setSelectedWords } = useTimelineStore.getState();
  const clearing = isWholeLane(stepQueue ?? selectedWords, lane);
  setSelectedWords(clearing ? [] : lane, true);
  if (!clearing && lane.length > 1) noteGuideSignal("timeline.stepLane");
}

// -- Exports ------------------------------------------------------------------

export { escapeStepTiming, pressStepShortcut, setStepTimingMode, toggleStepLane };
