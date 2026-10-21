import { selectionBounds } from "@/domain/selection/bounds";
import { isWordSelected } from "@/domain/selection/identity";
import { lineWordSelections } from "@/domain/selection/line-selections";
import type { WordSelection } from "@/domain/selection/model";
import { playbackRange } from "@/domain/selection/playback-range";
import type { Bounds } from "@/domain/word/bounds";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { currentEffectiveFocus } from "@/views/timeline/effective-focus";
import { focusBounds } from "@/views/timeline/group-focus";
import { type SelectionPlaybackMode, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Reads --------------------------------------------------------------------

function currentSelectionBounds(): Bounds | null {
  return selectionBounds(useProjectStore.getState().lines, useTimelineStore.getState().selectedWords);
}

function currentPlaybackRange(): Bounds | null {
  const focus = currentEffectiveFocus();
  return playbackRange({
    selection: useTimelineStore.getState().selectionPlayback !== null ? currentSelectionBounds() : null,
    focus: focus ? focusBounds(useProjectStore.getState().lines, focus) : null,
    leadIn: useSettingsStore.getState().selectionLeadIn,
    duration: useAudioStore.getState().duration,
  });
}

function loopsRange(selectionPlayback: SelectionPlaybackMode | null, loopOpenGroup: boolean): boolean {
  return selectionPlayback === null ? loopOpenGroup : selectionPlayback === "loop";
}

function currentlyLoops(): boolean {
  return loopsRange(useTimelineStore.getState().selectionPlayback, useSettingsStore.getState().loopOpenGroup);
}

// -- Actions ------------------------------------------------------------------

function playSelection(mode: SelectionPlaybackMode = "once"): boolean {
  if (!currentSelectionBounds()) return false;
  useTimelineStore.getState().setSelectionPlayback(mode);
  const range = currentPlaybackRange();
  if (!range) return false;
  const audio = useAudioStore.getState();
  audio.seekTo(range.begin);
  audio.setIsPlaying(true);
  return true;
}

function loopSelection(): boolean {
  return playSelection("loop");
}

function stopSelectionPlayback({ pause }: { pause: boolean }): void {
  useTimelineStore.getState().setSelectionPlayback(null);
  if (pause) useAudioStore.getState().setIsPlaying(false);
}

function toggleLoop(): void {
  const { selectionPlayback, setSelectionPlayback } = useTimelineStore.getState();
  if (selectionPlayback !== null) {
    setSelectionPlayback(selectionPlayback === "loop" ? "once" : "loop");
    return;
  }
  const settings = useSettingsStore.getState();
  settings.set("loopOpenGroup", !settings.loopOpenGroup);
}

// Away from the Timeline only a range that is already running can change.
function toggleActiveRangeLoop(): void {
  if (useTimelineStore.getState().selectionPlayback === null && currentEffectiveFocus() === null) return;
  toggleLoop();
}

function toggleLoopShortcut(): void {
  if (useProjectStore.getState().activeTab === "timeline") toggleRangeLoop();
  else toggleActiveRangeLoop();
}

// Same order as Play: a playing selection, then a timed selection, then the open group.
function toggleRangeLoop(): boolean {
  if (useTimelineStore.getState().selectionPlayback !== null) {
    toggleLoop();
    return true;
  }
  if (loopSelection()) return true;
  if (currentEffectiveFocus() === null) return false;
  toggleLoop();
  return true;
}

function selectWordUnlessSelected(target: WordSelection): void {
  const { selectedWords, setSelectedWords } = useTimelineStore.getState();
  if (!isWordSelected(selectedWords, target.lineId, target.wordIndex, target.type)) setSelectedWords([target]);
}

function selectLine(lineId: string, lineIndex: number): void {
  const line = useProjectStore.getState().lines.find((candidate) => candidate.id === lineId);
  if (line) useTimelineStore.getState().setSelectedWords(lineWordSelections(line, lineIndex));
}

// -- Exports ------------------------------------------------------------------

export {
  currentPlaybackRange,
  currentSelectionBounds,
  currentlyLoops,
  loopsRange,
  loopSelection,
  playSelection,
  selectLine,
  selectWordUnlessSelected,
  stopSelectionPlayback,
  toggleLoop,
  toggleLoopShortcut,
};
