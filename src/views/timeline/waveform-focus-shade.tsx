import { useAudioStore } from "@/stores/audio";
import { cn } from "@/utils/cn";
import { useEffectiveFocusGroup } from "@/views/timeline/effective-focus";
import { WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";
import { useFocusRange } from "@/views/timeline/use-focus-range";

// -- Constants -----------------------------------------------------------------

const SHADE = "pointer-events-none absolute top-0 bg-composer-bg-dark/70";

// -- Component -----------------------------------------------------------------

const WaveformFocusShade: React.FC = () => {
  const range = useFocusRange();
  const group = useEffectiveFocusGroup();
  const zoom = useTimelineStore((s) => s.zoom);
  const duration = useAudioStore((s) => s.duration);
  if (!range || !group || duration <= 0) return null;

  const beginX = range.begin * zoom;
  const endX = range.end * zoom;
  const height = WAVEFORM_HEIGHT - 1;

  return (
    <>
      <div
        data-waveform-focus-shade="before"
        aria-hidden="true"
        className={cn(SHADE, "border-r")}
        style={{ left: 0, width: beginX, height, borderColor: group.color }}
      />
      <div
        data-waveform-focus-shade="after"
        aria-hidden="true"
        className={cn(SHADE, "border-l")}
        style={{ left: endX, width: Math.max(0, duration * zoom - endX), height, borderColor: group.color }}
      />
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { WaveformFocusShade };
