import { selectionBounds } from "@/domain/selection/bounds";
import { isWordSelected } from "@/domain/selection/identity";
import { lineWordSelections } from "@/domain/selection/line-selections";
import type { LoopRegion } from "@/domain/selection/loop-region";
import type { WordSelection } from "@/domain/selection/model";
import { playbackRange } from "@/domain/selection/playback-range";
import type { Bounds } from "@/domain/word/bounds";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { currentEffectiveFocus } from "@/views/timeline/effective-focus";
import { focusBounds } from "@/views/timeline/group-focus";
import { soloPlayStart } from "@/views/timeline/solo-playback";
import { type SelectionPlaybackMode, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Reads --------------------------------------------------------------------

function currentSelectionBounds(): Bounds | null {
  return selectionBounds(useProjectStore.getState().lines, useTimelineStore.getState().selectedWords);
}

function currentPlaybackRange(): Bounds | null {
  const focus = currentEffectiveFocus();
  const { selectionPlayback, loopRegion } = useTimelineStore.getState();
  const playing = selectionPlayback !== null;
  return playbackRange({
    region: playing ? loopRegion : null,
    selection: playing ? currentSelectionBounds() : null,
    focus: focus ? focusBounds(useProjectStore.getState().lines, focus) : null,
    leadIn: useSettingsStore.getState().selectionLeadIn,
    duration: useAudioStore.getState().duration,
  });
}

function loopsRange(
  selectionPlayback: SelectionPlaybackMode | null,
  loopOpenGroup: boolean,
  loopRegion: LoopRegion | null,
): boolean {
  if (selectionPlayback !== null) return selectionPlayback === "loop";
  return loopRegion ? loopRegion.loops : loopOpenGroup;
}

// A paused region only arms the next play; until it plays, the open group keeps its own loop setting.
function currentlyLoops(): boolean {
  return loopsRange(useTimelineStore.getState().selectionPlayback, useSettingsStore.getState().loopOpenGroup, null);
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

function playLoopRegion(mode: SelectionPlaybackMode): boolean {
  const { loopRegion, setLoopRegion, setSelectionPlayback } = useTimelineStore.getState();
  if (!loopRegion) return false;
  setLoopRegion({ ...loopRegion, loops: mode === "loop" });
  setSelectionPlayback(mode);
  const audio = useAudioStore.getState();
  const start = soloPlayStart(livePlaybackTime(), loopRegion);
  if (start !== null) audio.seekTo(start);
  audio.setIsPlaying(true);
  return true;
}

// Transport Play on the Timeline plays a drawn region, looped or once as its Loop toggle says.
function adoptLoopRegionForPlay(): void {
  const { loopRegion, selectionPlayback, setSelectionPlayback } = useTimelineStore.getState();
  if (!loopRegion || selectionPlayback !== null || useProjectStore.getState().activeTab !== "timeline") return;
  setSelectionPlayback(loopRegion.loops ? "loop" : "once");
}

// Drawing prepares the loop: Loop on, playhead at the start; audio already playing jumps in.
function commitDrawnLoopRegion(bounds: Bounds): void {
  const timeline = useTimelineStore.getState();
  const audio = useAudioStore.getState();
  timeline.setLoopRegion({ begin: bounds.begin, end: bounds.end, loops: true });
  timeline.setSelectionPlayback(audio.isPlaying ? "loop" : null);
  audio.seekTo(bounds.begin);
}

function clearLoopRegion(): void {
  const { loopRegion, loopRegionDrag, selectionPlayback, setLoopRegion, setLoopRegionDrag } =
    useTimelineStore.getState();
  if (loopRegionDrag) setLoopRegionDrag(null);
  if (!loopRegion) return;
  if (selectionPlayback !== null) stopSelectionPlayback({ pause: false });
  setLoopRegion(null);
}

function toggleLoop(): void {
  const { selectionPlayback, setSelectionPlayback, loopRegion, setLoopRegion } = useTimelineStore.getState();
  if (selectionPlayback !== null) {
    const next = selectionPlayback === "loop" ? "once" : "loop";
    setSelectionPlayback(next);
    if (loopRegion) setLoopRegion({ ...loopRegion, loops: next === "loop" });
    return;
  }
  if (loopRegion) {
    setLoopRegion({ ...loopRegion, loops: !loopRegion.loops });
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

// Same order as Play: a playing range, then a drawn region, then a timed selection, then the open group.
function toggleRangeLoop(): boolean {
  if (useTimelineStore.getState().selectionPlayback !== null) {
    toggleLoop();
    return true;
  }
  if (playLoopRegion("loop")) return true;
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
  adoptLoopRegionForPlay,
  clearLoopRegion,
  commitDrawnLoopRegion,
  currentPlaybackRange,
  currentSelectionBounds,
  currentlyLoops,
  loopsRange,
  loopSelection,
  playLoopRegion,
  playSelection,
  selectLine,
  selectWordUnlessSelected,
  stopSelectionPlayback,
  toggleLoop,
  toggleLoopShortcut,
};
