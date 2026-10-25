import { selectionBounds } from "@/domain/selection/bounds";
import { playbackRange } from "@/domain/selection/playback-range";
import type { Bounds } from "@/domain/word/bounds";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useMemo } from "react";

// -- Types --------------------------------------------------------------------

interface SelectionPlaybackRange {
  selection: Bounds;
  range: Bounds;
}

// -- Hook ---------------------------------------------------------------------

function useSelectionPlaybackRange(): SelectionPlaybackRange | null {
  const active = useTimelineStore((s) => s.selectionPlayback !== null);
  const selectedWords = useTimelineStore((s) => s.selectedWords);
  const lines = useProjectStore((s) => s.lines);
  const leadIn = useSettingsStore((s) => s.selectionLeadIn);
  const duration = useAudioStore((s) => s.duration);
  return useMemo(() => {
    const selection = active ? selectionBounds(lines, selectedWords) : null;
    const range = selection ? playbackRange({ region: null, selection, focus: null, leadIn, duration }) : null;
    return selection && range ? { selection, range } : null;
  }, [active, selectedWords, lines, leadIn, duration]);
}

// -- Exports ------------------------------------------------------------------

export { useSelectionPlaybackRange };
