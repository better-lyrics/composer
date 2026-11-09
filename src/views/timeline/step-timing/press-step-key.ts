import { toast } from "sonner";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import { effectiveTrackWords, type ReadableLine } from "@/domain/line/effective-words";
import { nextStepSlot } from "@/domain/step-timing/step-cursor";
import type { StepKey, StepRefusal } from "@/domain/step-timing/step-write";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { stepBgWordWrite } from "@/utils/timing/bg-word-timing";
import { stepWordWrite } from "@/utils/timing/word-timing";
import { currentEffectiveFocus } from "@/views/timeline/effective-focus";
import { isInFocus } from "@/views/timeline/group-focus";
import { showLoupeAfterKeyEdit } from "@/views/timeline/loupe/loupe-target";
import { stepWriteTime } from "@/views/timeline/step-timing/pointer-write-time";
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
  const time = stepWriteTime();
  const focus = currentEffectiveFocus();
  const include = (line: ReadableLine) => isInFocus(line, focus);
  const timeline = useTimelineStore.getState();
  const cursor = timeline.selectedWords[0] ?? findBoundaryTarget(lines, time, key === "start" ? "begin" : "end", focus);
  if (!cursor) {
    toast(key === "start" ? "No word starts after this point" : "No word ends before this point");
    return;
  }
  const line = lines[cursor.lineIndex];
  const word = line ? effectiveTrackWords(line, cursor.type)?.[cursor.wordIndex] : undefined;
  if (!line || !word) return;
  const project = useProjectStore.getState();
  const write = cursor.type === "word" ? stepWordWrite : stepBgWordWrite;
  const refusal = write({
    lines,
    lineIdx: cursor.lineIndex,
    wordIdx: cursor.wordIndex,
    key,
    time,
    minDuration: useSettingsStore.getState().minWordDuration,
    range: timeRangeResolver(project.lines, project.groups, duration)(line),
    updateLineWithHistory: project.updateLineWithHistory,
  });
  if (refusal) {
    toast(refusalMessage(refusal));
    timeline.setSelectedWords([cursor]);
    return;
  }
  const edge = key === "start" ? "begin" : "end";
  showLoupeAfterKeyEdit({ lineId: line.id, wordIndex: cursor.wordIndex, type: cursor.type }, edge, word[edge]);
  const next = key === "start" ? cursor : (nextStepSlot(lines, cursor, include) ?? cursor);
  timeline.setSelectedWords([next]);
}

// -- Exports ------------------------------------------------------------------

export { pressStepKey };
