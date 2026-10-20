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
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Reads --------------------------------------------------------------------

function currentSelectionBounds(): Bounds | null {
  return selectionBounds(useProjectStore.getState().lines, useTimelineStore.getState().selectedWords);
}

function currentPlaybackRange(): Bounds | null {
  const focus = currentEffectiveFocus();
  return playbackRange({
    selection: useTimelineStore.getState().selectionPlayback ? currentSelectionBounds() : null,
    focus: focus ? focusBounds(useProjectStore.getState().lines, focus) : null,
    leadIn: useSettingsStore.getState().selectionLeadIn,
    duration: useAudioStore.getState().duration,
  });
}

// -- Actions ------------------------------------------------------------------

function playSelection(): boolean {
  if (!currentSelectionBounds()) return false;
  useTimelineStore.getState().setSelectionPlayback(true);
  const range = currentPlaybackRange();
  if (!range) return false;
  const audio = useAudioStore.getState();
  audio.seekTo(range.begin);
  audio.setIsPlaying(true);
  return true;
}

function loopSelection(): boolean {
  if (!currentSelectionBounds()) return false;
  useSettingsStore.getState().set("loopRange", true);
  return playSelection();
}

function stopSelectionPlayback({ pause }: { pause: boolean }): void {
  useTimelineStore.getState().setSelectionPlayback(false);
  if (pause) useAudioStore.getState().setIsPlaying(false);
}

function toggleLoop(): void {
  const settings = useSettingsStore.getState();
  settings.set("loopRange", !settings.loopRange);
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
  loopSelection,
  playSelection,
  selectLine,
  selectWordUnlessSelected,
  stopSelectionPlayback,
  toggleLoop,
};
