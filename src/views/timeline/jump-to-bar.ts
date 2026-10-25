import { barTimes } from "@/domain/tempo/beat-grid";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { adjacentSnapPoint } from "@/views/timeline/snap-marker-math";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const NO_BEAT_GRID_MESSAGE = "No beat grid yet. Set one up from the Snap menu.";

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

// -- Exports -------------------------------------------------------------------

export { NO_BEAT_GRID_MESSAGE, jumpToAdjacentBar };
