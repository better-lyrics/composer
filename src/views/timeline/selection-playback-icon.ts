import type { SelectionPlaybackMode } from "@/views/timeline/timeline-store";
import { type Icon, IconPlayerPlay, IconRepeat } from "@tabler/icons-react";

// -- Types ---------------------------------------------------------------------

interface RangePlaybackIndicator {
  icon: Icon;
  label: string;
}

// -- Functions -----------------------------------------------------------------

function selectionPlaybackIcon(mode: SelectionPlaybackMode): Icon {
  return mode === "loop" ? IconRepeat : IconPlayerPlay;
}

function rangePlaybackIndicator(
  selectionPlayback: SelectionPlaybackMode | null,
  groupLoops: boolean,
): RangePlaybackIndicator | null {
  if (selectionPlayback !== null) {
    const label = selectionPlayback === "loop" ? "Looping a selection" : "Playing a selection";
    return { icon: selectionPlaybackIcon(selectionPlayback), label };
  }
  return groupLoops ? { icon: IconRepeat, label: "Looping the open group" } : null;
}

// -- Exports -------------------------------------------------------------------

export { rangePlaybackIndicator, selectionPlaybackIcon };
