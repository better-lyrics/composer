import type { SelectionPlaybackMode } from "@/views/timeline/timeline-store";
import { type Icon, IconPlayerPlay, IconRepeat } from "@tabler/icons-react";

// -- Functions -----------------------------------------------------------------

function selectionPlaybackIcon(mode: SelectionPlaybackMode): Icon {
  return mode === "loop" ? IconRepeat : IconPlayerPlay;
}

function selectionPlaybackLabel(mode: SelectionPlaybackMode): string {
  return mode === "loop" ? "Looping a selection" : "Playing a selection";
}

// -- Exports -------------------------------------------------------------------

export { selectionPlaybackIcon, selectionPlaybackLabel };
