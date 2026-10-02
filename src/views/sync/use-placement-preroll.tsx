import type { PlacementPreroll } from "@/domain/sync/placement-skip";
import { useAudioStore } from "@/stores/audio";
import { PrerollStatus } from "@/views/sync/preroll-status";
import { useCallback, useEffect, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface PlacementPrerollView {
  statusFor: (isPlaying: boolean, lineNumber: number) => React.ReactNode;
  show: (preroll: PlacementPreroll) => void;
  clear: () => void;
}

// -- Hook ---------------------------------------------------------------------

function usePlacementPreroll(): PlacementPrerollView {
  const [preroll, setPreroll] = useState<PlacementPreroll | null>(null);

  useEffect(() => {
    if (!preroll) return;
    const { playbackRate } = useAudioStore.getState();
    const timer = setTimeout(() => setPreroll(null), (preroll.seconds / playbackRate) * 1000);
    return () => clearTimeout(timer);
  }, [preroll]);

  const clear = useCallback(() => setPreroll(null), []);
  const statusFor = (isPlaying: boolean, lineNumber: number) =>
    preroll && isPlaying ? (
      <PrerollStatus end={preroll.end} seconds={preroll.seconds} lineNumber={lineNumber} />
    ) : undefined;
  return { statusFor, show: setPreroll, clear };
}

// -- Exports ------------------------------------------------------------------

export { usePlacementPreroll };
