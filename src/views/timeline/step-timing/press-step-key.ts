import { toast } from "sonner";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import { effectiveTrackWords, type ReadableLine } from "@/domain/line/effective-words";
import { nextCursorSlot, nextStepSlot } from "@/domain/step-timing/step-cursor";
import { chainedNext } from "@/domain/step-timing/step-queue";
import type { StepKey, StepRefusal } from "@/domain/step-timing/step-write";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { writeStepKey } from "@/utils/timing/step-key-write";
import { currentEffectiveFocus } from "@/views/timeline/effective-focus";
import { isInFocus } from "@/views/timeline/group-focus";
import { playheadTime } from "@/views/timeline/playhead-time";
import { liveStepSelection } from "@/views/timeline/step-timing/step-selection";
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

// -- Functions ----------------------------------------------------------------

function pressStepKey(key: StepKey, lines: ReadableLine[], duration: number): void {
  const time = playheadTime();
  const focus = currentEffectiveFocus();
  const include = (line: ReadableLine) => isInFocus(line, focus);
  const timeline = useTimelineStore.getState();
  const live = liveStepSelection(lines, timeline.selectedWords, timeline.stepQueue);
  const cursor = live.cursor ?? findBoundaryTarget(lines, time, key === "start" ? "begin" : "end", focus);
  if (!cursor) {
    toast(key === "start" ? "No word starts after this point" : "No word ends before this point");
    return;
  }
  const line = lines[cursor.lineIndex];
  const word = line ? effectiveTrackWords(line, cursor.type)?.[cursor.wordIndex] : undefined;
  if (!line || !word) return;
  const project = useProjectStore.getState();
  const rangeOf = timeRangeResolver(project.lines, project.groups, duration);
  const queue = live.cursor ? live.queue : null;
  if (queue && timeline.stepQueue && queue.length !== timeline.stepQueue.length) timeline.setSelectedWords(queue);
  const next = key === "start" ? null : nextCursorSlot(lines, cursor, queue, include);
  const startNext = key === "step" ? chainedNext(cursor, next, nextStepSlot(lines, cursor, include)) : null;
  const refusal = writeStepKey({
    lines,
    cursor,
    startNext,
    key,
    time,
    minDuration: useSettingsStore.getState().minWordDuration,
    rangeOf,
    updateLinesWithHistory: project.updateLinesWithHistory,
  });
  if (refusal) {
    toast(refusalMessage(refusal));
    timeline.setSelectedWords([cursor]);
    return;
  }
  noteGuideSignal("timeline.stepTiming");
  if (next || key === "start") {
    timeline.setSelectedWords([next ?? cursor]);
    return;
  }
  timeline.clearSelection();
  timeline.setSelectedWords([cursor]);
}

function setStepTimingMode(on: boolean): void {
  useTimelineStore.getState().setStepTiming(on);
  if (on) noteGuideSignal("timeline.stepTimingOn");
}

// -- Exports ------------------------------------------------------------------

export { pressStepKey, setStepTimingMode };
