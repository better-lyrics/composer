import type { PitchLineMode } from "@/domain/pitch/pitch-line-mode";
import { songWordCoverage } from "@/domain/pitch/spill";
import type { PitchTrack } from "@/domain/pitch/track";
import type { Bounds } from "@/domain/word/bounds";
import { cancelNextFrame, nextFrame } from "@/lib/frame-loop";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { claimArrival, playPitchArrival } from "@/views/timeline/pitch/pitch-arrival";
import { pitchSession } from "@/views/timeline/pitch/pitch-session";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { type RefObject, createContext, useContext, useEffect, useMemo, useRef } from "react";

// -- Types ---------------------------------------------------------------------

interface PitchRows {
  track: PitchTrack;
  coverage: readonly Bounds[];
  themeId: string;
  customThemes: readonly unknown[];
}

interface PitchRowsScopeProps {
  style: React.CSSProperties;
  viewportRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

// -- Context -------------------------------------------------------------------

const PitchRowsContext = createContext<PitchRows | null>(null);

// -- Component -----------------------------------------------------------------

// Owns what every pitch lane shares: the track, the song's word coverage (built once per lines change) and the mode.
const PitchRowsScope: React.FC<PitchRowsScopeProps> = ({ style, viewportRef, children }) => {
  const mode: PitchLineMode = useSettingsStore((s) => s.pitchLine);
  // The session is a plain module object; publishing it bumps the timeline store, which re-runs this selector.
  const track = useTimelineStore(() => pitchSession.track);
  const lines = useProjectStore((s) => s.lines);
  const themeId = useThemeStore((s) => s.activeThemeId);
  const customThemes = useThemeStore((s) => s.customThemes);
  const shown = track !== null && mode !== "off";

  const coverage = useMemo(() => (shown ? songWordCoverage(lines) : []), [shown, lines]);
  const rows = useMemo(
    () => (shown && track ? { track, coverage, themeId, customThemes } : null),
    [shown, track, coverage, themeId, customThemes],
  );

  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!track || mode === "off") return;
    let cancelArrival: (() => void) | null = null;
    const frame = nextFrame(() => {
      const scope = scopeRef.current;
      const viewport = viewportRef.current;
      if (!scope || !viewport || !claimArrival(pitchSession.arrivedAt)) return;
      const zoom = useTimelineStore.getState().zoom;
      cancelArrival = playPitchArrival({ scope, viewport, zoom, mode });
    });
    return () => {
      cancelNextFrame(frame);
      cancelArrival?.();
    };
  }, [track, mode, viewportRef]);

  return (
    <div ref={scopeRef} data-pitch={shown ? mode : "off"} style={style}>
      <PitchRowsContext value={rows}>{children}</PitchRowsContext>
    </div>
  );
};

// -- Hooks ---------------------------------------------------------------------

function usePitchRows(): PitchRows | null {
  return useContext(PitchRowsContext);
}

// -- Exports -------------------------------------------------------------------

export { PitchRowsScope, usePitchRows };
export type { PitchRows };
