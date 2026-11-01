import type { PlacementSkip } from "@/domain/sync/placement-skip";
import { PrerollStatus } from "@/views/sync/preroll-status";
import { useCallback, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface PlacementPreroll extends PlacementSkip {
  lineIndex: number;
}

interface PrerollContext {
  isPlaying: boolean;
  isComplete: boolean;
  cursorLineIndex: number;
  playbackTime: number;
}

interface PlacementPrerollView {
  statusFor: (context: PrerollContext) => React.ReactNode;
  show: (skip: PlacementSkip, lineIndex: number) => void;
  clear: () => void;
}

// -- Helpers ------------------------------------------------------------------

function isPrerollShowing(preroll: PlacementPreroll, context: PrerollContext): boolean {
  return (
    context.isPlaying &&
    !context.isComplete &&
    context.cursorLineIndex === preroll.lineIndex &&
    context.playbackTime < preroll.end
  );
}

// -- Hook ---------------------------------------------------------------------

function usePlacementPreroll(): PlacementPrerollView {
  const [preroll, setPreroll] = useState<PlacementPreroll | null>(null);
  const show = useCallback((skip: PlacementSkip, lineIndex: number) => setPreroll({ ...skip, lineIndex }), []);
  const clear = useCallback(() => setPreroll(null), []);
  const statusFor = (context: PrerollContext) =>
    preroll && isPrerollShowing(preroll, context) ? (
      <PrerollStatus end={preroll.end} seconds={preroll.end - preroll.seekTo} lineNumber={preroll.lineIndex + 1} />
    ) : undefined;
  return { statusFor, show, clear };
}

// -- Exports ------------------------------------------------------------------

export { usePlacementPreroll };
