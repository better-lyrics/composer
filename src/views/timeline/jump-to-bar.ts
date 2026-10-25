import { barTimes } from "@/domain/tempo/beat-grid";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { visibleBeatPoints } from "@/views/timeline/point-snap-anchors";
import { adjacentSnapPoint } from "@/views/timeline/snap-marker-math";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const NO_BEAT_GRID_MESSAGE = "No beat grid yet. Set one up from the Snap menu.";
const HIDDEN_BEAT_GRID_MESSAGE = "Show the beat grid to step through its lines.";

// -- Actions -------------------------------------------------------------------

function jumpToAdjacentBar(direction: 1 | -1): void {
  const grid = useProjectStore.getState().beatGrid;
  if (!grid) {
    toast(NO_BEAT_GRID_MESSAGE);
    return;
  }
  const target = adjacentSnapPoint(
    barTimes(grid).filter((time) => time >= 0),
    livePlaybackTime(),
    direction,
  );
  if (target === null) {
    toast(direction > 0 ? "No bar after the playhead" : "No bar before the playhead");
    return;
  }
  useAudioStore.getState().seekTo(target);
}

function jumpToAdjacentGridLine(direction: 1 | -1): void {
  if (!useProjectStore.getState().beatGrid) {
    toast(NO_BEAT_GRID_MESSAGE);
    return;
  }
  const lines = visibleBeatPoints().map((point) => point.t);
  if (lines.length === 0) {
    toast(HIDDEN_BEAT_GRID_MESSAGE);
    return;
  }
  const target = adjacentSnapPoint(lines, livePlaybackTime(), direction);
  if (target === null) {
    toast(direction > 0 ? "No grid line after the playhead" : "No grid line before the playhead");
    return;
  }
  useAudioStore.getState().seekTo(target);
}

// -- Exports -------------------------------------------------------------------

export { NO_BEAT_GRID_MESSAGE, jumpToAdjacentBar, jumpToAdjacentGridLine };
