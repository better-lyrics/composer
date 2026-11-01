import type { SnapSource } from "@/stores/settings-snap";
import {
  type Icon,
  IconMapPin,
  IconMetronome,
  IconSeparatorVertical,
  IconTextSize,
  IconWaveSine,
} from "@tabler/icons-react";

// -- Types ---------------------------------------------------------------------

interface SnapSourceDisplay {
  label: string;
  icon: Icon;
}

// -- Constants -----------------------------------------------------------------

const SNAP_SOURCE_DISPLAY: Record<SnapSource, SnapSourceDisplay> = {
  words: { label: "Words and lines", icon: IconTextSize },
  markers: { label: "Markers", icon: IconMapPin },
  onsets: { label: "Vocal onsets", icon: IconWaveSine },
  beats: { label: "Beats", icon: IconMetronome },
  playhead: { label: "Playhead", icon: IconSeparatorVertical },
};

const SNAP_SOURCES: readonly SnapSource[] = ["words", "markers", "onsets", "beats", "playhead"];

// -- Exports -------------------------------------------------------------------

export { SNAP_SOURCE_DISPLAY, SNAP_SOURCES };
