import { useFrameLoop } from "@/hooks/use-frame-loop";
import { type BeatGrid, beatIndexAt } from "@/domain/tempo/beat-grid";
import { livePlaybackTime } from "@/stores/audio";
import { useRef } from "react";

// -- Types ---------------------------------------------------------------------

type PlayheadBeatCallback = (index: number, changed: boolean, now: number) => void;

// -- Hook ----------------------------------------------------------------------

function usePlayheadBeat(grid: BeatGrid | null, label: string, onFrame: PlayheadBeatCallback): void {
  const lastIndex = useRef<number | null>(null);
  const lastGrid = useRef<BeatGrid | null>(null);

  useFrameLoop(
    (now) => {
      if (!grid) return;
      const index = beatIndexAt(grid, livePlaybackTime());
      const changed = index !== lastIndex.current || grid !== lastGrid.current;
      lastIndex.current = index;
      lastGrid.current = grid;
      onFrame(index, changed, now);
    },
    label,
    grid !== null,
  );
}

// -- Exports -------------------------------------------------------------------

export { usePlayheadBeat };
