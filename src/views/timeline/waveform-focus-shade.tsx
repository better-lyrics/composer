import type { Bounds } from "@/domain/word/bounds";
import { useAudioStore } from "@/stores/audio";
import { cn } from "@/utils/cn";
import { useEffectiveFocusGroup } from "@/views/timeline/effective-focus";
import { WAVEFORM_HEIGHT, shownLoopRegion, useTimelineStore } from "@/views/timeline/timeline-store";
import { useFocusRange } from "@/views/timeline/use-focus-range";
import { useSelectionPlaybackRange } from "@/views/timeline/use-selection-playback-range";

// -- Interfaces ----------------------------------------------------------------

interface RangeShadeProps {
  range: Bounds;
  color: string;
  inner?: Bounds;
}

// -- Constants -----------------------------------------------------------------

const ACCENT = "var(--color-composer-accent)";
const SHADE = "pointer-events-none absolute top-0 z-3 bg-composer-bg-dark/70";
const LEAD_IN = "range-lead-in pointer-events-none absolute top-0 z-3";
const SHADE_HEIGHT = WAVEFORM_HEIGHT - 1;

// -- Components ----------------------------------------------------------------

const RangeShade: React.FC<RangeShadeProps> = ({ range, color, inner }) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const duration = useAudioStore((s) => s.duration);
  if (duration <= 0) return null;

  const beginX = range.begin * zoom;
  const endX = range.end * zoom;

  return (
    <>
      <div
        data-waveform-focus-shade="before"
        aria-hidden="true"
        className={cn(SHADE, "border-r")}
        style={{ left: 0, width: beginX, height: SHADE_HEIGHT, borderColor: color }}
      />
      <div
        data-waveform-focus-shade="after"
        aria-hidden="true"
        className={cn(SHADE, "border-l")}
        style={{ left: endX, width: Math.max(0, duration * zoom - endX), height: SHADE_HEIGHT, borderColor: color }}
      />
      {inner && (
        <>
          <div
            data-waveform-lead-in="before"
            aria-hidden="true"
            className={LEAD_IN}
            style={{ left: beginX, width: Math.max(0, inner.begin * zoom - beginX), height: SHADE_HEIGHT }}
          />
          <div
            data-waveform-lead-in="after"
            aria-hidden="true"
            className={LEAD_IN}
            style={{ left: inner.end * zoom, width: Math.max(0, endX - inner.end * zoom), height: SHADE_HEIGHT }}
          />
        </>
      )}
    </>
  );
};

const WaveformFocusShade: React.FC = () => {
  const loopRegion = useTimelineStore(shownLoopRegion);
  const selectionPlayback = useSelectionPlaybackRange();
  const focusRange = useFocusRange();
  const group = useEffectiveFocusGroup();

  if (loopRegion) return <RangeShade range={loopRegion} color={ACCENT} />;
  if (selectionPlayback) {
    return <RangeShade range={selectionPlayback.range} inner={selectionPlayback.selection} color={ACCENT} />;
  }
  if (focusRange && group) return <RangeShade range={focusRange} color={group.color} />;
  return null;
};

// -- Exports -------------------------------------------------------------------

export { WaveformFocusShade };
