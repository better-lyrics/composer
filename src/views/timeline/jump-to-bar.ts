import { barTimes } from "@/domain/tempo/beat-grid";
import { notePlacement } from "@/lib/replay-cue";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { toast } from "@/utils/toast";
import { visibleBeatPoints } from "@/views/timeline/point-snap-anchors";
import { adjacentSnapPoint } from "@/views/timeline/snap-marker-math";

// -- Constants -----------------------------------------------------------------

const NO_BEAT_GRID_MESSAGE = "No beat grid yet. Set one up from the Snap menu.";
const HIDDEN_BEAT_GRID_MESSAGE = "Show the beat grid to step through its lines.";

// -- Helpers -------------------------------------------------------------------

function toastUnlessRepeat(message: string, isRepeat: boolean, show: (message: string) => unknown = toast): void {
  if (!isRepeat) show(message);
}

// -- Actions -------------------------------------------------------------------

function jumpToAdjacentBar(direction: 1 | -1, isRepeat: boolean): void {
  const grid = useProjectStore.getState().beatGrid;
  if (!grid) {
    toastUnlessRepeat(NO_BEAT_GRID_MESSAGE, isRepeat);
    return;
  }
  const target = adjacentSnapPoint(
    barTimes(grid).filter((time) => time >= 0),
    livePlaybackTime(),
    direction,
  );
  if (target === null) {
    toastUnlessRepeat(direction > 0 ? "No bar after the playhead" : "No bar before the playhead", isRepeat);
    return;
  }
  useAudioStore.getState().seekTo(target);
  notePlacement(target, "keyboard");
}

function jumpToAdjacentGridLine(direction: 1 | -1, isRepeat: boolean): void {
  if (!useProjectStore.getState().beatGrid) {
    toastUnlessRepeat(NO_BEAT_GRID_MESSAGE, isRepeat);
    return;
  }
  const lines = visibleBeatPoints().map((point) => point.t);
  if (lines.length === 0) {
    toastUnlessRepeat(HIDDEN_BEAT_GRID_MESSAGE, isRepeat);
    return;
  }
  const target = adjacentSnapPoint(lines, livePlaybackTime(), direction);
  if (target === null) {
    toastUnlessRepeat(direction > 0 ? "No grid line after the playhead" : "No grid line before the playhead", isRepeat);
    return;
  }
  useAudioStore.getState().seekTo(target);
  notePlacement(target, "keyboard");
}

// -- Exports -------------------------------------------------------------------

export { jumpToAdjacentBar, jumpToAdjacentGridLine, NO_BEAT_GRID_MESSAGE, toastUnlessRepeat };
